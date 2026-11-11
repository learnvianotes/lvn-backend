/**
 * The browser Sentry tunnel (ADR-0112). The API accepts an envelope and forwards it only to the configured
 * DSN's host and project. A different host or project is refused, so this is not an open proxy.
 */

export interface SentryDsnParts {
  host: string
  projectId: string
  publicKey: string
  /** Where the tunnel posts. Always taken from our DSN, never from the envelope. */
  envelopeUrl: string
}

/** `https://<public key>@<host>/<project id>`. Anything else is not a DSN we will forward to. */
export function parseSentryDsn(dsn: string): SentryDsnParts | null {
  let url: URL
  try {
    url = new URL(dsn)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (!url.username || !url.hostname || url.hostname.includes('@')) return null
  const projectId = url.pathname.replace(/^\//, '').split('/')[0] ?? ''
  if (!/^\d+$/.test(projectId)) return null
  return {
    host: url.host,
    projectId,
    publicKey: decodeURIComponent(url.username),
    envelopeUrl: `${url.protocol}//${url.host}/api/${projectId}/envelope/`,
  }
}

export type TunnelSubject = 'adult' | 'minor' | 'anonymous'

export type TunnelDecision =
  | { action: 'forward'; url: string; body: string }
  | { action: 'drop' }
  | { action: 'reject'; status: 400 | 413; reason: string }

const IP_HEADER = /^(x-forwarded-for|x-real-ip|x-client-ip|x-cluster-client-ip|true-client-ip|cf-connecting-ip|fastly-client-ip|fly-client-ip|forwarded|forwarded-for|x-forwarded)$/i

/**
 * Checks the envelope against our DSN and, for a minor or an unknown age, removes user and IP fields.
 * `anonymous` is a request with no account. An unknown age is `minor`.
 */
export function prepareSentryTunnel(input: {
  configuredDsn: string | undefined
  body: string
  maxBytes: number
  subject: TunnelSubject
  minorEventsEnabled: boolean
}): TunnelDecision {
  const configured = input.configuredDsn ? parseSentryDsn(input.configuredDsn) : null
  if (!configured) return { action: 'reject', status: 400, reason: 'Sentry is not configured.' }
  const bytes = Buffer.byteLength(input.body)
  if (!input.body || bytes > input.maxBytes) return { action: 'reject', status: 413, reason: 'The envelope is too large.' }
  const headerLine = input.body.split(/\r?\n/, 1)[0] ?? ''
  let header: { dsn?: unknown }
  try {
    header = JSON.parse(headerLine) as { dsn?: unknown }
  } catch {
    return { action: 'reject', status: 400, reason: 'The envelope header is not JSON.' }
  }
  if (typeof header.dsn !== 'string') return { action: 'reject', status: 400, reason: 'The envelope has no DSN.' }
  const claimed = parseSentryDsn(header.dsn)
  if (!claimed || claimed.host !== configured.host || claimed.projectId !== configured.projectId || claimed.publicKey !== configured.publicKey) {
    return { action: 'reject', status: 400, reason: 'The envelope DSN does not match this server.' }
  }
  if (input.subject === 'minor' && !input.minorEventsEnabled) return { action: 'drop' }
  const body = input.subject === 'minor' ? stripEnvelopeIdentity(input.body) : input.body
  return { action: 'forward', url: configured.envelopeUrl, body }
}

/** The first user id carried on an event item, so an envelope can be classified when the request has no session. */
export function envelopeUserId(body: string): string | null {
  for (const item of readItems(body)) {
    if (!item) continue
    const user = item.user
    if (user && typeof user === 'object' && typeof (user as { id?: unknown }).id === 'string') return (user as { id: string }).id
  }
  return null
}

function stripEnvelopeIdentity(body: string): string {
  const newline = body.includes('\r\n') ? '\r\n' : '\n'
  const headerEnd = body.indexOf(newline)
  if (headerEnd < 0) return body
  const header = body.slice(0, headerEnd)
  let rest = body.slice(headerEnd + newline.length)
  const out: string[] = [header]
  while (rest.length) {
    const lineEnd = rest.indexOf(newline)
    if (lineEnd < 0) {
      out.push(rest)
      break
    }
    const itemHeaderText = rest.slice(0, lineEnd)
    rest = rest.slice(lineEnd + newline.length)
    let itemHeader: { length?: unknown; type?: unknown }
    try {
      itemHeader = JSON.parse(itemHeaderText) as { length?: unknown; type?: unknown }
    } catch {
      out.push(itemHeaderText)
      if (rest) out.push(rest)
      break
    }
    const length = typeof itemHeader.length === 'number' ? itemHeader.length : null
    let payload: string
    if (length !== null) {
      payload = Buffer.from(rest).subarray(0, length).toString('utf8')
      const consumed = Buffer.byteLength(payload) === length ? length : Buffer.byteLength(rest.slice(0, length))
      rest = rest.slice(consumed)
      if (rest.startsWith(newline)) rest = rest.slice(newline.length)
    } else {
      const payloadEnd = rest.indexOf(newline)
      payload = payloadEnd < 0 ? rest : rest.slice(0, payloadEnd)
      rest = payloadEnd < 0 ? '' : rest.slice(payloadEnd + newline.length)
    }
    const rewritten = rewriteItem(payload)
    if (typeof itemHeader.length === 'number') itemHeader.length = Buffer.byteLength(rewritten)
    out.push(JSON.stringify(itemHeader))
    out.push(rewritten)
  }
  return out.join(newline)
}

function rewriteItem(payload: string): string {
  try {
    const event = JSON.parse(payload) as Record<string, unknown>
    if (!event || typeof event !== 'object' || Array.isArray(event)) return payload
    delete event.user
    const request = event.request
    if (request && typeof request === 'object') {
      const req = request as { headers?: Record<string, unknown>; env?: unknown; ip?: unknown }
      if (req.headers) {
        req.headers = Object.fromEntries(Object.entries(req.headers).filter(([name]) => !IP_HEADER.test(name)))
      }
      delete req.env
      delete req.ip
    }
    return JSON.stringify(event)
  } catch {
    return payload
  }
}

function readItems(body: string): Record<string, unknown>[] {
  const newline = body.includes('\r\n') ? '\r\n' : '\n'
  const headerEnd = body.indexOf(newline)
  if (headerEnd < 0) return []
  let rest = body.slice(headerEnd + newline.length)
  const items: Record<string, unknown>[] = []
  while (rest.length) {
    const lineEnd = rest.indexOf(newline)
    if (lineEnd < 0) break
    let itemHeader: { length?: unknown }
    try {
      itemHeader = JSON.parse(rest.slice(0, lineEnd)) as { length?: unknown }
    } catch {
      break
    }
    rest = rest.slice(lineEnd + newline.length)
    const length = typeof itemHeader.length === 'number' ? itemHeader.length : null
    let payload: string
    if (length !== null) {
      payload = Buffer.from(rest).subarray(0, length).toString('utf8')
      rest = rest.slice(Buffer.byteLength(payload))
      if (rest.startsWith(newline)) rest = rest.slice(newline.length)
    } else {
      const payloadEnd = rest.indexOf(newline)
      payload = payloadEnd < 0 ? rest : rest.slice(0, payloadEnd)
      rest = payloadEnd < 0 ? '' : rest.slice(payloadEnd + newline.length)
    }
    try {
      const parsed = JSON.parse(payload) as Record<string, unknown>
      if (parsed && typeof parsed === 'object') items.push(parsed)
    } catch {
      // Attachment bytes are not events.
    }
  }
  return items
}
