import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { positionBetween } from '@lvn/contracts/validation'
import { clamdScan, MediaProcessingService, NOTES_MEDIA_QUEUE } from '@lvn-backend/notes'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { Queues } from '@lvn-backend/queue'
import { Storage } from '@lvn-backend/storage'
import sharp from 'sharp'
import { createTestApp, type TestApp } from '../support/app'
import { EICAR, EICAR_PDF, startFakeClamd } from '../support/fake-clamd'
import { SAMPLES, upload } from '../support/flows'
import { seedUser, tokenFor } from '../support/seed'

/**
 * Media processing after an upload (§8.1, §8.2, ADR-0041): the scan, picture sizes, a 720p transcode and poster, normalised
 * audio, page counts, quarantine and reconciliation — with real sharp and ffmpeg, and a stand-in clamd.
 */
describe('media processing', () => {
  let t: TestApp
  let db: PrismaService
  let media: MediaProcessingService
  let storage: Storage
  let clamd: Awaited<ReturnType<typeof startFakeClamd>>
  let me: { id: string; token: string }
  let noteId: string
  const dir = mkdtempSync(path.join(tmpdir(), 'lvn-media-test-'))

  type Media = { id: string; width: number | null; height: number | null; durationMs: number | null; pageCount: number | null; thumbUrl: string | null; mediumUrl: string | null; largeUrl: string | null; posterUrl: string | null; playbackUrl: string | null }
  let last: string | null = null
  const addCard = async (fileId: string, type: string) => {
    last = positionBetween(last, null)
    const res = await t.gql<{ updateNoteDraft: { results: { status: string }[] } }>('mutation ($input: UpdateNoteDraftInput!) { updateNoteDraft(input: $input) { results { status } } }', { input: { noteId, ops: [{ kind: 'UPSERT', id: newId(), type, position: last, content: type === 'image' ? { fileId, alt: 'x' } : { fileId } }] } }, me.token)
    expect(res.data!.updateNoteDraft.results[0]!.status).toBe('APPLIED')
  }
  const shownMedia = async (fileId: string) => {
    const res = await t.gql<{ note: { cards: { edges: { node: { media: Media | null; content: { fileId?: string } } }[] } } }>('query ($id: UUID!) { note(id: $id) { cards { edges { node { content media { id width height durationMs pageCount thumbUrl mediumUrl largeUrl posterUrl playbackUrl } } } } } }', { id: noteId }, me.token)
    return res.data!.note.cards.edges.find((e) => e.node.content.fileId === fileId)!.node.media
  }
  const mediaOf = async (fileId: string, type: string) => {
    await addCard(fileId, type)
    return shownMedia(fileId)
  }
  const ffmpeg = (...args: string[]) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args])

  beforeAll(async () => {
    clamd = await startFakeClamd()
    t = await createTestApp({ CLAMAV_URL: clamd.url })
    db = t.app.get(PrismaService)
    media = t.app.get(MediaProcessingService)
    storage = t.app.get(Storage)
    const u = await seedUser(t.app, { verified: true })
    me = { id: u.id, token: tokenFor(t.config, u.id) }
    noteId = (await t.gql<{ createNote: { note: { id: string } } }>('mutation { createNote(input: { title: "Media" }) { note { id } } }', {}, me.token)).data!.createNote.note.id
  })
  afterAll(async () => {
    await t.close()
    await clamd.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('makes three sizes of a picture, after scanning it, and queues every upload', async () => {
    const photo = await sharp({ create: { width: 2400, height: 1600, channels: 3, background: '#3b82f6' } }).jpeg().toBuffer()
    const fileId = await upload(t, me.token, 'ATTACHMENT', 'image/jpeg', photo, 'photo.jpg', noteId)
    // FileReady queues the job; apps/worker runs it.
    await new Promise((r) => setTimeout(r, 200))
    expect(await t.app.get(Queues).queue(NOTES_MEDIA_QUEUE).getJob(`${fileId}.process`)).toBeDefined()
    const scans = clamd.scans
    expect(await media.process(fileId)).toMatchObject({ status: 'READY', variants: { thumb: expect.stringMatching(/\/thumb$/), medium: expect.any(String), large: expect.any(String) } })
    expect(clamd.scans).toBe(scans + 1)
    const row = await db.fileObject.findUniqueOrThrow({ where: { id: fileId } })
    expect(row).toMatchObject({ width: 2400, height: 1600, scanResult: 'CLEAN', status: 'READY', checksumSha256: expect.stringMatching(/^[0-9a-f]{64}$/) })

    const shown = (await mediaOf(fileId, 'image'))!
    expect(shown).toMatchObject({ width: 2400, height: 1600, posterUrl: null, playbackUrl: null })
    for (const [url, width] of [[shown.thumbUrl, 320], [shown.mediumUrl, 960], [shown.largeUrl, 1920]] as const) {
      const res = await fetch(url!)
      expect(res.status).toBe(200)
      const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata()
      expect({ format: meta.format, width: meta.width }).toEqual({ format: 'webp', width })
    }
  })

  it('never enlarges a small picture', async () => {
    const fileId = await upload(t, me.token, 'ATTACHMENT', 'image/png', await sharp({ create: { width: 200, height: 100, channels: 3, background: '#f00' } }).png().toBuffer(), 'small.png', noteId)
    await media.process(fileId)
    const shown = (await mediaOf(fileId, 'image'))!
    expect((await sharp(Buffer.from(await (await fetch(shown.largeUrl!)).arrayBuffer())).metadata()).width).toBe(200)
  })

  it('transcodes a video to 720p with a poster, and normalises audio', async () => {
    const video = path.join(dir, 'clip.mp4')
    ffmpeg('-f', 'lavfi', '-i', 'testsrc=size=1440x1080:rate=10', '-f', 'lavfi', '-i', 'sine=frequency=440', '-t', '2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', video)
    const videoId = await upload(t, me.token, 'ATTACHMENT', 'video/mp4', readFileSync(video), 'clip.mp4', noteId)
    expect((await media.process(videoId)).variants).toMatchObject({ video720: expect.stringMatching(/\/video720$/), poster: expect.stringMatching(/\/poster$/) })
    const shownVideo = (await mediaOf(videoId, 'video'))!
    expect(shownVideo).toMatchObject({ width: 1440, height: 1080 })
    expect(shownVideo.durationMs).toBeGreaterThan(1500)
    const transcode = path.join(dir, 'video720.mp4')
    execFileSync('curl', ['-s', '-o', transcode, shownVideo.playbackUrl!])
    const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', transcode]).toString()) as { streams: { codec_name: string; height?: number }[] }
    expect(probe.streams.find((s) => s.height)).toMatchObject({ codec_name: 'h264', height: 720 })
    expect((await sharp(Buffer.from(await (await fetch(shownVideo.posterUrl!)).arrayBuffer())).metadata()).format).toBe('webp')

    const sound = path.join(dir, 'tone.wav')
    ffmpeg('-f', 'lavfi', '-i', 'sine=frequency=220:duration=1', sound)
    const audioId = await upload(t, me.token, 'ATTACHMENT', 'audio/wav', readFileSync(sound), 'tone.wav', noteId)
    expect((await media.process(audioId)).variants).toMatchObject({ audio: expect.stringMatching(/\/audio$/) })
    const shownAudio = (await mediaOf(audioId, 'audio'))!
    expect(shownAudio.durationMs).toBeGreaterThan(900)
    expect((await fetch(shownAudio.playbackUrl!)).status).toBe(200)
  })

  it('counts the pages of a PDF', async () => {
    const chapter = readFileSync(path.join(__dirname, '../../../../workers/pdf-engine/tests/fixtures/chapter.pdf'))
    const fileId = await upload(t, me.token, 'ATTACHMENT', 'application/pdf', chapter, 'chapter.pdf', noteId)
    await media.process(fileId)
    expect((await mediaOf(fileId, 'file'))!.pageCount).toBe(1)
  })

  it('quarantines an infected file: kept in the restricted bucket, never served again', async () => {
    const fileId = await upload(t, me.token, 'ATTACHMENT', 'application/pdf', EICAR_PDF, 'invoice.pdf', noteId)
    const row = await db.fileObject.findUniqueOrThrow({ where: { id: fileId } })
    // Someone used it in a card before the scan finished.
    await addCard(fileId, 'file')
    expect(await shownMedia(fileId)).not.toBeNull()
    expect(await media.process(fileId)).toEqual({ status: 'QUARANTINED', variants: {} })
    expect(await db.fileObject.findUniqueOrThrow({ where: { id: fileId } })).toMatchObject({ status: 'QUARANTINED', scanResult: 'INFECTED' })
    expect(await storage.head(row.bucket, row.storageKey)).toBeNull()
    expect(await storage.head(t.config.S3_RESTRICTED_BUCKET, `quarantine/${row.storageKey}`)).not.toBeNull()
    expect(await shownMedia(fileId)).toBeNull()
    // Processing it again changes nothing.
    expect((await media.process(fileId)).status).toBe('QUARANTINED')
  })

  it('retries when the scanner is away, and on the last try serves the file and says it was not scanned', async () => {
    const away = await createTestApp({ CLAMAV_URL: 'tcp://127.0.0.1:9' })
    try {
      const u = await seedUser(away.app, { verified: true })
      const token = tokenFor(away.config, u.id)
      const note = (await away.gql<{ createNote: { note: { id: string } } }>('mutation { createNote(input: { title: "Away" }) { note { id } } }', {}, token)).data!.createNote.note.id
      const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#0f0' } }).png().toBuffer()
      const fileId = await upload(away, token, 'ATTACHMENT', 'image/png', png, 'dot.png', note)
      const service = away.app.get(MediaProcessingService)
      await expect(service.process(fileId, false)).rejects.toThrow()
      expect(await service.process(fileId, true)).toMatchObject({ status: 'READY', variants: { thumb: expect.any(String) } })
      expect(await away.app.get(PrismaService).fileObject.findUniqueOrThrow({ where: { id: fileId } })).toMatchObject({ status: 'READY', scanResult: 'ERROR' })
    } finally {
      await away.close()
    }
  })

  it('reconciles storage with the rows, reporting drift without deleting anything', async () => {
    const stray = `${t.config.APP_ENV}/${me.id}/${newId()}/original`
    await storage.put(t.config.S3_BUCKET, stray, Buffer.from('stray'), { contentType: 'text/plain' })
    const r = await media.reconcile()
    expect(r.orphanObjects).toContain(stray)
    expect(r.missingObjects).toEqual([])
    expect(await storage.head(t.config.S3_BUCKET, stray)).not.toBeNull()
  })

  it('speaks clamd’s protocol: clean, infected', async () => {
    const clean = path.join(dir, 'clean.txt')
    const bad = path.join(dir, 'eicar.txt')
    writeFileSync(clean, 'hello')
    writeFileSync(bad, EICAR)
    const target = { host: '127.0.0.1', port: Number(new URL(clamd.url).port) }
    expect(await clamdScan(target, clean)).toEqual({ result: 'CLEAN' })
    expect(await clamdScan(target, bad)).toEqual({ result: 'INFECTED', signature: 'Eicar-Test-Signature' })
    await expect(clamdScan({ host: '127.0.0.1', port: 9 }, clean)).rejects.toThrow()
  })
})

describe('media processing of damaged files', () => {
  it('retries a picture its tools cannot read, then leaves it served as uploaded', async () => {
    const t = await createTestApp()
    try {
      const u = await seedUser(t.app, { verified: true })
      const token = tokenFor(t.config, u.id)
      const note = (await t.gql<{ createNote: { note: { id: string } } }>('mutation { createNote(input: { title: "Damaged" }) { note { id } } }', {}, token)).data!.createNote.note.id
      // PNG magic bytes and nothing after them: it passes the upload check but no image library can read it.
      const fileId = await upload(t, token, 'ATTACHMENT', 'image/png', SAMPLES.png, 'broken.png', note)
      const service = t.app.get(MediaProcessingService)
      await expect(service.process(fileId, false)).rejects.toThrow()
      expect(await service.process(fileId, true)).toEqual({ status: 'READY', variants: {} })
      expect(await t.app.get(PrismaService).fileObject.findUniqueOrThrow({ where: { id: fileId } })).toMatchObject({ status: 'READY', variants: null, checksumSha256: expect.any(String) })
    } finally {
      await t.close()
    }
  })
})
