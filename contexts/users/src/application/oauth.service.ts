import { Inject, Injectable, Logger, Optional } from '@nestjs/common'
import { Errors } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { newId, Prisma, PrismaService } from '@lvn-backend/prisma-base'
import { emailSchema } from '../domain/rules'
import { USERS_CONFIG, type UsersConfig } from '../users.config'
import { freeHandle } from './handles'
import { parseField } from './input'
import { githubIdentity, linkedinIdentity, type CodeExchange } from './oauth-clients'
import { GOOGLE_ID_TOKENS, type GoogleIdTokens, type ProviderIdentity } from './providers'
import { AccessGate } from './access-gate'
import { AppSettingsService } from './app-settings.service'
import { LegacyService } from './legacy.service'
import { SessionService, type DeviceInfo, type IssuedSession } from './session.service'

const NAMES = { GOOGLE: 'Google', GITHUB: 'GitHub', LINKEDIN: 'LinkedIn' } as const

/**
 * Sign-in with Google (Firebase ID token, ADR-0007), GitHub and LinkedIn (Authorization Code + PKCE, §7.1), and
 * account linking by verified email only (ADR-0100). A provider is linked to an existing account only when both the
 * provider and that account have verified the same email. A new provider account still owes its registration details
 * (completeRegistration, ADR-0017); the adults-only gate runs there (ADR-0091).
 */
@Injectable()
export class OAuthService {
  private readonly log = new Logger('OAuth')

  constructor(
    private readonly db: PrismaService,
    private readonly sessions: SessionService,
    private readonly legacy: LegacyService,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    private readonly settings: AppSettingsService,
    private readonly access: AccessGate,
    @Inject(USERS_CONFIG) private readonly config: UsersConfig,
    @Optional() @Inject(GOOGLE_ID_TOKENS) private readonly google: GoogleIdTokens | null,
  ) {}

  /** Which sign-in methods this deployment offers (clients show only those buttons). */
  async options() {
    return { emailPassword: true, google: await this.googleOffered(), github: !!this.config.github, linkedin: !!this.config.linkedin }
  }

  /** Google is offered only when Firebase is configured and a platform admin has left the switch on (ADR-0100). */
  private async googleOffered(): Promise<boolean> {
    if (!this.config.firebaseProjectId || !this.google) return false
    return this.settings.googleSignInEnabled()
  }

  async signInWithGoogle(idToken: string, device: DeviceInfo, correlationId?: string): Promise<IssuedSession> {
    if (!(await this.googleOffered())) throw Errors.validation('Google sign-in is not available here.')
    const identity = await this.google!.verify(idToken)
    if (!identity) throw Errors.unauthenticated('Google sign-in could not be verified. Try again.')
    const session = await this.signInWith(identity, device, correlationId)
    // Google sign-in carries the old site's Firebase UID (ADR-0023).
    await this.legacy.match(session.userId, { firebaseUid: identity.providerSubject, verifiedEmail: identity.email ?? undefined })
    return session
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
   * The account behind a provider identity: the one already linked; else the account whose verified email matches,
   * linked now without changing its password, role or sessions; else a new account. An account whose email is not
   * verified is left alone (ADR-0100) — linking it would hand a provider sign-in to whoever registered the address.
   */
  private async signInWith(identity: ProviderIdentity, device: DeviceInfo, correlationId?: string): Promise<IssuedSession> {
    const key = { provider: identity.provider, providerSubject: identity.providerSubject }
    const linked = await this.db.oAuthAccount.findUnique({ where: { provider_providerSubject: key }, include: { user: { select: { deletedAt: true } } } })
    if (linked) {
      if (linked.user.deletedAt) throw Errors.forbidden('This account was deleted.')
      const account = await this.db.user.findUnique({ where: { id: linked.userId }, select: { email: true } })
      if (!account) throw Errors.forbidden('This account was deleted.')
      await this.access.assertAllowed(account.email)
      return this.sessions.start(linked.userId, device)
    }
    if (!identity.email || !identity.emailVerified) {
      throw Errors.validation(`Your ${NAMES[identity.provider]} account has no verified email address. Verify one there, or sign up with email.`)
    }
    const email = parseField(emailSchema, identity.email, 'email')
    await this.access.assertAllowed(email)

    const existing = await this.db.user.findUnique({ where: { email }, select: { id: true, deletedAt: true, emailVerifiedAt: true } })
    if (existing) {
      if (existing.deletedAt) throw Errors.forbidden('This account was deleted.')
      if (!existing.emailVerifiedAt) {
        throw Errors.validation(
          `An account with this email is not verified yet. Confirm it from the email we sent, then try ${NAMES[identity.provider]} again.`,
        )
      }
      try {
        await this.db.oAuthAccount.create({ data: { id: newId(), userId: existing.id, ...key } })
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return this.signInWith(identity, device, correlationId)
        throw e
      }
      return this.sessions.start(existing.id, device)
    }

    const id = newId()
    const displayName = (identity.name?.trim() || email.slice(0, email.indexOf('@'))).slice(0, 60)
    const role = (await this.access.roleFor(email)) ?? 'STUDENT'
    try {
      await this.db.$transaction(async (tx) => {
        await tx.user.create({ data: { id, email, handle: await freeHandle(tx, displayName), displayName, emailVerifiedAt: new Date(), globalRole: role } })
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
