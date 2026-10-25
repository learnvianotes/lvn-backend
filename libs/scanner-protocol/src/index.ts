import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { createReadStream } from 'node:fs'

/** Headers of a signed scanner request (ADR-0102). Names are lowercase, as Node presents them. */
export const SCAN_HEADERS = {
  timestamp: 'x-lvn-timestamp',
  nonce: 'x-lvn-nonce',
  sha256: 'x-lvn-content-sha256',
  signature: 'x-lvn-signature',
  mime: 'x-lvn-mime',
} as const

/** SHA-256 of an empty body. Health checks sign this. */
export const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

const TIMESTAMP = /^\d{1,12}$/
const NONCE = /^[A-Za-z0-9_-]{16,128}$/
const SHA256 = /^[a-f0-9]{64}$/
const LENGTH = /^\d{1,15}$/
const MIME = /^[a-z0-9][a-z0-9!#$&^_.+-]{0,80}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,80}$/
const SIGNATURE = /^[a-f0-9]{64}$/

export interface SignedFields {
  timestamp: string
  nonce: string
  sha256: string
  contentLength: string
  mime: string
}

export interface SignedRequest extends SignedFields {
  signature: string
}

/** The bytes HMAC-SHA256 covers. Field order is fixed; a newline inside a field is rejected before this is built. */
export function canonicalString(fields: SignedFields): string {
  assertFields(fields)
  return `LVN-SCAN-1\n${fields.timestamp}\n${fields.nonce}\n${fields.sha256}\n${fields.contentLength}\n${fields.mime}\n`
}

export function sign(secret: string, fields: SignedFields): string {
  return createHmac('sha256', secret).update(canonicalString(fields)).digest('hex')
}

/** Constant-time check of a request's signature. A malformed field is a mismatch, not a throw. */
export function verify(secret: string, request: SignedRequest): boolean {
  if (!SIGNATURE.test(request.signature) || !wellFormed(request)) return false
  const expected = Buffer.from(sign(secret, request))
  const given = Buffer.from(request.signature)
  return expected.length === given.length && timingSafeEqual(expected, given)
}

export function sha256Bytes(bytes: Buffer | Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

export async function sha256File(file: string): Promise<string> {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(file)) hash.update(chunk as Buffer)
  return hash.digest('hex')
}

export type ScanVerdict =
  | { result: 'clean'; pageCount: number | null }
  | { result: 'infected'; signature: string }
  | { result: 'unsafe'; signature: string }

/** The scanner's JSON body. Anything else is refused by the caller. */
export function parseVerdict(body: string): ScanVerdict {
  let json: unknown
  try {
    json = JSON.parse(body) as unknown
  } catch {
    throw new Error('scan service returned malformed JSON')
  }
  if (!json || typeof json !== 'object') throw new Error('scan service returned an empty verdict')
  const record = json as Record<string, unknown>
  if (record.result === 'clean') {
    const pageCount = record.pageCount
    if (pageCount != null && (typeof pageCount !== 'number' || !Number.isInteger(pageCount) || pageCount < 0 || pageCount > 100_000)) {
      throw new Error('scan service returned a bad page count')
    }
    return { result: 'clean', pageCount: typeof pageCount === 'number' ? pageCount : null }
  }
  const signature = typeof record.signature === 'string' ? record.signature.slice(0, 200) : ''
  if ((record.result === 'infected' || record.result === 'unsafe') && signature) return { result: record.result, signature }
  throw new Error('scan service returned an unknown verdict')
}

function wellFormed(fields: SignedFields): boolean {
  return TIMESTAMP.test(fields.timestamp) && NONCE.test(fields.nonce) && SHA256.test(fields.sha256) && LENGTH.test(fields.contentLength) && MIME.test(fields.mime)
}

function assertFields(fields: SignedFields): void {
  if (!wellFormed(fields)) throw new Error('refusing to sign a malformed scan request')
}
