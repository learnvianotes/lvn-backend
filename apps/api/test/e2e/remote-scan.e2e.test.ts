import { createServer, type Server } from 'node:http'
import { positionBetween } from '@lvn/contracts/validation'
import { SCAN_HEADERS, verify } from '@lvn-backend/scanner-protocol'
import { MediaProcessingService } from '@lvn-backend/notes'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { Storage } from '@lvn-backend/storage'
import { createTestApp, type TestApp } from '../support/app'
import { EICAR_PDF } from '../support/fake-clamd'
import { upload } from '../support/flows'
import { seedUser, tokenFor } from '../support/seed'

const SECRET = 'remote-scan-secret-remote-scan-secret'
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

/**
 * SCAN_MODE=remote (ADR-0102): the worker streams the file to the scan service. Until the verdict is clean the file
 * is pending and the API does not serve it. The page count is the scanner's, not a second parse in the worker.
 */
describe('remote upload scanning', () => {
  let scanner: Server
  let url = ''
  let t: TestApp
  let me: { id: string; token: string }
  let noteId: string
  let last: string | null = null

  beforeAll(async () => {
    scanner = createServer((req, res) => {
      const chunks: Buffer[] = []
      req.on('data', (c: Buffer) => chunks.push(c))
      req.on('end', () => {
        const body = Buffer.concat(chunks)
        const header = (name: string) => (typeof req.headers[name] === 'string' ? req.headers[name] : '')
        const signed = verify(SECRET, {
          timestamp: header(SCAN_HEADERS.timestamp),
          nonce: header(SCAN_HEADERS.nonce),
          sha256: header(SCAN_HEADERS.sha256),
          contentLength: header('content-length'),
          mime: header(SCAN_HEADERS.mime),
          signature: header(SCAN_HEADERS.signature),
        })
        if (!signed) {
          res.writeHead(401)
          res.end('{}')
          return
        }
        const text = body.toString('latin1')
        const verdict = text.includes('EICAR')
          ? { result: 'infected', signature: 'Eicar-Test-Signature' }
          : text.includes('/JavaScript')
            ? { result: 'unsafe', signature: 'pdf:javascript' }
            : text.startsWith('%PDF-')
              ? { result: 'clean', pageCount: 7 }
              : { result: 'clean', pageCount: null }
        const json = JSON.stringify(verdict)
        res.writeHead(200, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(json) })
        res.end(json)
      })
    })
    await new Promise<void>((resolve) => scanner.listen(0, '127.0.0.1', resolve))
    const bound = scanner.address()
    if (!bound || typeof bound === 'string') throw new Error('no port')
    url = `http://127.0.0.1:${bound.port}`
    t = await createTestApp({ SCAN_MODE: 'remote', SCANNER_URL: url, SCANNER_SECRET: SECRET, SCANNER_TIMEOUT_MS: '5000' })
    const u = await seedUser(t.app, { verified: true })
    me = { id: u.id, token: tokenFor(t.config, u.id) }
    noteId = (await t.gql<{ createNote: { note: { id: string } } }>('mutation { createNote(input: { title: "Remote" }) { note { id } } }', {}, me.token)).data!.createNote.note.id
  })

  afterAll(async () => {
    await t?.close()
    await new Promise<void>((resolve) => scanner.close(() => resolve()))
  })

  const shown = async (fileId: string) => {
    const res = await t.gql<{ note: { cards: { edges: { node: { content: { fileId?: string }; media: { pageCount: number | null } | null } }[] } } }>(
      'query ($id: UUID!) { note(id: $id) { cards { edges { node { content media { pageCount } } } } } }',
      { id: noteId },
      me.token,
    )
    return res.data!.note.cards.edges.find((e) => e.node.content.fileId === fileId)?.node.media ?? null
  }

  const attach = async (fileId: string) => {
    last = positionBetween(last, null)
    const res = await t.gql<{ updateNoteDraft: { results: { status: string }[] } }>('mutation ($input: UpdateNoteDraftInput!) { updateNoteDraft(input: $input) { results { status } } }', {
      input: { noteId, ops: [{ kind: 'UPSERT', id: newId(), type: 'file', position: last, content: { fileId } }] },
    }, me.token)
    expect(res.data!.updateNoteDraft.results[0]!.status).toBe('APPLIED')
  }

  it('does not serve a file until the scanner says it is clean, and keeps the scanner page count', async () => {
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n%%EOF\n')
    const fileId = await upload(t, me.token, 'ATTACHMENT', 'application/pdf', pdf, 'chapter.pdf', noteId)
    expect(await t.app.get(PrismaService).fileObject.findUniqueOrThrow({ where: { id: fileId } })).toMatchObject({ status: 'READY', scanResult: 'PENDING' })
    await attach(fileId)
    expect(await shown(fileId)).toBeNull()

    const media = t.app.get(MediaProcessingService)
    expect(await media.scanQueued(fileId, false)).toBe('clean')
    await media.process(fileId)
    const row = await t.app.get(PrismaService).fileObject.findUniqueOrThrow({ where: { id: fileId } })
    expect(row).toMatchObject({ status: 'READY', scanResult: 'CLEAN', pageCount: 7 })
    expect(await shown(fileId)).toEqual({ pageCount: 7 })
  })

  it('quarantines an infected file and an unsafe PDF', async () => {
    const storage = t.app.get(Storage)
    const media = t.app.get(MediaProcessingService)
    for (const [bytes, name] of [
      [EICAR_PDF, 'invoice.pdf'],
      [Buffer.from('%PDF-1.4\n<< /JavaScript /JS (app.alert(1)) >>\n%%EOF\n'), 'script.pdf'],
    ] as const) {
      const fileId = await upload(t, me.token, 'ATTACHMENT', 'application/pdf', bytes, name, noteId)
      const row = await t.app.get(PrismaService).fileObject.findUniqueOrThrow({ where: { id: fileId } })
      expect(await media.scanQueued(fileId, false)).toBe('quarantined')
      expect(await t.app.get(PrismaService).fileObject.findUniqueOrThrow({ where: { id: fileId } })).toMatchObject({ status: 'QUARANTINED', scanResult: 'INFECTED' })
      expect(await storage.head(row.bucket, row.storageKey)).toBeNull()
      expect(await storage.head(t.config.S3_RESTRICTED_BUCKET, `quarantine/${row.storageKey}`)).not.toBeNull()
    }
  })

  it('leaves the file pending when the scan service is down, including on the last attempt', async () => {
    const away = await createTestApp({ SCAN_MODE: 'remote', SCANNER_URL: 'http://127.0.0.1:9', SCANNER_SECRET: SECRET, SCANNER_TIMEOUT_MS: '1000' })
    try {
      const u = await seedUser(away.app, { verified: true })
      const token = tokenFor(away.config, u.id)
      const note = (await away.gql<{ createNote: { note: { id: string } } }>('mutation { createNote(input: { title: "Away" }) { note { id } } }', {}, token)).data!.createNote.note.id
      const fileId = await upload(away, token, 'ATTACHMENT', 'image/png', PNG, 'dot.png', note)
      const awayMedia = away.app.get(MediaProcessingService)
      await expect(awayMedia.scanQueued(fileId, false)).rejects.toThrow(/scan service/)
      expect(await away.app.get(PrismaService).fileObject.findUniqueOrThrow({ where: { id: fileId } })).toMatchObject({ status: 'READY', scanResult: 'PENDING' })
      await expect(awayMedia.scanQueued(fileId, true)).rejects.toThrow(/scan service/)
      const row = await away.app.get(PrismaService).fileObject.findUniqueOrThrow({ where: { id: fileId } })
      expect(row).toMatchObject({ status: 'READY', scanResult: 'FAILED' })
      expect(row.variants).toBeNull()
    } finally {
      await away.close()
    }
  })
})
