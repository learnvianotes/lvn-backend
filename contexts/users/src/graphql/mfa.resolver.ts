import { Inject, UseGuards } from '@nestjs/common'
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql'
import { CurrentViewer, RequireMfa, SignedInGuard, type RequestContext, type Viewer } from '@lvn-backend/auth-guard'
import { withUserErrors } from '@lvn-backend/errors'
import { MfaService } from '../application/mfa.service'
import { UsersService } from '../application/users.service'
import { USERS_CONFIG, type UsersConfig } from '../users.config'
import { deliverSession, refreshCookieOptions, requestMeta, type RefreshCookieOptions } from './session-delivery'
import type { MfaChallengePayload, MfaStatus, MfaVerifyPayload, MutationAdminRecoverMfaArgs, MutationSetMfaOptInArgs, MutationStartMfaChallengeArgs, MutationVerifyMfaChallengeArgs, OkPayload } from './schema.types'

/** Second factor. These operations stay available before MFA is finished; admin tools do not. */
@Resolver()
@UseGuards(SignedInGuard)
export class MfaResolver {
  private readonly cookie: RefreshCookieOptions

  constructor(
    private readonly mfa: MfaService,
    private readonly users: UsersService,
    @Inject(USERS_CONFIG) config: UsersConfig,
  ) {
    this.cookie = refreshCookieOptions(config.jwtIssuer)
  }

  @Query('mfaStatus')
  mfaStatus(@CurrentViewer() viewer: Viewer): Promise<MfaStatus> {
    return this.mfa.status(viewer.userId, viewer.sessionId) as Promise<MfaStatus>
  }

  @Mutation('startMfaChallenge')
  startMfaChallenge(@Args() { factor }: MutationStartMfaChallengeArgs, @CurrentViewer() viewer: Viewer, @Context() ctx: RequestContext): Promise<MfaChallengePayload> {
    return withUserErrors<MfaChallengePayload>(async () => this.mfa.start(viewer.userId, viewer.sessionId, factor, requestMeta(ctx)), { challengeId: null, factor: null, expiresAt: null })
  }

  @Mutation('verifyMfaChallenge')
  verifyMfaChallenge(@Args() { challengeId, code }: MutationVerifyMfaChallengeArgs, @CurrentViewer() viewer: Viewer, @Context() ctx: RequestContext): Promise<MfaVerifyPayload> {
    return withUserErrors<MfaVerifyPayload>(async () => {
      const issued = await this.mfa.verify(viewer.userId, viewer.sessionId, challengeId, code, requestMeta(ctx))
      return { session: await deliverSession(ctx, this.cookie, this.users, issued) }
    }, { session: null })
  }

  @Mutation('setMfaOptIn')
  setMfaOptIn(@Args() { optIn }: MutationSetMfaOptInArgs, @CurrentViewer() viewer: Viewer, @Context() ctx: RequestContext): Promise<OkPayload> {
    return withUserErrors<OkPayload>(async () => {
      await this.mfa.setOptIn(viewer.userId, optIn, requestMeta(ctx))
      return { ok: true }
    }, { ok: false })
  }

  @Mutation('adminRecoverMfa')
  @RequireMfa()
  adminRecoverMfa(@Args() { input }: MutationAdminRecoverMfaArgs, @CurrentViewer() viewer: Viewer, @Context() ctx: RequestContext): Promise<OkPayload> {
    return withUserErrors<OkPayload>(async () => {
      await this.mfa.recover(viewer.userId, input.userId, input.reason, requestMeta(ctx))
      return { ok: true }
    }, { ok: false })
  }
}
