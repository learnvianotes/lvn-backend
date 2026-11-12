import { Inject, Injectable, Logger, Optional } from '@nestjs/common'
import { Errors } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { newId, Prisma, PrismaService } from '@lvn-backend/prisma-base'
import { emailSchema } from '../domain/rules'
import { isStudyPublisher } from '../domain/study-publisher'
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
 * account linking by a provider-verified email (amends ADR-0100). A provider that says the email is verified links
 * to the existing account and marks the login email verified, even when the local email was not confirmed yet. It
 * does not set institution `verifiedAt`. Linking onto an address that was never confirmed drops that account's
 * password and signs it out everywhere: a sign-up that only reserved the address must not stay in beside the person
 * who just proved the inbox. A new provider account still owes its registration details (completeRegistration,
 * ADR-0017); the minimum-age gate runs there (ADR-0109), for Google, GitHub and LinkedIn alike.
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
   * The account behind a provider identity: the one already linked; else the account with the same email when the
   * provider has verified that email, linked now and marked email-verified, without changing its role, name or age.
   * A login email that was already confirmed keeps its password and its sessions. One that was not loses both: the
   * provider is the first proof of the inbox, so a password set at the unconfirmed sign-up cannot remain.
   * A provider that has not verified the email is refused. Two first sign-ins for one email lose to the unique email
   * and (provider, subject) constraints, then retry.
   */
  private async signInWith(identity: ProviderIdentity, device: DeviceInfo, correlationId?: string): Promise<IssuedSession> {
    const key = { provider: identity.provider, providerSubject: identity.providerSubject }
    const linked = await this.db.oAuthAccount.findUnique({ where: { provider_providerSubject: key }, include: { user: { select: { deletedAt: true, email: true } } } })
    if (linked) {
      if (linked.user.deletedAt) throw Errors.forbidden('This account was deleted.')
      if (isStudyPublisher({ id: linked.userId, email: linked.user.email })) throw Errors.forbidden('This account cannot sign in.')
      await this.access.assertAllowed(linked.user.email)
      return this.sessions.start(linked.userId, device)
    }
    if (!identity.email || !identity.emailVerified) {
      throw Errors.validation(`Your ${NAMES[identity.provider]} account has no verified email address. Verify one there, or sign up with email.`)
    }
    const email = parseField(emailSchema, identity.email, 'email')
    // The study publisher is not a person. Do not link a provider to it, and do not open a session, even when the
    // provider and the row both say the address is verified (ADR-0098, ADR-0100).
    if (isStudyPublisher({ email })) throw Errors.forbidden('This account cannot sign in.')
    await this.access.assertAllowed(email)

    const existing = await this.db.user.findUnique({ where: { email }, select: { id: true, email: true, deletedAt: true, emailVerifiedAt: true } })
    if (existing && isStudyPublisher(existing)) throw Errors.forbidden('This account cannot sign in.')
    if (existing) {
      if (existing.deletedAt) throw Errors.forbidden('This account was deleted.')
      // Unconfirmed: the row only reserved the address. The provider is the first proof it belongs to this person.
      const unproven = !existing.emailVerifiedAt
      try {
        await this.db.$transaction(async (tx) => {
          await tx.oAuthAccount.create({ data: { id: newId(), userId: existing.id, ...key } })
          // Login email only: institution verification stays a separate decision.
          if (unproven) await tx.user.update({ where: { id: existing.id }, data: { emailVerifiedAt: new Date(), passwordHash: null } })
        })
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return this.signInWith(identity, device, correlationId)
        throw e
      }
      // After the commit, so a rolled-back link does not sign the account out. The new session is started below.
      if (unproven) await this.sessions.revokeAll(existing.id)
      return this.sessions.start(existing.id, device)
    }

    const id = newId()
    const displayName = (identity.name?.trim() || email.slice(0, email.indexOf('@'))).slice(0, 60)
    const role = (await this.access.roleFor(email)) ?? 'STUDENT'
    try {
      await this.db.$transaction(async (tx) => {
        // freeHandle refuses reserved brand and role handles, same as email sign-up.
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
