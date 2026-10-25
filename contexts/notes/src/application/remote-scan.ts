import { randomBytes } from 'node:crypto'
import { createReadStream, statSync } from 'node:fs'
import { request as httpRequest, type IncomingMessage } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { SCAN_HEADERS, parseVerdict, sha256File, sign, type ScanVerdict } from '@lvn-backend/scanner-protocol'

/** The scan service did not return a verdict. The file stays pending and is not served. */
export class ScanUnavailableError extends Error {
  readonly userId?: string
  constructor(message: string, options?: { userId?: string; cause?: unknown }) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined)
    this.name = 'ScanUnavailableError'
    this.userId = options?.userId
  }
}

export interface RemoteScanTarget {
  url: string
  secret: string
  timeoutMs: number
}

const ATTEMPTS = 3
const OPEN_AFTER = 3
const OPEN_MS = 30_000
const MAX_RESPONSE = 8_192

class ScanHttpError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message)
    this.name = 'ScanHttpError'
  }
}

export interface RemoteScanClock {
  now(): number
  sleep(ms: number): Promise<void>
}

const realClock: RemoteScanClock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}

/**
 * Streams one file to the scan service (ADR-0102). Three attempts, then a circuit that stays open for 30 seconds
 * after three failures. A 401, 400 or 413 is not retried; it still counts toward the circuit. The service never
 * receives storage credentials: only this body.
 */
export class RemoteScanClient {
  private failures = 0
  private openUntil = 0

  constructor(
    private readonly target: RemoteScanTarget,
    private readonly clock: RemoteScanClock = realClock,
  ) {}

  async scan(file: string, mime: string, userId?: string): Promise<ScanVerdict> {
    if (this.clock.now() < this.openUntil) throw new ScanUnavailableError('scan service circuit is open', { userId })
    const hash = await sha256File(file)
    const size = statSync(file).size
    const normalized = mime.toLowerCase()
    let last: unknown
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      try {
        const verdict = await this.once(file, normalized, hash, size)
        this.failures = 0
        return verdict
      } catch (e) {
        last = e
        this.noteFailure()
        const retryable = !(e instanceof ScanHttpError) || e.retryable
        if (!retryable || attempt === ATTEMPTS) break
        await this.clock.sleep(200 * 2 ** (attempt - 1))
      }
    }
    throw new ScanUnavailableError('scan service did not return a verdict', { userId, cause: last })
  }

  private noteFailure(): void {
    this.failures += 1
    if (this.failures >= OPEN_AFTER) {
      this.openUntil = this.clock.now() + OPEN_MS
      this.failures = 0
    }
  }

  private once(file: string, mime: string, hash: string, size: number): Promise<ScanVerdict> {
    const timestamp = String(Math.floor(this.clock.now() / 1000))
    const nonce = randomBytes(16).toString('hex')
    const fields = { timestamp, nonce, sha256: hash, contentLength: String(size), mime }
    const signature = sign(this.target.secret, fields)
    const url = new URL('/v1/scan', this.target.url)
    const request = url.protocol === 'https:' ? httpsRequest : httpRequest
    return new Promise((resolve, reject) => {
      let settled = false
      const fail = (error: Error) => {
        if (settled) return
        settled = true
        reject(error)
      }
      const ok = (verdict: ScanVerdict) => {
        if (settled) return
        settled = true
        resolve(verdict)
      }
      const req = request(
        url,
        {
          method: 'POST',
          headers: {
            [SCAN_HEADERS.timestamp]: timestamp,
            [SCAN_HEADERS.nonce]: nonce,
            [SCAN_HEADERS.sha256]: hash,
            [SCAN_HEADERS.signature]: signature,
            [SCAN_HEADERS.mime]: mime,
            'content-type': 'application/octet-stream',
            'content-length': String(size),
          },
          timeout: this.target.timeoutMs,
        },
        (res) => collect(res, () => req.destroy(), ok, fail),
      )
      req.on('timeout', () => req.destroy(new ScanHttpError('scan service timed out', true)))
      req.on('error', (e) => fail(e instanceof ScanHttpError ? e : new ScanHttpError(e.message, true)))
      createReadStream(file).on('error', (e) => fail(new ScanHttpError(e.message, true))).pipe(req)
    })
  }
}

function collect(res: IncomingMessage, destroy: () => void, ok: (verdict: ScanVerdict) => void, fail: (error: Error) => void): void {
  const chunks: Buffer[] = []
  let size = 0
  res.on('data', (chunk: Buffer) => {
    size += chunk.length
    if (size > MAX_RESPONSE) {
      destroy()
      fail(new ScanHttpError('scan service returned an oversized body', false))
      return
    }
    chunks.push(chunk)
  })
  res.on('error', (e) => fail(new ScanHttpError(e.message, true)))
  res.on('end', () => {
    const text = Buffer.concat(chunks).toString('utf8')
    const status = res.statusCode ?? 0
    if (status === 200) {
      try {
        ok(parseVerdict(text))
      } catch (e) {
        fail(new ScanHttpError(e instanceof Error ? e.message : 'bad verdict', true))
      }
      return
    }
    const retryable = status === 408 || status === 429 || status >= 500
    fail(new ScanHttpError(`scan service returned ${status}`, retryable))
  })
}
