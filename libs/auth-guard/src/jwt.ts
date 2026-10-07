import { createPrivateKey, createPublicKey, sign, verify, type KeyObject } from 'node:crypto'
import type { GlobalRole } from '@lvn/contracts/domain'

/**
 * Access tokens (§7.1): RS256 JWTs valid for 15 minutes with the claims `sub` (user id), `sid` (session family id) and
 * `roles`. Implemented on node:crypto — RS256 is RSASSA-PKCS1-v1_5 with SHA-256 — so every process verifies tokens
 * the same way with no extra dependency. Only the API holds the private key.
 */

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60
const CLOCK_SKEW_SECONDS = 5

export interface AccessClaims {
  sub: string
  sid: string
  roles: GlobalRole[]
  iss: string
  aud: string
  iat: number
  exp: number
}

const b64url = (data: Buffer | string) => Buffer.from(data).toString('base64url')
const HEADER = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))

export class AccessTokenSigner {
  private readonly key: KeyObject
  constructor(privateKeyPem: string, private readonly issuer: string, private readonly audience: string) {
    this.key = createPrivateKey(privateKeyPem)
    if (this.key.asymmetricKeyType !== 'rsa') throw new Error('JWT_PRIVATE_KEY must be an RSA key')
  }

  sign(subject: { userId: string; sessionId: string; roles: GlobalRole[] }, now = Math.floor(Date.now() / 1000)): { token: string; expiresAt: Date } {
    const claims: AccessClaims = {
      sub: subject.userId,
      sid: subject.sessionId,
      roles: subject.roles,
      iss: this.issuer,
      aud: this.audience,
      iat: now,
      exp: now + ACCESS_TOKEN_TTL_SECONDS,
    }
    const input = `${HEADER}.${b64url(JSON.stringify(claims))}`
    const signature = sign('sha256', Buffer.from(input), this.key)
    return { token: `${input}.${b64url(signature)}`, expiresAt: new Date(claims.exp * 1000) }
  }
}

export type VerifyResult = { ok: true; claims: AccessClaims } | { ok: false; reason: 'malformed' | 'signature' | 'expired' | 'claims' }

export class AccessTokenVerifier {
  private readonly key: KeyObject
  constructor(publicKeyPem: string, private readonly issuer: string, private readonly audience: string) {
    this.key = createPublicKey(publicKeyPem)
  }

  verify(token: string, now = Math.floor(Date.now() / 1000)): VerifyResult {
    const parts = token.split('.')
    if (parts.length !== 3 || parts.some((p) => !/^[A-Za-z0-9_-]+$/.test(p))) return { ok: false, reason: 'malformed' }
    const [header, payload, signature] = parts as [string, string, string]
    let head: unknown
    let claims: Partial<AccessClaims>
    try {
      head = JSON.parse(Buffer.from(header, 'base64url').toString('utf8'))
      claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<AccessClaims>
    } catch {
      return { ok: false, reason: 'malformed' }
    }
    // Only RS256 is ever accepted: no "none", no HMAC confusion with the public key.
    if (!head || typeof head !== 'object' || (head as { alg?: unknown }).alg !== 'RS256') return { ok: false, reason: 'malformed' }
    if (!verify('sha256', Buffer.from(`${header}.${payload}`), this.key, Buffer.from(signature, 'base64url'))) {
      return { ok: false, reason: 'signature' }
    }
    if (claims.iss !== this.issuer || claims.aud !== this.audience) return { ok: false, reason: 'claims' }
    if (typeof claims.sub !== 'string' || typeof claims.sid !== 'string' || !Array.isArray(claims.roles)) return { ok: false, reason: 'claims' }
    if (typeof claims.exp !== 'number' || typeof claims.iat !== 'number') return { ok: false, reason: 'claims' }
    if (claims.iat > now + CLOCK_SKEW_SECONDS) return { ok: false, reason: 'claims' }
    if (claims.exp <= now - CLOCK_SKEW_SECONDS) return { ok: false, reason: 'expired' }
    return { ok: true, claims: claims as AccessClaims }
  }
}
