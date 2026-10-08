import { resolveMx } from 'node:dns/promises'
import { Logger } from '@nestjs/common'
import { initializeApp, type App } from 'firebase-admin/app'

/** What a sign-in provider proved about the person. */
export interface ProviderIdentity {
  provider: 'GOOGLE' | 'GITHUB' | 'LINKEDIN'
  providerUserId: string
  email: string | null
  emailVerified: boolean
  name: string | null
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

  /** Only Google sign-ins with a verified email are accepted; anything else is null. */
  async verify(idToken: string): Promise<ProviderIdentity | null> {
    try {
      // Loaded on first use: firebase-admin/auth pulls in an ES-module-only dependency (jose).
      const { getAuth } = await import('firebase-admin/auth')
      const t = await getAuth(this.app).verifyIdToken(idToken)
      if (t.firebase.sign_in_provider !== 'google.com' || !t.email || t.email_verified !== true) return null
      return { provider: 'GOOGLE', providerUserId: t.uid, email: t.email, emailVerified: true, name: typeof t.name === 'string' ? t.name : null }
    } catch {
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
