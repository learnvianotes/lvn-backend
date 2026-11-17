import { Inject, UseGuards } from '@nestjs/common'
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql'
import { CurrentViewer, RequireMfa, SignedInGuard, type RequestContext, type Viewer } from '@lvn-backend/auth-guard'
import { withUserErrors } from '@lvn-backend/errors'
import { AdminService } from '../application/admin.service'
import { InstitutionalEmailService } from '../application/institutional-email.service'
import { OAuthService } from '../application/oauth.service'
import { RegistrationService } from '../application/registration.service'
import { USERS_CONFIG, type UsersConfig } from '../users.config'
import { withInviteError } from './access.resolver'
import { deliverSession, deviceOf, MFA_NONE, mfaFields, refreshCookieOptions, type RefreshCookieOptions } from './session-delivery'
import { UsersService } from '../application/users.service'
import type {
  AuthPayload,
  AuthSettings,
  AuthSettingsPayload,
  MutationCompleteRegistrationArgs,
  MutationOauthExchangeArgs,
  MutationSetGoogleSignInEnabledArgs,
  MutationSetInstitutionalEmailArgs,
  MutationSignInWithGoogleArgs,
  MutationVerifyInstitutionalEmailArgs,
  OkPayload,
  SignInOptions,
} from './schema.types'

@Resolver()
export class RegistrationResolver {
  private readonly cookie: RefreshCookieOptions

  constructor(
    private readonly oauth: OAuthService,
    private readonly registration: RegistrationService,
    private readonly institutional: InstitutionalEmailService,
    private readonly users: UsersService,
    private readonly admin: AdminService,
    @Inject(USERS_CONFIG) config: UsersConfig,
  ) {
    this.cookie = refreshCookieOptions(config.jwtIssuer)
  }

  @Query('signInOptions')
  signInOptions(): Promise<SignInOptions> {
    return this.oauth.options()
  }

  @Query('authSettings')
  @UseGuards(SignedInGuard)
  @RequireMfa()
  authSettings(@CurrentViewer() viewer: Viewer): Promise<AuthSettings> {
    return this.admin.authSettings(viewer.userId)
  }

  @Mutation('setGoogleSignInEnabled')
  @UseGuards(SignedInGuard)
  @RequireMfa()
  setGoogleSignInEnabled(@Args() { input }: MutationSetGoogleSignInEnabledArgs, @CurrentViewer() viewer: Viewer): Promise<AuthSettingsPayload> {
    return withUserErrors<AuthSettingsPayload>(async () => ({ settings: await this.admin.setGoogleSignInEnabled(viewer.userId, input.enabled) }), { settings: null })
  }

  @Mutation('signInWithGoogle')
  signInWithGoogle(@Args() { input }: MutationSignInWithGoogleArgs, @Context() ctx: RequestContext): Promise<AuthPayload> {
    return withInviteError<AuthPayload>(async () => {
      const issued = await this.oauth.signInWithGoogle(input.idToken, deviceOf(ctx), ctx.requestId)
      return { session: await deliverSession(ctx, this.cookie, this.users, issued), emailLinkPending: false, ...mfaFields(issued) }
    }, { session: null, emailLinkPending: false, ...MFA_NONE })
  }

  @Mutation('oauthExchange')
  oauthExchange(@Args() { input }: MutationOauthExchangeArgs, @Context() ctx: RequestContext): Promise<AuthPayload> {
    return withInviteError<AuthPayload>(async () => {
      const issued = await this.oauth.exchange(input.provider, input, deviceOf(ctx), ctx.requestId)
      return { session: await deliverSession(ctx, this.cookie, this.users, issued), emailLinkPending: false, ...mfaFields(issued) }
    }, { session: null, emailLinkPending: false, ...MFA_NONE })
  }

  @Mutation('completeRegistration')
  @UseGuards(SignedInGuard)
  completeRegistration(@Args() { input }: MutationCompleteRegistrationArgs, @CurrentViewer() viewer: Viewer, @Context() ctx: RequestContext): Promise<OkPayload> {
    return withUserErrors<OkPayload>(async () => {
      await this.registration.complete(viewer.userId, input, ctx.req.ip)
      return { ok: true }
    }, { ok: false })
  }

  @Mutation('setInstitutionalEmail')
  @UseGuards(SignedInGuard)
  setInstitutionalEmail(@Args() { input }: MutationSetInstitutionalEmailArgs, @CurrentViewer() viewer: Viewer, @Context() ctx: RequestContext): Promise<OkPayload> {
    return withUserErrors<OkPayload>(async () => {
      await this.institutional.start(viewer.userId, input.email, ['input', 'email'], ctx.req.ip)
      return { ok: true }
    }, { ok: false })
  }

  @Mutation('verifyInstitutionalEmail')
  @UseGuards(SignedInGuard)
  verifyInstitutionalEmail(@Args() { input }: MutationVerifyInstitutionalEmailArgs, @CurrentViewer() viewer: Viewer): Promise<OkPayload> {
    return withUserErrors<OkPayload>(async () => {
      await this.institutional.verify(viewer.userId, input.code)
      return { ok: true }
    }, { ok: false })
  }

  @Mutation('resendInstitutionalEmailCode')
  @UseGuards(SignedInGuard)
  resendInstitutionalEmailCode(@CurrentViewer() viewer: Viewer, @Context() ctx: RequestContext): Promise<OkPayload> {
    return withUserErrors<OkPayload>(async () => {
      await this.institutional.resend(viewer.userId, ctx.req.ip)
      return { ok: true }
    }, { ok: false })
  }
}
