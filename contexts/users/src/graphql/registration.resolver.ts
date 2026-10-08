import { UseGuards } from '@nestjs/common'
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type RequestContext, type Viewer } from '@lvn-backend/auth-guard'
import { withUserErrors } from '@lvn-backend/errors'
import { InstitutionalEmailService } from '../application/institutional-email.service'
import { OAuthService } from '../application/oauth.service'
import { RegistrationService } from '../application/registration.service'
import { deliverSession, deviceOf } from './session-delivery'
import { UsersService } from '../application/users.service'
import type {
  AuthPayload,
  MutationCompleteRegistrationArgs,
  MutationOauthExchangeArgs,
  MutationSetInstitutionalEmailArgs,
  MutationSignInWithGoogleArgs,
  MutationVerifyInstitutionalEmailArgs,
  OkPayload,
  SignInOptions,
} from './schema.types'

@Resolver()
export class RegistrationResolver {
  constructor(
    private readonly oauth: OAuthService,
    private readonly registration: RegistrationService,
    private readonly institutional: InstitutionalEmailService,
    private readonly users: UsersService,
  ) {}

  @Query('signInOptions')
  signInOptions(): SignInOptions {
    return this.oauth.options()
  }

  @Mutation('signInWithGoogle')
  signInWithGoogle(@Args() { input }: MutationSignInWithGoogleArgs, @Context() ctx: RequestContext): Promise<AuthPayload> {
    return withUserErrors<AuthPayload>(async () => ({
      session: await deliverSession(ctx, this.users, await this.oauth.signInWithGoogle(input.idToken, deviceOf(ctx), ctx.requestId)),
    }), { session: null })
  }

  @Mutation('oauthExchange')
  oauthExchange(@Args() { input }: MutationOauthExchangeArgs, @Context() ctx: RequestContext): Promise<AuthPayload> {
    return withUserErrors<AuthPayload>(async () => ({
      session: await deliverSession(ctx, this.users, await this.oauth.exchange(input.provider, input, deviceOf(ctx), ctx.requestId)),
    }), { session: null })
  }

  @Mutation('completeRegistration')
  @UseGuards(SignedInGuard)
  completeRegistration(@Args() { input }: MutationCompleteRegistrationArgs, @CurrentViewer() viewer: Viewer): Promise<OkPayload> {
    return withUserErrors<OkPayload>(async () => {
      await this.registration.complete(viewer.userId, input)
      return { ok: true }
    }, { ok: false })
  }

  @Mutation('setInstitutionalEmail')
  @UseGuards(SignedInGuard)
  setInstitutionalEmail(@Args() { input }: MutationSetInstitutionalEmailArgs, @CurrentViewer() viewer: Viewer): Promise<OkPayload> {
    return withUserErrors<OkPayload>(async () => {
      await this.institutional.start(viewer.userId, input.email, ['input', 'email'])
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
  resendInstitutionalEmailCode(@CurrentViewer() viewer: Viewer): Promise<OkPayload> {
    return withUserErrors<OkPayload>(async () => {
      await this.institutional.resend(viewer.userId)
      return { ok: true }
    }, { ok: false })
  }
}
