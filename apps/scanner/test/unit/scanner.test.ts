import { createServer, type Server } from 'node:net'
import { PDFDocument } from 'pdf-lib'
import { loadScannerConfig } from '../../src/config'
import { signatureAgeHours } from '../../src/clamd'
import { pdfRisks } from '../../src/pdf'
import { createScanServer } from '../../src/server'
import { signedHeaders, signedRequest } from './signed'

const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'
const SECRET = 'unit-test-secret-unit-test-secret'

describe('scanner config', () => {
  it('binds loopback by default and refuses a public address', () => {
    expect(loadScannerConfig({ SCANNER_SECRET: SECRET }).bind).toBe('127.0.0.1')
    expect(() => loadScannerConfig({ SCANNER_SECRET: SECRET, SCANNER_BIND: '8.8.8.8' })).toThrow(/private or loopback/)
    expect(() => loadScannerConfig({ SCANNER_SECRET: SECRET, SCANNER_BIND: '0.0.0.0' })).toThrow(/private address/)
  })

  it('requires an allow-list when it listens on the private network', () => {
    expect(() => loadScannerConfig({ SCANNER_SECRET: SECRET, SCANNER_BIND: '10.0.0.5' })).toThrow(/SCANNER_ALLOW_FROM/)
    const cfg = loadScannerConfig({ SCANNER_SECRET: SECRET, SCANNER_BIND: '10.0.0.5', SCANNER_ALLOW_FROM: '10.0.0.5, 10.0.0.8' })
    expect(cfg.allowFrom).toEqual(['10.0.0.5', '10.0.0.8'])
    expect(cfg.concurrency).toBe(1)
    expect(cfg.maxBytes).toBe(500 * 1024 * 1024)
  })

  it('refuses a short secret', () => {
    expect(() => loadScannerConfig({ SCANNER_SECRET: 'too-short' })).toThrow(/SCANNER_SECRET/)
  })
})

describe('PDF safety', () => {
  it('flags active content and ignores a name that only starts the same way', () => {
    const js = Buffer.from('%PDF-1.4\n1 0 obj << /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >> endobj\n%%EOF\n')
    expect(pdfRisks(js)).toEqual(['javascript'])
    expect(pdfRisks(Buffer.from('%PDF-1.4\n<< /Launch /Win << /F (cmd.exe) >> >>\n%%EOF\n'))).toContain('launch')
    expect(pdfRisks(Buffer.from('%PDF-1.4\n/JSX /EmbeddedFiles\n'))).toEqual([])
    expect(pdfRisks(Buffer.from('%PDF-1.4\n/JS << /EmbeddedFile /XFA >>'))).toEqual(['javascript', 'embedded-file', 'xfa'])
  })
})

describe('signature age', () => {
  it('reads the date out of a clamd VERSION line', () => {
    const now = Date.parse('2026-10-25T12:00:00Z')
    expect(signatureAgeHours('ClamAV 1.5.4/27600/Sat, 25 Oct 2026 08:00:00 GMT', now)).toBeCloseTo(4, 0)
    expect(signatureAgeHours('ClamAV 1.5.4')).toBeNull()
  })
})

describe('scanner HTTP', () => {
  let clamd: Awaited<ReturnType<typeof startFakeClamd>>
  let url: string
  let close: () => Promise<void>

  beforeAll(async () => {
    clamd = await startFakeClamd()
    const target = new URL(clamd.url)
    const started = createScanServer(loadScannerConfig({
      SCANNER_SECRET: SECRET,
      SCANNER_BIND: '127.0.0.1',
      CLAMAV_URL: `tcp://${target.hostname}:${target.port}`,
      SCANNER_CONCURRENCY: '1',
      SCANNER_MAX_BYTES: '2048',
      SCANNER_SIGNATURE_MAX_AGE_HOURS: '48',
    }))
    await new Promise<void>((resolve) => started.server.listen(0, '127.0.0.1', resolve))
    const address = started.server.address()
    if (!address || typeof address === 'string') throw new Error('no port')
    url = `http://127.0.0.1:${address.port}`
    close = () => started.close()
  })
  afterAll(async () => {
    await close()
    await clamd.close()
  })

  const post = async (body: Buffer, mime: string) => {
    const res = await signedRequest(`${url}/v1/scan`, SECRET, body, mime)
    expect(res.status).toBe(200)
    return JSON.parse(res.body) as unknown
  }

  it('refuses a request without a valid signature and does not scan it', async () => {
    const before = clamd.scans
    const res = await signedRequest(`${url}/v1/scan`, SECRET, Buffer.from(EICAR), 'text/plain', { 'content-type': 'application/octet-stream' })
    expect(res.status).toBe(401)
    expect(clamd.scans).toBe(before)
  })

  it('scans an EICAR body and a clean body', async () => {
    expect(await post(Buffer.from(EICAR), 'text/plain')).toEqual({ result: 'infected', signature: 'Eicar-Test-Signature' })
    expect(await post(Buffer.from('hello'), 'text/plain')).toEqual({ result: 'clean', pageCount: null })
  })

  it('rejects a PDF with JavaScript after ClamAV says it is clean', async () => {
    const pdf = Buffer.from('%PDF-1.7\n1 0 obj << /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >> endobj\n%%EOF\n')
    expect(await post(pdf, 'application/pdf')).toEqual({ result: 'unsafe', signature: 'pdf:javascript' })
  })

  it('counts the pages of a clean PDF', async () => {
    const doc = await PDFDocument.create()
    doc.addPage()
    expect(await post(Buffer.from(await doc.save()), 'application/pdf')).toEqual({ result: 'clean', pageCount: 1 })
  })

  it('rejects a replay of a signed request', async () => {
    const body = Buffer.from('once')
    const headers = signedHeaders(SECRET, body, 'text/plain')
    expect((await signedRequest(`${url}/v1/scan`, SECRET, body, 'text/plain', headers)).status).toBe(200)
    expect((await signedRequest(`${url}/v1/scan`, SECRET, body, 'text/plain', headers)).status).toBe(401)
  })

  it('rejects a body larger than the cap before scanning it', async () => {
    const before = clamd.scans
    const body = Buffer.alloc(3000, 1)
    const res = await signedRequest(`${url}/v1/scan`, SECRET, body, 'application/octet-stream')
    expect(res.status).toBe(413)
    expect(clamd.scans).toBe(before)
  })

  it('answers /healthz and /readyz only when signed', async () => {
    expect((await signedRequest(`${url}/healthz`, SECRET, Buffer.alloc(0), 'application/octet-stream', {})).status).toBe(401)
    const health = await signedRequest(`${url}/healthz`, SECRET, Buffer.alloc(0), 'application/octet-stream')
    expect(health.status).toBe(200)
    expect(JSON.parse(health.body)).toEqual({ status: 'ok' })
    const ready = await signedRequest(`${url}/readyz`, SECRET, Buffer.alloc(0), 'application/octet-stream')
    expect(ready.status).toBe(200)
    expect(JSON.parse(ready.body)).toMatchObject({ status: 'ready', clamd: 'ok' })
  })

  it('returns busy when a scan is already in progress', async () => {
    const before = clamd.scans
    clamd.hold = true
    const body = Buffer.from('held')
    const pending = signedRequest(`${url}/v1/scan`, SECRET, body, 'text/plain')
    await waitFor(() => clamd.scans > before)
    const other = Buffer.from('other')
    const busy = await signedRequest(`${url}/v1/scan`, SECRET, other, 'text/plain')
    expect(busy.status).toBe(503)
    expect(busy.headers['retry-after']).toBe('2')
    clamd.hold = false
    expect((await pending).status).toBe(200)
  })
})

function waitFor(pred: () => boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const timer = setInterval(() => {
      if (pred()) {
        clearInterval(timer)
        resolve()
      } else if (Date.now() - started > 2_000) {
        clearInterval(timer)
        reject(new Error('timed out waiting'))
      }
    }, 10)
  })
}

/** Speaks zPING, zVERSION and zINSTREAM. Holds the answer while `hold` is set. Finds EICAR anywhere in the stream. */
async function startFakeClamd(): Promise<{ url: string; hold: boolean; scans: number; close: () => Promise<void> }> {
  const state = { hold: false, scans: 0 }
  const server: Server = createServer((socket) => {
    let buffer = Buffer.alloc(0)
    let streaming = false
    const chunks: Buffer[] = []
    const finish = (text: string) => socket.end(`${text}\0`)
    socket.on('data', (d: Buffer) => {
      buffer = Buffer.concat([buffer, d])
      if (!streaming) {
        const end = buffer.indexOf(0)
        if (end < 0) return
        const command = buffer.subarray(0, end).toString()
        buffer = buffer.subarray(end + 1)
        if (command === 'zPING') return finish('PONG')
        if (command === 'zVERSION') return finish(`ClamAV 1.5.4/1/${new Date().toUTCString()}`)
        if (command !== 'zINSTREAM') return finish('UNKNOWN COMMAND')
        streaming = true
      }
      while (buffer.length >= 4) {
        const size = buffer.readUInt32BE(0)
        if (size === 0) {
          state.scans++
          const body = Buffer.concat(chunks).toString('latin1')
          const answer = () => finish(body.includes(EICAR) ? 'stream: Eicar-Test-Signature FOUND' : 'stream: OK')
          if (!state.hold) answer()
          else {
            const timer = setInterval(() => {
              if (!state.hold) {
                clearInterval(timer)
                answer()
              }
            }, 10)
          }
          return
        }
        if (buffer.length < 4 + size) return
        chunks.push(buffer.subarray(4, 4 + size))
        buffer = buffer.subarray(4 + size)
      }
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('no port')
  return {
    url: `tcp://127.0.0.1:${address.port}`,
    get hold() {
      return state.hold
    },
    set hold(value: boolean) {
      state.hold = value
    },
    get scans() {
      return state.scans
    },
    close: () => new Promise((resolve) => server.close(() => resolve())),
  }
}
