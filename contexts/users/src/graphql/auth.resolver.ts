import { Inject, UseGuards } from '@nestjs/common'
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql'
import { CurrentViewer, requireViewer, SignedInGuard, type RequestContext, type Viewer } from '@lvn-backend/auth-guard'
import { Errors, withUserErrors } from '@lvn-backend/errors'
import { AppSettingsService } from '../application/app-settings.service'
import { AuthService } from '../application/auth.service'
import { withInviteError } from './access.resolver'
import { SessionService } from '../application/session.service'
import { UsersService } from '../application/users.service'
import { TermsVersionProvider } from '../application/terms-version.provider'
import { USERS_CONFIG, type UsersConfig } from '../users.config'
import { deliverSession, deviceOf, MFA_NONE, mfaFields, REFRESH_COOKIE, refreshCookieOptions, type RefreshCookieOptions } from './session-delivery'
import type {
  AuthPayload,
  MutationRefreshSessionArgs,
  MutationRequestPasswordResetArgs,
  MutationResetPasswordArgs,
  MutationSignInArgs,
  MutationSignUpArgs,
  MutationVerifyEmailArgs,
  OkPayload,
  VerifyEmailPayload,
} from './schema.types'

@Resolver()
export class AuthResolver {
  private readonly cookie: RefreshCookieOptions

  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    private readonly users: UsersService,
    private readonly settings: AppSettingsService,
    @Inject(USERS_CONFIG) config: UsersConfig,
    private readonly terms: TermsVersionProvider,
  ) {
    this.cookie = refreshCookieOptions(config.jwtIssuer)
  }

  /** ADR-0103: the admin setting, else TERMS_VERSION, else the built-in default. */
  @Query('termsVersion')
  termsVersion(): string {
    return this.terms.current()
  }

  /** ADR-0113: at least 13. The admin setting when it is 13 or higher, otherwise 13. A lower saved row is not rewritten. */
  @Query('accountMinimumAge')
  accountMinimumAge(): number {
    return this.settings.minimumAge()
  }

  @Query('unverifiedGatedActions')
  unverifiedGatedActions(): string[] {
    return this.settings.unverifiedGatedActions()
  }

  @Query('publicNotesRequireVerification')
  publicNotesRequireVerification(): boolean {
    return this.settings.publicNotesRequireVerification()
  }

  @Mutation('signUp')
  signUp(@Args() { input }: MutationSignUpArgs, @Context() ctx: RequestContext): Promise<AuthPayload> {
    return withInviteError<AuthPayload>(async () => {
      const result = await this.auth.signUp(input, deviceOf(ctx), ctx.requestId, ctx.req.ip)
      if (result.status === 'emailLinkPending') return { session: null, emailLinkPending: true, ...MFA_NONE }
      const session = result.session
      return { session: await deliverSession(ctx, this.cookie, this.users, session), emailLinkPending: false, ...mfaFields(session) }
    }, { session: null, emailLinkPending: false, ...MFA_NONE })
  }

  @Mutation('signIn')
  signIn(@Args() { input }: MutationSignInArgs, @Context() ctx: RequestContext): Promise<AuthPayload> {
    return withInviteError<AuthPayload>(async () => {
      const issued = await this.auth.signIn(input.email, input.password, deviceOf(ctx), ctx.req.ip)
      return { session: await deliverSession(ctx, this.cookie, this.users, issued), emailLinkPending: false, ...mfaFields(issued) }
    }, { session: null, emailLinkPending: false, ...MFA_NONE })
  }

  @Mutation('refreshSession')
  async refreshSession(@Args() { input }: MutationRefreshSessionArgs, @Context() ctx: RequestContext): Promise<AuthPayload> {
    const token = input.refreshToken ?? ctx.req.cookies?.[REFRESH_COOKIE]
    if (!token) throw Errors.unauthenticated('Your session has ended. Sign in again.')
    try {
      const issued = await this.sessions.refresh(token)
      return { session: await deliverSession(ctx, this.cookie, this.users, issued), emailLinkPending: false, ...mfaFields(issued), userErrors: [] }
    } catch (e) {
      if (!input.refreshToken) ctx.res.clearCookie(REFRESH_COOKIE, this.cookie)
      throw e
    }
  }

  @Mutation('signOut')
  async signOut(@Context() ctx: RequestContext): Promise<OkPayload> {
    const cookie = ctx.req.cookies?.[REFRESH_COOKIE]
    if (ctx.viewer) {
      await this.sessions.revokeFamily(ctx.viewer.sessionId, ctx.viewer.userId)
    } else if (cookie) {
      const family = await this.sessions.familyOf(cookie)
      if (family) await this.sessions.revokeFamily(family.familyId, family.userId)
    } else {
      requireViewer(null)
    }
    ctx.res.clearCookie(REFRESH_COOKIE, this.cookie)
    return { ok: true, userErrors: [] }
  }

  @Mutation('verifyEmail')
  verifyEmail(@Args() { input }: MutationVerifyEmailArgs): Promise<VerifyEmailPayload> {
    return withInviteError<VerifyEmailPayload>(async () => {
      const { userId } = await this.auth.verifyEmail(input.token)
      return { ok: true, user: await this.users.viewerProfile(userId) }
    }, { ok: false, user: null })
  }

  @Mutation('resendVerification')
  @UseGuards(SignedInGuard)
  resendVerification(@CurrentViewer() viewer: Viewer): Promise<OkPayload> {
    return withInviteError<OkPayload>(async () => {
      await this.auth.resendVerification(viewer.userId)
      return { ok: true }
    }, { ok: false })
  }

  @Mutation('requestPasswordReset')
  requestPasswordReset(@Args() { input }: MutationRequestPasswordResetArgs, @Context() ctx: RequestContext): Promise<OkPayload> {
    return withUserErrors<OkPayload>(async () => {
      await this.auth.requestPasswordReset(input.email, ctx.req.ip)
      return { ok: true }
    }, { ok: false })
  }

  @Mutation('resetPassword')
  resetPassword(@Args() { input }: MutationResetPasswordArgs): Promise<OkPayload> {
    return withUserErrors<OkPayload>(async () => {
      await this.auth.resetPassword(input.token, input.password)
      return { ok: true }
    }, { ok: false })
  }
}
