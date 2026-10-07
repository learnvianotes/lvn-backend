import { randomBytes } from 'node:crypto'

let lastMs = 0
let seq = 0

/**
 * A UUIDv7 (RFC 9562): 48-bit Unix milliseconds, then randomness, so ids sort by creation time (spec §4.6).
 * Within one millisecond a 12-bit counter in `rand_a` keeps ids from this process strictly increasing.
 */
export function newId(now: number = Date.now()): string {
  if (now > lastMs) {
    lastMs = now
    seq = randomBytes(2).readUInt16BE(0) & 0x7ff // start low so the counter rarely overflows
  } else {
    seq++
    if (seq > 0xfff) {
      lastMs++ // counter exhausted: borrow the next millisecond, still monotonic
      seq = 0
    }
  }
  const b = randomBytes(16)
  b.writeUIntBE(lastMs, 0, 6)
  b[6] = 0x70 | (seq >> 8)
  b[7] = seq & 0xff
  b[8] = 0x80 | (b[8]! & 0x3f)
  const h = b.toString('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** True for a well-formed UUID; use before passing client input to a `@db.Uuid` column. */
export const isUuid = (value: string): boolean => UUID.test(value)

/** The creation time encoded in a UUIDv7. */
export const idTime = (id: string): Date => new Date(parseInt(id.replace(/-/g, '').slice(0, 12), 16))
