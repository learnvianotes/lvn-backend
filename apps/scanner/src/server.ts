import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { SCAN_HEADERS, verify, type SignedRequest } from '@lvn-backend/scanner-protocol'
import { clamdCommand, clamdScan, signatureAgeHours } from './clamd'
import { peerAllowed, type ScannerConfig } from './config'
import { inspectIfPdf } from './pdf'
import { CallerRate } from './rate'

export interface ScanServer {
  server: Server
  close(): Promise<void>
}

export function createScanServer(config: ScannerConfig, now: () => number = Date.now): ScanServer {
  const nonces = new Map<string, number>()
  const rates = new CallerRate(config.ratePerMinute, 60_000)
  let active = 0
  const server = createServer((req, res) => {
    void handle(req, res, config, nonces, rates, now, () => active, (n) => {
      active += n
    }).catch((e) => {
      log({ level: 'error', msg: 'unhandled', error: e instanceof Error ? e.message : 'error' })
      if (!res.headersSent) send(res, 500, { error: 'unavailable' })
      else res.destroy()
    })
  })
  server.requestTimeout = config.bodyTimeoutMs
  server.headersTimeout = 10_000
  return {
    server,
    close: () => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  }
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  config: ScannerConfig,
  nonces: Map<string, number>,
  rates: CallerRate,
  now: () => number,
  active: () => number,
  addActive: (n: number) => void,
): Promise<void> {
  const signed = authenticate(req, config, nonces, now)
  if (!signed.ok) {
    log({ level: 'warn', msg: 'rejected', status: signed.status, reason: signed.reason })
    send(res, signed.status, { error: signed.error })
    return
  }
  if (!peerAllowed(req.socket.remoteAddress, config.allowFrom)) {
    log({ level: 'warn', msg: 'rejected', status: 403, reason: 'peer' })
    send(res, 403, { error: 'forbidden' })
    return
  }
  const url = new URL(req.url ?? '/', 'http://scanner')
  if (req.method === 'GET' && (url.pathname === '/healthz' || url.pathname === '/readyz')) {
    if (signed.contentLength !== 0) {
      send(res, 400, { error: 'bad request' })
      return
    }
    if (url.pathname === '/healthz') {
      send(res, 200, { status: 'ok' })
      return
    }
    const [status, body] = await readiness(config, now)
    if (status !== 200) res.setHeader('retry-after', NOT_READY_RETRY)
    send(res, status, body)
    return
  }
  if (req.method !== 'POST' || url.pathname !== '/v1/scan') {
    send(res, 404, { error: 'not found' })
    return
  }
  if (signed.contentLength < 1) {
    send(res, 400, { error: 'bad request' })
    return
  }
  if (signed.contentLength > config.maxBytes) {
    send(res, 413, { error: 'too large' })
    return
  }
  const [readyStatus, readyBody] = await readiness(config, now)
  if (readyStatus !== 200) {
    res.setHeader('retry-after', NOT_READY_RETRY)
    send(res, 503, readyBody)
    req.resume()
    return
  }
  const caller = normalizeCaller(req.socket.remoteAddress)
  const retryAfter = rates.take(caller, now())
  if (retryAfter != null) {
    res.setHeader('retry-after', String(retryAfter))
    send(res, 429, { error: 'rate limited' })
    return
  }
  if (active() >= config.concurrency) {
    res.setHeader('retry-after', '2')
    send(res, 429, { error: 'busy' })
    return
  }
  addActive(1)
  const dir = await mkdtemp(path.join(config.tempDir || tmpdir(), 'lvn-scan-'))
  const file = path.join(dir, 'body')
  try {
    const hashed = await spool(req, file, signed.contentLength, config.maxBytes)
    if (hashed !== signed.sha256) {
      log({ level: 'warn', msg: 'rejected', status: 401, reason: 'hash' })
      send(res, 401, { error: 'unauthorized' })
      return
    }
    const verdict = await scanFile(file, signed.mime, signed.contentLength, config)
    log({ level: 'info', msg: 'scanned', bytes: signed.contentLength, mime: signed.mime, result: verdict.result })
    send(res, 200, verdict)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'scan failed'
    log({ level: 'error', msg: 'scan failed', error: message.slice(0, 300) })
    send(res, 503, { error: 'unavailable' })
  } finally {
    addActive(-1)
    await rm(dir, { recursive: true, force: true })
  }
}

type Auth = { ok: true; sha256: string; contentLength: number; mime: string } | { ok: false; status: number; error: string; reason: string }

function authenticate(req: IncomingMessage, config: ScannerConfig, nonces: Map<string, number>, now: () => number): Auth {
  const header = (name: string) => {
    const value = req.headers[name]
    return typeof value === 'string' ? value.trim() : ''
  }
  const request: SignedRequest = {
    timestamp: header(SCAN_HEADERS.timestamp),
    nonce: header(SCAN_HEADERS.nonce),
    sha256: header(SCAN_HEADERS.sha256),
    contentLength: header('content-length'),
    mime: header(SCAN_HEADERS.mime).toLowerCase(),
    signature: header(SCAN_HEADERS.signature),
  }
  const timestamp = Number(request.timestamp)
  const skew = Math.abs(Math.floor(now() / 1000) - timestamp)
  if (!Number.isInteger(timestamp) || skew > config.clockSkewSeconds) return { ok: false, status: 401, error: 'unauthorized', reason: 'timestamp' }
  if (!verify(config.secret, request)) return { ok: false, status: 401, error: 'unauthorized', reason: 'signature' }
  sweep(nonces, now())
  if (nonces.has(request.nonce) || nonces.size >= 20_000) return { ok: false, status: 401, error: 'unauthorized', reason: 'nonce' }
  nonces.set(request.nonce, now() + (config.clockSkewSeconds + 60) * 1000)
  const contentLength = Number(request.contentLength)
  if (!Number.isSafeInteger(contentLength) || contentLength < 0) return { ok: false, status: 401, error: 'unauthorized', reason: 'length' }
  return { ok: true, sha256: request.sha256, contentLength, mime: request.mime }
}

function sweep(nonces: Map<string, number>, now: number): void {
  for (const [nonce, until] of nonces) if (until <= now) nonces.delete(nonce)
}

async function spool(req: IncomingMessage, file: string, expected: number, maxBytes: number): Promise<string> {
  const hash = createHash('sha256')
  let seen = 0
  const limited = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      seen += chunk.length
      if (seen > maxBytes || seen > expected) {
        cb(new Error('body exceeded the declared size'))
        return
      }
      hash.update(chunk)
      cb(null, chunk)
    },
  })
  await pipeline(req, limited, createWriteStream(file))
  if (seen !== expected) throw new Error('body was shorter than declared')
  return hash.digest('hex')
}

async function scanFile(
  file: string,
  mime: string,
  size: number,
  config: ScannerConfig,
): Promise<{ result: 'clean'; pageCount: number | null } | { result: 'infected' | 'unsafe'; signature: string }> {
  const clam = await clamdScan(config.clamav, file, config.bodyTimeoutMs)
  if (clam.result === 'INFECTED') return { result: 'infected', signature: clam.signature }
  const pdf = await inspectIfPdf(file, mime, size, config.pdfMaxBytes)
  if (pdf && pdf.reasons.length) return { result: 'unsafe', signature: `pdf:${pdf.reasons.join(',')}`.slice(0, 200) }
  return { result: 'clean', pageCount: pdf?.pageCount ?? null }
}

async function readiness(config: ScannerConfig, now: () => number): Promise<[number, Record<string, unknown>]> {
  try {
    const pong = await clamdCommand(config.clamav, 'PING', 5_000)
    if (pong !== 'PONG') return [503, { status: 'not_ready', clamd: 'down' }]
    const version = await clamdCommand(config.clamav, 'VERSION', 5_000)
    const age = signatureAgeHours(version, now())
    if (age == null || age < -1 || age > config.signatureMaxAgeHours) return [503, { status: 'not_ready', clamd: 'ok', signatures: 'stale' }]
    return [200, { status: 'ready', clamd: 'ok', signatureAgeHours: Math.round(age * 10) / 10 }]
  } catch {
    return [503, { status: 'not_ready', clamd: 'down' }]
  }
}

/** How long the main host should wait before asking again while signatures are stale or clamd is down. */
const NOT_READY_RETRY = '30'

function send(res: ServerResponse, status: number, body: object): void {
  const json = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(json),
    'cache-control': 'no-store',
  })
  res.end(json)
}

function normalizeCaller(address: string | undefined): string {
  if (!address) return ''
  return address.startsWith('::ffff:') ? address.slice('::ffff:'.length) : address
}

function log(fields: Record<string, unknown>): void {
  console.log(JSON.stringify({ time: new Date().toISOString(), service: 'lvn-scanner', ...fields }))
}
