import { lookup as dnsLookup, type LookupAddress, type LookupOptions } from 'node:dns'
import { request as httpRequest, type IncomingMessage } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { isIP } from 'node:net'
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib'
import type { Readable } from 'node:stream'
import { isBlockedAddress } from './addresses'

export type SafeFetchErrorCode = 'INVALID_URL' | 'BLOCKED' | 'TIMEOUT' | 'TOO_LARGE' | 'TYPE' | 'HTTP' | 'NETWORK' | 'REDIRECTS'

export class SafeFetchError extends Error {
  constructor(
    readonly code: SafeFetchErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message)
  }
}

export interface SafeFetchOptions {
  /** Names the fetcher in every request: `LearnViaNotes/1.0 (+https://…)` */
  userAgent: string
  /**
   * Hosts that skip the address and port checks: a test's stand-in server or a local environment's own service.
   * Never set in production.
   */
  allowHosts?: string[]
  timeoutMs?: number
  maxRedirects?: number
}

export interface FetchRequest {
  url: string
  accept: string
  /** Bytes after decompression; more is TOO_LARGE */
  maxBytes: number
  /** Content types accepted (the part before `;`), e.g. /^text\/html$/ */
  types: RegExp
  /** This request's time limit, when it differs from the fetcher's (a picture from a slow image host) */
  timeoutMs?: number
}

export interface FetchResult {
  /** Where the content came from, after redirects */
  url: string
  contentType: string
  body: Buffer
}

const DEFAULT_PORTS: Record<string, string> = { 'http:': '80', 'https:': '443' }

/**
 * The only way the server fetches a URL a person gave (ADR-0074). http and https on ports 80 and 443; every address a
 * name resolves to is checked when the connection is made, through the connection's own lookup, so the address checked
 * is the address used (no DNS rebinding); at most a few redirects, each checked again; bounded in time and size.
 */
export class SafeFetcher {
  private readonly allow: Set<string>
  private readonly timeoutMs: number
  private readonly maxRedirects: number

  constructor(private readonly options: SafeFetchOptions) {
    this.allow = new Set((options.allowHosts ?? []).map((h) => h.toLowerCase()))
    this.timeoutMs = options.timeoutMs ?? 5_000
    this.maxRedirects = options.maxRedirects ?? 3
  }

  async fetch(req: FetchRequest): Promise<FetchResult> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), req.timeoutMs ?? this.timeoutMs)
    try {
      let url = this.check(req.url)
      for (let hop = 0; ; hop++) {
        const res = await this.once(url, req, controller.signal)
        const location = res.statusCode && res.statusCode >= 300 && res.statusCode < 400 ? res.headers.location : undefined
        if (location) {
          res.resume()
          if (hop >= this.maxRedirects) throw new SafeFetchError('REDIRECTS', 'The address redirects too many times.')
          url = this.check(new URL(location, url).toString())
          continue
        }
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          res.resume()
          throw new SafeFetchError('HTTP', `The site answered ${res.statusCode}.`, res.statusCode)
        }
        const contentType = (res.headers['content-type'] ?? '').split(';')[0]!.trim().toLowerCase()
        if (!req.types.test(contentType)) {
          res.resume()
          throw new SafeFetchError('TYPE', `The address gives ${contentType || 'something unnamed'}, not what was asked.`)
        }
        const declared = Number(res.headers['content-length'])
        if (Number.isFinite(declared) && declared > req.maxBytes && !res.headers['content-encoding']) {
          res.resume()
          throw new SafeFetchError('TOO_LARGE', 'The page is too large.')
        }
        const body = await read(decoded(res), req.maxBytes)
        return { url: url.toString(), contentType, body }
      }
    } catch (err) {
      if (err instanceof SafeFetchError) throw err
      if (controller.signal.aborted) throw new SafeFetchError('TIMEOUT', 'The site took too long to answer.')
      throw new SafeFetchError('NETWORK', 'The site could not be reached.')
    } finally {
      clearTimeout(timer)
    }
  }

  /** Scheme, credentials, port and, for an address written as a number, the address itself. */
  private check(raw: string): URL {
    let url: URL
    try {
      url = new URL(raw)
    } catch {
      throw new SafeFetchError('INVALID_URL', 'That is not a web address.')
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new SafeFetchError('INVALID_URL', 'Only http and https addresses are fetched.')
    if (url.username || url.password) throw new SafeFetchError('INVALID_URL', 'Addresses with a user name or password are not fetched.')
    const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
    if (this.allow.has(host)) return url
    if ((url.port || DEFAULT_PORTS[url.protocol]) !== DEFAULT_PORTS[url.protocol]) throw new SafeFetchError('BLOCKED', 'Only the usual web ports are fetched.')
    // Node connects to an address written as a number without a lookup, so it is checked here.
    if (isIP(host) && isBlockedAddress(host)) throw new SafeFetchError('BLOCKED', 'That address is not on the public internet.')
    return url
  }

  private once(url: URL, req: FetchRequest, signal: AbortSignal): Promise<IncomingMessage> {
    const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
    const lookup = this.allow.has(host) ? undefined : guardedLookup
    const send = url.protocol === 'https:' ? httpsRequest : httpRequest
    return new Promise((resolve, reject) => {
      const r = send(url, { method: 'GET', agent: false, lookup, signal, headers: { accept: req.accept, 'accept-encoding': 'gzip, deflate, br', 'user-agent': this.options.userAgent } }, resolve)
      r.on('error', reject)
      r.end()
    })
  }
}

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void

/** dns.lookup that refuses names resolving to any blocked address: the connection then uses what was checked. */
function guardedLookup(hostname: string, options: LookupOptions, callback: LookupCallback): void {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, [])
    const list = addresses as LookupAddress[]
    if (!list.length || list.some((a) => isBlockedAddress(a.address))) {
      return callback(new SafeFetchError('BLOCKED', 'That address is not on the public internet.') as NodeJS.ErrnoException, [])
    }
    if (options.all) return callback(null, list)
    callback(null, list[0]!.address, list[0]!.family)
  })
}

function decoded(res: IncomingMessage): Readable {
  switch ((res.headers['content-encoding'] ?? '').toLowerCase()) {
    case 'gzip':
    case 'x-gzip':
      return res.pipe(createGunzip())
    case 'deflate':
      return res.pipe(createInflate())
    case 'br':
      return res.pipe(createBrotliDecompress())
    default:
      return res
  }
}

/** The stream's bytes, refusing more than `max` (after decompression: a small gzip can expand a lot). */
async function read(stream: Readable, max: number): Promise<Buffer> {
  const chunks: Buffer[] = []
  let size = 0
  try {
    for await (const chunk of stream) {
      size += (chunk as Buffer).length
      if (size > max) {
        stream.destroy()
        throw new SafeFetchError('TOO_LARGE', 'The page is too large.')
      }
      chunks.push(chunk as Buffer)
    }
  } catch (err) {
    if (err instanceof SafeFetchError) throw err
    throw new SafeFetchError('NETWORK', 'The site stopped answering.')
  }
  return Buffer.concat(chunks)
}
