import { createHmac, timingSafeEqual } from 'node:crypto'

/** Purposes of a parent link. CONFIRM and MANAGE are single-use. SESSION is the manage session those links open. */
export type GuardianLinkPurpose = 'CONFIRM' | 'MANAGE' | 'SESSION'

export interface GuardianLinkClaims {
  userId: string
  purpose: GuardianLinkPurpose
  /** Unix milliseconds. */
  exp: number
  jti: string
}

const PURPOSES: ReadonlySet<string> = new Set(['CONFIRM', 'MANAGE', 'SESSION'])

/**
 * HMAC-SHA256 over the payload, using the server's existing code secret (CODE_HMAC_SECRET). The database stores
 * only the hash of the whole token, so a leak of the table does not reveal a usable link. `exp` is inside the
 * signature: changing the stored expiry cannot extend the link.
 */
export function signGuardianToken(secret: string, claims: GuardianLinkClaims): string {
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url')
  const sig = createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

/** The claims, or null when the signature, shape or purpose is wrong. Expiry is the caller's check. */
export function readGuardianToken(secret: string, token: string): GuardianLinkClaims | null {
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [payload, sig] = parts
  if (!payload || !sig) return null
  const expected = createHmac('sha256', secret).update(payload).digest('base64url')
  const got = Buffer.from(sig)
  const want = Buffer.from(expected)
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null
  try {
    const body = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<GuardianLinkClaims>
    if (!body || typeof body.userId !== 'string' || typeof body.jti !== 'string' || typeof body.exp !== 'number') return null
    if (typeof body.purpose !== 'string' || !PURPOSES.has(body.purpose)) return null
    return { userId: body.userId, purpose: body.purpose, exp: body.exp, jti: body.jti }
  } catch {
    return null
  }
}
