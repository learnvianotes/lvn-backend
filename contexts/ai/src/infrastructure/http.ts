import { lookup as dnsLookup, type LookupAddress, type LookupOptions } from 'node:dns'
import { request as httpRequest, type IncomingMessage } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { Readable } from 'node:stream'
import { HttpProviderError, ProviderError } from '../domain/provider'
import { isMetadataAddress, parseProviderUrl, ProviderUrlError } from '../domain/provider-url'

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void

/**
 * An HTTP call to a provider. A timeout or a network failure and 5xx/429 answers are worth another try; other 4xx
 * answers (an unknown model, a bad key, a bad request) are not. The provider's own words come back in the error.
 *
 * Redirects are not followed. A 302 would otherwise carry the call, and the note text in it, onto whatever host the
 * first server names, including the cloud metadata service. The address is checked again when the name is resolved:
 * the lookup used for the connection refuses a metadata or link-local answer, and that is the address the socket uses.
 * Private and loopback addresses stay allowed (ADR-0065).
 */
export async function callProvider(label: string, target: string, headers: Record<string, string>, body: object, timeoutMs: number, method: 'POST' | 'GET' = 'POST'): Promise<Response> {
  let url: URL
  try {
    url = parseProviderUrl(target)
  } catch (e) {
    throw providerFailure(label, e, timeoutMs)
  }
  const signal = AbortSignal.timeout(timeoutMs)
  let res: IncomingMessage
  try {
    res = await send(url, method, headers, method === 'POST' ? JSON.stringify(body) : undefined, signal)
  } catch (e) {
    throw providerFailure(label, e, timeoutMs)
  }
  if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400) {
    res.resume()
    throw new ProviderError(`${label}: the provider redirected the call; give its address directly`, false)
  }
  const response = toResponse(res)
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    const status = res.statusCode ?? response.status
    throw new HttpProviderError(`${label}: ${status} ${text.slice(0, 300)}`, status >= 500 || status === 429, status, text)
  }
  return response
}

/** A POST whose body is not JSON (the audio transcriptions upload). Same address checks as `callProvider`. */
export async function callProviderBytes(label: string, target: string, headers: Record<string, string>, body: Buffer, contentType: string, timeoutMs: number): Promise<Response> {
  let url: URL
  try {
    url = parseProviderUrl(target)
  } catch (e) {
    throw providerFailure(label, e, timeoutMs)
  }
  const signal = AbortSignal.timeout(timeoutMs)
  let res: IncomingMessage
  try {
    res = await send(url, 'POST', { 'content-type': contentType, ...headers }, body, signal)
  } catch (e) {
    throw providerFailure(label, e, timeoutMs)
  }
  if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400) {
    res.resume()
    throw new ProviderError(`${label}: the provider redirected the call; give its address directly`, false)
  }
  const response = toResponse(res)
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    const status = res.statusCode ?? response.status
    throw new HttpProviderError(`${label}: ${status} ${text.slice(0, 300)}`, status >= 500 || status === 429, status, text)
  }
  return response
}

/** Server-sent events: each `data:` payload as it arrives (OpenAI's and Anthropic's streams). */
export async function* serverSentEvents(res: Response): AsyncGenerator<string> {
  const decoder = new TextDecoder()
  let buffer = ''
  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(chunk, { stream: true })
    let end: number
    while ((end = buffer.search(/\r?\n\r?\n/)) >= 0) {
      const event = buffer.slice(0, end)
      buffer = buffer.slice(end).replace(/^\r?\n\r?\n/, '')
      const data = event
        .split(/\r?\n/)
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trimStart())
        .join('\n')
      if (data) yield data
    }
  }
}

/** dns.lookup that refuses a name resolving to any metadata or link-local address. The connection uses that result. */
function metadataLookup(hostname: string, options: LookupOptions, callback: LookupCallback): void {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, [])
    const list = addresses as LookupAddress[]
    if (!list.length || list.some((a) => isMetadataAddress(a.address))) {
      return callback(Object.assign(new Error('that address is a cloud metadata or link-local address'), { code: 'EMETADATA' }), [])
    }
    if (options.all) return callback(null, list)
    const first = list[0]!
    callback(null, first.address, first.family)
  })
}

function send(url: URL, method: string, headers: Record<string, string>, body: string | Buffer | undefined, signal: AbortSignal): Promise<IncomingMessage> {
  const request = url.protocol === 'https:' ? httpsRequest : httpRequest
  return new Promise((resolve, reject) => {
    const req = request(url, { method, agent: false, lookup: metadataLookup, signal, headers: { 'content-type': 'application/json', ...headers } }, resolve)
    req.on('error', reject)
    req.end(body)
  })
}

function toResponse(res: IncomingMessage): Response {
  const headers = new Headers()
  for (const [name, value] of Object.entries(res.headers)) {
    if (value === undefined || name === 'transfer-encoding' || name === 'connection' || name === 'keep-alive') continue
    for (const item of Array.isArray(value) ? value : [value]) headers.append(name, item)
  }
  return new Response(Readable.toWeb(res) as ReadableStream, { status: res.statusCode ?? 502, headers })
}

function providerFailure(label: string, e: unknown, timeoutMs: number): ProviderError {
  if (e instanceof ProviderError) return e
  if (e instanceof ProviderUrlError) return new ProviderError(`${label}: ${e.message}`, false)
  const err = e as Error & { code?: string }
  if (err.code === 'EMETADATA' || /metadata or link-local/.test(err.message)) return new ProviderError(`${label}: that address is a cloud metadata or link-local address`, false)
  const timeout = err.name === 'TimeoutError' || err.name === 'AbortError' || err.code === 'ABORT_ERR'
  return new ProviderError(`${label}: ${timeout ? `no answer in ${timeoutMs} ms` : err.message}`, true)
}
