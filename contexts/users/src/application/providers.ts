import { resolveMx } from 'node:dns/promises'
import { Logger } from '@nestjs/common'
import { initializeApp, type App } from 'firebase-admin/app'

const googleLog = new Logger('GoogleSignIn')

/** What a sign-in provider proved about the person. `providerSubject` is the stable id at that provider. */
export interface ProviderIdentity {
  provider: 'GOOGLE' | 'GITHUB' | 'LINKEDIN'
  providerSubject: string
  email: string | null
  emailVerified: boolean
  name: string | null
}

/** The claims from Firebase `verifyIdToken` that decide whether a Google sign-in can be linked (ADR-0007, ADR-0100). */
export interface GoogleTokenClaims {
  uid: string
  email?: string
  email_verified?: boolean
  name?: unknown
  firebase?: { sign_in_provider?: string; identities?: { email?: unknown } }
}

function googleEmail(t: GoogleTokenClaims): string | null {
  if (typeof t.email === 'string' && t.email.trim() !== '') return t.email
  const listed = t.firebase?.identities?.email
  const first = Array.isArray(listed) ? listed[0] : null
  return typeof first === 'string' && first.trim() !== '' ? first : null
}

/**
 * A Google sign-in. `emailVerified` is true only when Firebase says `email_verified === true` (the string `"true"`
 * is not enough). Null when the token is not a Google sign-in or has no email. An unverified email is still an
 * identity, so the caller can refuse it without looking like a forged token.
 */
export function identityFromGoogleClaims(t: GoogleTokenClaims): ProviderIdentity | null {
  const email = googleEmail(t)
  if (t.firebase?.sign_in_provider !== 'google.com' || !email) return null
  return { provider: 'GOOGLE', providerSubject: t.uid, email, emailVerified: t.email_verified === true, name: typeof t.name === 'string' ? t.name : null }
}

/** Verifies a Firebase ID token from Google sign-in (ADR-0007). Bound to Firebase in production, a fake in tests. */
export const GOOGLE_ID_TOKENS = Symbol('GOOGLE_ID_TOKENS')
export interface GoogleIdTokens {
  verify(idToken: string): Promise<ProviderIdentity | null>
}

export class FirebaseGoogleIdTokens implements GoogleIdTokens {
  private readonly app: App
  constructor(projectId: string) {
    this.app = initializeApp({ projectId }, `lvn-google-${projectId}`)
  }

  /** A verified Google ID token, or null. The token itself is never logged. */
  async verify(idToken: string): Promise<ProviderIdentity | null> {
    try {
      // Loaded on first use: firebase-admin/auth pulls in an ES-module-only dependency (jose).
      const { getAuth } = await import('firebase-admin/auth')
      const t = await getAuth(this.app).verifyIdToken(idToken)
      return identityFromGoogleClaims(t)
    } catch (err) {
      const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : err instanceof Error ? err.name : 'unknown'
      googleLog.warn(`Google ID token was rejected (${code})`)
      return null
    }
  }
}

/** Does a mail domain accept mail? (ADR-0017). Bound to DNS in production, a fake in tests. */
export const MX_LOOKUP = Symbol('MX_LOOKUP')
export interface MxLookup {
  acceptsMail(domain: string): Promise<boolean>
}

export class DnsMxLookup implements MxLookup {
  private readonly log = new Logger('MxLookup')
  async acceptsMail(domain: string): Promise<boolean> {
    try {
      return (await resolveMx(domain)).length > 0
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (code === 'ENOTFOUND' || code === 'ENODATA' || code === 'ESERVFAIL') return false
      // A DNS outage must not block registration; the code email will simply not arrive.
      this.log.warn(`MX lookup failed for ${domain}: ${code ?? String(err)}`)
      return true
    }
  }
}
