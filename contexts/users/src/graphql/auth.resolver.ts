import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql'
import { requireViewer, type RequestContext } from '@lvn-backend/auth-guard'
import { Errors, withUserErrors } from '@lvn-backend/errors'
import { AuthService } from '../application/auth.service'
import { SessionService, type DeviceInfo, type IssuedSession } from '../application/session.service'
import { UsersService } from '../application/users.service'
import { TERMS_VERSION } from '../domain/rules'
import type {
  AuthPayload,
  MutationRefreshSessionArgs,
  MutationRequestPasswordResetArgs,
  MutationResetPasswordArgs,
  MutationSignInArgs,
  MutationSignUpArgs,
  MutationVerifyEmailArgs,
  OkPayload,
} from './schema.types'

/** The web client's refresh token: HttpOnly, Secure, SameSite=Lax, only ever sent to /graphql (§7.1). */
export const REFRESH_COOKIE = 'lvn_rt'
const cookieOptions = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/graphql' }

const header = (ctx: RequestContext, name: string): string | undefined => {
  const v = ctx.req.headers[name]
  return Array.isArray(v) ? v[0] : v
}

/** Mobile identifies itself; everyone else is treated as a browser and gets the cookie. */
const deviceOf = (ctx: RequestContext): DeviceInfo => ({
  client: header(ctx, 'x-lvn-client') === 'mobile' ? 'mobile' : 'web',
  userAgent: header(ctx, 'user-agent')?.slice(0, 200),
})

@Resolver()
export class AuthResolver {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    private readonly users: UsersService,
  ) {}

  @Query('termsVersion')
  termsVersion(): string {
    return TERMS_VERSION
  }

  @Mutation('signUp')
  signUp(@Args() { input }: MutationSignUpArgs, @Context() ctx: RequestContext): Promise<AuthPayload> {
    return withUserErrors<AuthPayload>(async () => ({ session: await this.deliver(ctx, await this.auth.signUp(input, deviceOf(ctx), ctx.requestId)) }), { session: null })
  }

  @Mutation('signIn')
  signIn(@Args() { input }: MutationSignInArgs, @Context() ctx: RequestContext): Promise<AuthPayload> {
    return withUserErrors<AuthPayload>(async () => ({ session: await this.deliver(ctx, await this.auth.signIn(input.email, input.password, deviceOf(ctx))) }), { session: null })
  }

  @Mutation('refreshSession')
  async refreshSession(@Args() { input }: MutationRefreshSessionArgs, @Context() ctx: RequestContext): Promise<AuthPayload> {
    const token = input.refreshToken ?? ctx.req.cookies?.[REFRESH_COOKIE]
    if (!token) throw Errors.unauthenticated('Your session has ended. Sign in again.')
    try {
      return { session: await this.deliver(ctx, await this.sessions.refresh(token)), userErrors: [] }
    } catch (e) {
      if (!input.refreshToken) ctx.res.clearCookie(REFRESH_COOKIE, cookieOptions)
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
    ctx.res.clearCookie(REFRESH_COOKIE, cookieOptions)
    return { ok: true, userErrors: [] }
  }

  @Mutation('verifyEmail')
  verifyEmail(@Args() { input }: MutationVerifyEmailArgs): Promise<OkPayload> {
    return withUserErrors<OkPayload>(async () => {
      await this.auth.verifyEmail(input.token)
      return { ok: true }
    }, { ok: false })
  }

  @Mutation('requestPasswordReset')
  requestPasswordReset(@Args() { input }: MutationRequestPasswordResetArgs): Promise<OkPayload> {
    return withUserErrors<OkPayload>(async () => {
      await this.auth.requestPasswordReset(input.email)
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

  /** Session payload: the refresh token goes in the body for mobile and in the cookie for web. */
  private async deliver(ctx: RequestContext, s: IssuedSession) {
    const mobile = deviceOf(ctx).client === 'mobile'
    if (!mobile) ctx.res.cookie(REFRESH_COOKIE, s.refreshToken, { ...cookieOptions, expires: s.refreshTokenExpiresAt })
    const user = await this.users.viewerProfile(s.userId)
    return { accessToken: s.accessToken, accessTokenExpiresAt: s.accessTokenExpiresAt, refreshToken: mobile ? s.refreshToken : null, user: user! }
  }
}
