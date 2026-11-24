import { URL } from 'node:url'

export interface ScannerConfig {
  /** Address the process binds. A public address is refused. */
  bind: string
  port: number
  /** Docker bridge only. The compose file on the scanner host uses host networking and does not set this. */
  allowUnspecifiedBind: boolean
  /**
   * Source addresses allowed to call the service, besides loopback. Required whenever the bind address is not
   * loopback, so another instance in the region cannot call a private-IP listener it can route to.
   */
  allowFrom: string[] | null
  secret: string
  clamav: { host: string; port: number }
  /** Hard cap on the request body. Videos are the largest upload (500 MB). */
  maxBytes: number
  /** Authenticated scan requests one source address may make per minute. */
  ratePerMinute: number
  /** A PDF larger than this is not parsed; it is reported unsafe. */
  pdfMaxBytes: number
  concurrency: number
  /** readyz fails when the signature database is older than this. */
  signatureMaxAgeHours: number
  clockSkewSeconds: number
  bodyTimeoutMs: number
  tempDir: string
}

const LOOPBACK = new Set(['127.0.0.1', '::1', 'localhost'])

export function loadScannerConfig(env: Record<string, string | undefined>): ScannerConfig {
  const bind = env.SCANNER_BIND ?? '127.0.0.1'
  const allowUnspecifiedBind = env.SCANNER_ALLOW_UNSPECIFIED_BIND === 'true'
  assertBind(bind, allowUnspecifiedBind)
  const allowFrom = (env.SCANNER_ALLOW_FROM ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (!LOOPBACK.has(bind) && allowFrom.length === 0) {
    throw new Error('SCANNER_ALLOW_FROM is required when SCANNER_BIND is not loopback')
  }
  for (const ip of allowFrom) if (!isIp(ip)) throw new Error('SCANNER_ALLOW_FROM must be a comma-separated list of IP addresses')
  const secret = env.SCANNER_SECRET ?? ''
  if (secret.length < 32) throw new Error('SCANNER_SECRET must be at least 32 characters')
  const clamav = parseClamd(env.CLAMAV_URL ?? 'tcp://127.0.0.1:3310')
  const port = numberIn(env.SCANNER_PORT, 8080, 1, 65535, 'SCANNER_PORT')
  return {
    bind,
    port,
    allowUnspecifiedBind,
    allowFrom: allowFrom.length ? allowFrom : null,
    secret,
    clamav,
    maxBytes: numberIn(env.SCANNER_MAX_BYTES, 500 * 1024 * 1024, 1, 600 * 1024 * 1024, 'SCANNER_MAX_BYTES'),
    ratePerMinute: numberIn(env.SCANNER_RATE_PER_MINUTE, 60, 1, 6_000, 'SCANNER_RATE_PER_MINUTE'),
    pdfMaxBytes: numberIn(env.SCANNER_PDF_MAX_BYTES, 50 * 1024 * 1024, 1, 50 * 1024 * 1024, 'SCANNER_PDF_MAX_BYTES'),
    concurrency: numberIn(env.SCANNER_CONCURRENCY, 3, 1, 6, 'SCANNER_CONCURRENCY'),
    signatureMaxAgeHours: numberIn(env.SCANNER_SIGNATURE_MAX_AGE_HOURS, 48, 1, 24 * 14, 'SCANNER_SIGNATURE_MAX_AGE_HOURS'),
    clockSkewSeconds: numberIn(env.SCANNER_CLOCK_SKEW_SECONDS, 300, 30, 900, 'SCANNER_CLOCK_SKEW_SECONDS'),
    bodyTimeoutMs: numberIn(env.SCANNER_BODY_TIMEOUT_MS, 180_000, 1_000, 600_000, 'SCANNER_BODY_TIMEOUT_MS'),
    tempDir: env.SCANNER_TEMP_DIR || '/tmp',
  }
}

export function peerAllowed(remoteAddress: string | undefined, allowFrom: string[] | null): boolean {
  const ip = normalizeIp(remoteAddress)
  if (ip === '127.0.0.1' || ip === '::1') return true
  if (!allowFrom) return true
  return allowFrom.includes(ip)
}

function assertBind(bind: string, allowUnspecified: boolean): void {
  if (bind === '0.0.0.0' || bind === '::') {
    if (!allowUnspecified) throw new Error('SCANNER_BIND must be a private address (set SCANNER_ALLOW_UNSPECIFIED_BIND only inside a published container)')
    return
  }
  if (!LOOPBACK.has(bind) && !isRfc1918(bind)) throw new Error('SCANNER_BIND must be a private or loopback address')
}

function parseClamd(value: string): { host: string; port: number } {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('CLAMAV_URL must be tcp://host:port')
  }
  if (url.protocol !== 'tcp:' || !url.hostname || !url.port) throw new Error('CLAMAV_URL must be tcp://host:port')
  return { host: url.hostname, port: Number(url.port) }
}

function numberIn(value: string | undefined, fallback: number, min: number, max: number, name: string): number {
  if (value == null || value === '') return fallback
  const n = Number(value)
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${name} must be an integer from ${min} to ${max}`)
  return n
}

function normalizeIp(address: string | undefined): string {
  if (!address) return ''
  return address.startsWith('::ffff:') ? address.slice('::ffff:'.length) : address
}

function isIp(value: string): boolean {
  return isRfc1918(value) || LOOPBACK.has(value) || /^\d{1,3}(\.\d{1,3}){3}$/.test(value)
}

function isRfc1918(host: string): boolean {
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true
  const match = /^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(host)
  if (!match) return false
  const second = Number(match[1])
  return second >= 16 && second <= 31
}
