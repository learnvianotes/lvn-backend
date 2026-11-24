import { Inject, UseGuards } from '@nestjs/common'
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type RequestContext, type Viewer } from '@lvn-backend/auth-guard'
import { withUserErrors } from '@lvn-backend/errors'
import { PasskeyService } from '../application/passkey.service'
import { SignInCodeService } from '../application/sign-in-code.service'
import { UsersService } from '../application/users.service'
import { USERS_CONFIG, type UsersConfig } from '../users.config'
import { withInviteError } from './access.resolver'
import { deliverSession, deviceOf, MFA_NONE, mfaFields, refreshCookieOptions, type RefreshCookieOptions } from './session-delivery'
import type {
  AuthPayload,
  MutationFinishPasskeyRegistrationArgs,
  MutationFinishPasskeySignInArgs,
  MutationRemovePasskeyArgs,
  MutationRenamePasskeyArgs,
  MutationRequestSignInCodeArgs,
  MutationSignInWithCodeArgs,
  OkPayload,
  Passkey,
  PasskeyPayload,
  PasskeyRegistrationStart,
  PasskeySignInStart,
} from './schema.types'

/** Sign in with an emailed code or a passkey, and manage this account's passkeys (ADR-0115). */
@Resolver()
export class SignInMethodsResolver {
  private readonly cookie: RefreshCookieOptions

  constructor(
    private readonly codes: SignInCodeService,
    private readonly passkeys: PasskeyService,
    private readonly users: UsersService,
    @Inject(USERS_CONFIG) config: UsersConfig,
  ) {
    this.cookie = refreshCookieOptions(config.jwtIssuer)
  }

  @Mutation('requestSignInCode')
  requestSignInCode(@Args() { input }: MutationRequestSignInCodeArgs, @Context() ctx: RequestContext): Promise<OkPayload> {
    return withInviteError<OkPayload>(async () => {
      await this.codes.request(input.email, ctx.req.ip)
      return { ok: true, userErrors: [] }
    }, { ok: false })
  }

  @Mutation('signInWithCode')
  signInWithCode(@Args() { input }: MutationSignInWithCodeArgs, @Context() ctx: RequestContext): Promise<AuthPayload> {
    return withInviteError<AuthPayload>(async () => {
      const issued = await this.codes.signIn(input.email, input.code, deviceOf(ctx), ctx.req.ip)
      return { session: await deliverSession(ctx, this.cookie, this.users, issued), emailLinkPending: false, ...mfaFields(issued) }
    }, { session: null, emailLinkPending: false, ...MFA_NONE })
  }

  @Mutation('startPasskeySignIn')
  startPasskeySignIn(@Context() ctx: RequestContext): Promise<PasskeySignInStart> {
    return this.passkeys.startSignIn(ctx.req.ip)
  }

  @Mutation('finishPasskeySignIn')
  finishPasskeySignIn(@Args() { input }: MutationFinishPasskeySignInArgs, @Context() ctx: RequestContext): Promise<AuthPayload> {
    return withInviteError<AuthPayload>(async () => {
      const issued = await this.passkeys.finishSignIn(input.attemptId, input.responseJson, deviceOf(ctx), ctx.req.ip)
      return { session: await deliverSession(ctx, this.cookie, this.users, issued), emailLinkPending: false, ...mfaFields(issued) }
    }, { session: null, emailLinkPending: false, ...MFA_NONE })
  }

  @Query('myPasskeys')
  @UseGuards(SignedInGuard)
  myPasskeys(@CurrentViewer() viewer: Viewer): Promise<Passkey[]> {
    return this.passkeys.list(viewer.userId)
  }

  @Mutation('startPasskeyRegistration')
  @UseGuards(SignedInGuard)
  async startPasskeyRegistration(@CurrentViewer() viewer: Viewer): Promise<PasskeyRegistrationStart> {
    return { optionsJson: await this.passkeys.startRegistration(viewer.userId) }
  }

  @Mutation('finishPasskeyRegistration')
  @UseGuards(SignedInGuard)
  finishPasskeyRegistration(@CurrentViewer() viewer: Viewer, @Args() { input }: MutationFinishPasskeyRegistrationArgs): Promise<PasskeyPayload> {
    return withUserErrors<PasskeyPayload>(async () => ({ passkey: await this.passkeys.finishRegistration(viewer.userId, input.responseJson, input.name ?? ''), userErrors: [] }), { passkey: null })
  }

  @Mutation('renamePasskey')
  @UseGuards(SignedInGuard)
  renamePasskey(@CurrentViewer() viewer: Viewer, @Args() { input }: MutationRenamePasskeyArgs): Promise<PasskeyPayload> {
    return withUserErrors<PasskeyPayload>(async () => ({ passkey: await this.passkeys.rename(viewer.userId, input.id, input.name), userErrors: [] }), { passkey: null })
  }

  @Mutation('removePasskey')
  @UseGuards(SignedInGuard)
  removePasskey(@CurrentViewer() viewer: Viewer, @Args() { id }: MutationRemovePasskeyArgs): Promise<OkPayload> {
    return withUserErrors<OkPayload>(async () => {
      await this.passkeys.remove(viewer.userId, id)
      return { ok: true, userErrors: [] }
    }, { ok: false })
  }
}
