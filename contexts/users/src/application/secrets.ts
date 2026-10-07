import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'

/** Bytes as Prisma stores them (`Bytes` columns are plain Uint8Arrays). */
export type Bytes = Uint8Array<ArrayBuffer>
const bytes = (b: Buffer): Bytes => Uint8Array.from(b)

/** A 256-bit random token for links and refresh tokens (base64url, 43 characters). */
export const randomToken = (): string => randomBytes(32).toString('base64url')

/** SHA-256 of a high-entropy token: what the database stores instead of the token (§7.1). */
export const sha256 = (token: string): Bytes => bytes(createHash('sha256').update(token).digest())

/** A 6-digit code, uniformly random. */
export const sixDigitCode = (): string => randomInt(0, 1_000_000).toString().padStart(6, '0')

/** Short codes have little entropy, so they are stored as an HMAC with a server secret, not a plain hash. */
export const hmac = (secret: string, value: string): Bytes => bytes(createHmac('sha256', secret).update(value).digest())

export const sameBytes = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && timingSafeEqual(a, b)
