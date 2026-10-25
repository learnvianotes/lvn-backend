import { createServer } from 'node:http'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { SCAN_HEADERS, verify } from '@lvn-backend/scanner-protocol'
import { RemoteScanClient, ScanNotReadyError, ScanUnavailableError, type RemoteScanClock } from '../../src/application/remote-scan'

const SECRET = 'remote-scan-secret-remote-scan-secret'

describe('RemoteScanClient', () => {
  const clock: RemoteScanClock = { now: () => 1_700_000_000_000, sleep: async () => undefined }

  it('posts the file once with a signature the service accepts', async () => {
    const seen: { mime: string; body: string; signed: boolean }[] = []
    const server = createServer((req, res) => {
      if (req.url === '/readyz') {
        const json = JSON.stringify({ status: 'ready' })
        res.writeHead(200, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(json) })
        res.end(json)
        return
      }
      const chunks: Buffer[] = []
      req.on('data', (c: Buffer) => chunks.push(c))
      req.on('end', () => {
        const body = Buffer.concat(chunks)
        const header = (name: string) => (typeof req.headers[name] === 'string' ? req.headers[name] : '')
        seen.push({
          mime: header(SCAN_HEADERS.mime),
          body: body.toString(),
          signed: verify(SECRET, {
            timestamp: header(SCAN_HEADERS.timestamp),
            nonce: header(SCAN_HEADERS.nonce),
            sha256: header(SCAN_HEADERS.sha256),
            contentLength: header('content-length'),
            mime: header(SCAN_HEADERS.mime),
            signature: header(SCAN_HEADERS.signature),
          }),
        })
        const json = JSON.stringify({ result: 'clean', pageCount: 3 })
        res.writeHead(200, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(json) })
        res.end(json)
      })
    })
    await listen(server)
    const file = await tempFile('hello scan')
    try {
      const client = new RemoteScanClient({ url: address(server), secret: SECRET, timeoutMs: 2_000 }, clock)
      await expect(client.scan(file, 'text/plain', 'user-1')).resolves.toEqual({ result: 'clean', pageCount: 3 })
      expect(seen).toEqual([{ mime: 'text/plain', body: 'hello scan', signed: true }])
    } finally {
      server.close()
    }
  })

  it('does not retry a 401, and opens the circuit after three failures', async () => {
    let calls = 0
    const server = createServer((req, res) => {
      if (req.url === '/readyz') {
        const json = JSON.stringify({ status: 'ready' })
        res.writeHead(200, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(json) })
        res.end(json)
        return
      }
      calls += 1
      res.writeHead(401)
      res.end('{}')
    })
    await listen(server)
    const file = await tempFile('x')
    const client = new RemoteScanClient({ url: address(server), secret: SECRET, timeoutMs: 2_000 }, clock)
    try {
      await expect(client.scan(file, 'text/plain', 'user-1')).rejects.toBeInstanceOf(ScanUnavailableError)
      await expect(client.scan(file, 'text/plain', 'user-1')).rejects.toBeInstanceOf(ScanUnavailableError)
      await expect(client.scan(file, 'text/plain', 'user-1')).rejects.toBeInstanceOf(ScanUnavailableError)
      expect(calls).toBe(3)
      await expect(client.scan(file, 'text/plain', 'user-2')).rejects.toThrow(/circuit is open/)
      expect(calls).toBe(3)
    } finally {
      server.close()
    }
  })

  it('retries a 503 and then returns the verdict', async () => {
    let calls = 0
    const server = createServer((req, res) => {
      if (req.url === '/readyz') {
        const json = JSON.stringify({ status: 'ready' })
        res.writeHead(200, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(json) })
        res.end(json)
        return
      }
      calls += 1
      if (calls < 3) {
        res.writeHead(503)
        res.end('{}')
        return
      }
      const json = JSON.stringify({ result: 'infected', signature: 'Eicar-Test-Signature' })
      res.writeHead(200, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(json) })
      res.end(json)
    })
    await listen(server)
    const file = await tempFile('eicar')
    try {
      const client = new RemoteScanClient({ url: address(server), secret: SECRET, timeoutMs: 2_000 }, clock)
      await expect(client.scan(file, 'application/pdf')).resolves.toEqual({ result: 'infected', signature: 'Eicar-Test-Signature' })
      expect(calls).toBe(3)
    } finally {
      server.close()
    }
  })

  it('does not count a not-ready scanner as a failure', async () => {
    let calls = 0
    const server = createServer((_req, res) => {
      calls += 1
      const json = JSON.stringify({ status: 'not_ready', clamd: 'ok', signatures: 'stale' })
      res.writeHead(503, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(json), 'retry-after': '30' })
      res.end(json)
    })
    await listen(server)
    const file = await tempFile('x')
    const client = new RemoteScanClient({ url: address(server), secret: SECRET, timeoutMs: 2_000 }, clock)
    try {
      await expect(client.scan(file, 'text/plain', 'user-1')).rejects.toBeInstanceOf(ScanNotReadyError)
      await expect(client.scan(file, 'text/plain', 'user-1')).rejects.toBeInstanceOf(ScanNotReadyError)
      expect(client.circuitOpenUntil).toBe(0)
      expect(calls).toBe(2)
    } finally {
      server.close()
    }
  })
})

function listen(server: ReturnType<typeof createServer>): Promise<void> {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
}

function address(server: ReturnType<typeof createServer>): string {
  const bound = server.address()
  if (!bound || typeof bound === 'string') throw new Error('no port')
  return `http://127.0.0.1:${bound.port}`
}

async function tempFile(text: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'lvn-remote-scan-'))
  const file = path.join(dir, 'body')
  await writeFile(file, text)
  return file
}
