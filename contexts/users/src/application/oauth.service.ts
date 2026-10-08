import { Inject, Injectable, Logger, Optional } from '@nestjs/common'
import { Errors } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { newId, Prisma, PrismaService } from '@lvn-backend/prisma-base'
import { USERS_CONFIG, type UsersConfig } from '../users.config'
import { freeHandle } from './handles'
import { githubIdentity, linkedinIdentity, type CodeExchange } from './oauth-clients'
import { GOOGLE_ID_TOKENS, type GoogleIdTokens, type ProviderIdentity } from './providers'
import { SessionService, type DeviceInfo, type IssuedSession } from './session.service'

const NAMES = { GOOGLE: 'Google', GITHUB: 'GitHub', LINKEDIN: 'LinkedIn' } as const

/**
 * Sign-in with Google (Firebase ID token, ADR-0007), GitHub and LinkedIn (Authorization Code + PKCE, §7.1), and
 * account linking by verified email only. A new provider account still owes its registration details
 * (completeRegistration, ADR-0017).
 */
@Injectable()
export class OAuthService {
  private readonly log = new Logger('OAuth')

  constructor(
    private readonly db: PrismaService,
    private readonly sessions: SessionService,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(USERS_CONFIG) private readonly config: UsersConfig,
    @Optional() @Inject(GOOGLE_ID_TOKENS) private readonly google: GoogleIdTokens | null,
  ) {}

  /** Which sign-in methods this deployment offers (clients show only those buttons). */
  options() {
    return { emailPassword: true, google: !!this.google, github: !!this.config.github, linkedin: !!this.config.linkedin }
  }

  async signInWithGoogle(idToken: string, device: DeviceInfo, correlationId?: string): Promise<IssuedSession> {
    if (!this.google) throw Errors.validation('Google sign-in is not available here.')
    const identity = await this.google.verify(idToken)
    if (!identity) throw Errors.unauthenticated('Google sign-in could not be verified. Try again.')
    return this.signInWith(identity, device, correlationId)
  }

  async exchange(provider: 'GITHUB' | 'LINKEDIN', x: CodeExchange, device: DeviceInfo, correlationId?: string): Promise<IssuedSession> {
    const app = provider === 'GITHUB' ? this.config.github : this.config.linkedin
    if (!app) throw Errors.validation(`${NAMES[provider]} sign-in is not available here.`, ['input', 'provider'])
    if (!this.config.oauthRedirectUris.includes(x.redirectUri)) throw Errors.validation('This redirect URI is not allowed.', ['input', 'redirectUri'])
    if (!/^[A-Za-z0-9._~-]{43,128}$/.test(x.codeVerifier)) throw Errors.validation('Invalid PKCE code verifier.', ['input', 'codeVerifier'])
    let identity: ProviderIdentity
    try {
      identity = provider === 'GITHUB' ? await githubIdentity(app, x) : await linkedinIdentity(app, x)
    } catch (err) {
      this.log.warn(`${provider} exchange failed: ${err instanceof Error ? err.message : String(err)}`)
      throw Errors.unauthenticated(`${NAMES[provider]} sign-in failed. Try again.`)
    }
    return this.signInWith(identity, device, correlationId)
  }

  /**
   * The account behind a provider identity: the one already linked; else the account with the same email, linked now
   * because the provider verified that email; else a new account.
   */
  private async signInWith(identity: ProviderIdentity, device: DeviceInfo, correlationId?: string): Promise<IssuedSession> {
    const key = { provider: identity.provider, providerUserId: identity.providerUserId }
    const linked = await this.db.oAuthAccount.findUnique({ where: { provider_providerUserId: key }, include: { user: { select: { deletedAt: true } } } })
    if (linked) {
      if (linked.user.deletedAt) throw Errors.forbidden('This account was deleted.')
      return this.sessions.start(linked.userId, device)
    }
    if (!identity.email || !identity.emailVerified) {
      throw Errors.validation(`Your ${NAMES[identity.provider]} account has no verified email address. Verify one there, or sign up with email.`)
    }
    const email = identity.email.toLowerCase()

    const existing = await this.db.user.findUnique({ where: { email }, select: { id: true, deletedAt: true, emailVerifiedAt: true, passwordHash: true } })
    if (existing) {
      if (existing.deletedAt) throw Errors.forbidden('This account was deleted.')
      // An unverified password on this email may have been set by someone who does not own the inbox (account
      // pre-hijacking): the provider has now proved ownership, so that password and its sessions are dropped.
      const dropPassword = !existing.emailVerifiedAt && existing.passwordHash !== null
      await this.db.$transaction([
        this.db.user.update({
          where: { id: existing.id },
          data: { emailVerifiedAt: existing.emailVerifiedAt ?? new Date(), ...(dropPassword ? { passwordHash: null } : {}) },
        }),
        this.db.oAuthAccount.create({ data: { id: newId(), userId: existing.id, ...key } }),
      ])
      if (dropPassword) await this.sessions.revokeAll(existing.id)
      return this.sessions.start(existing.id, device)
    }

    const id = newId()
    const displayName = (identity.name?.trim() || email.slice(0, email.indexOf('@'))).slice(0, 60)
    try {
      await this.db.$transaction(async (tx) => {
        await tx.user.create({ data: { id, email, handle: await freeHandle(tx, displayName), displayName, emailVerifiedAt: new Date() } })
        await tx.oAuthAccount.create({ data: { id: newId(), userId: id, ...key } })
      })
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return this.signInWith(identity, device, correlationId)
      throw e
    }
    await this.events.publish('UserRegistered', { userId: id }, { correlationId })
    return this.sessions.start(id, device)
  }
}
