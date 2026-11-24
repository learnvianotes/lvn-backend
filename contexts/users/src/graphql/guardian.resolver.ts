import { UseGuards } from '@nestjs/common'
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { withUserErrors } from '@lvn-backend/errors'
import { GuardianManageService } from '../application/guardian-manage.service'
import { GuardianNoticeService } from '../application/guardian-notice.service'
import type { AccountDeletionPayload, DataExportPayload, OkPayload } from './schema.types'

/** Parent links (ADR-0110). The token operations are public. Resend is the signed-in child. */
@Resolver()
export class GuardianResolver {
  constructor(
    private readonly notice: GuardianNoticeService,
    private readonly manage: GuardianManageService,
  ) {}

  @Mutation('confirmGuardianConsent')
  confirm(@Args('token') token: string): Promise<OkPayload> {
    return withUserErrors<OkPayload>(async () => {
      await this.notice.confirm(token)
      return { ok: true }
    }, { ok: false })
  }

  @Mutation('redeemGuardianManageLink')
  redeem(@Args('token') token: string) {
    return withUserErrors(async () => this.manage.redeem(token), { sessionToken: null, expiresAt: null, summary: null })
  }

  @Query('guardianChildSummary')
  summary(@Args('sessionToken') sessionToken: string) {
    return withUserErrors(async () => ({ summary: await this.manage.summary(sessionToken) }), { summary: null })
  }

  @Mutation('guardianRequestDataExport')
  requestExport(@Args('sessionToken') sessionToken: string): Promise<DataExportPayload> {
    return withUserErrors<DataExportPayload>(async () => {
      const row = await this.manage.requestExport(sessionToken)
      return { export: { ...row, sizeBytes: row.sizeBytes === null ? null : Number(row.sizeBytes), downloadUrl: null } as unknown as DataExportPayload['export'] }
    }, { export: null })
  }

  @Query('guardianDataExports')
  exports(@Args('sessionToken') sessionToken: string) {
    return withUserErrors(async () => ({ exports: await this.manage.listExports(sessionToken) }), { exports: null })
  }

  @Mutation('guardianWithdrawConsent')
  withdraw(@Args('sessionToken') sessionToken: string) {
    return withUserErrors(async () => ({ summary: await this.manage.withdraw(sessionToken) }), { summary: null })
  }

  @Mutation('guardianSetSocialEnabled')
  setSocial(@Args('sessionToken') sessionToken: string, @Args('enabled') enabled: boolean) {
    return withUserErrors(async () => ({ summary: await this.manage.setSocialEnabled(sessionToken, enabled) }), { summary: null })
  }

  @Mutation('guardianDeleteAccount')
  deleteAccount(@Args('sessionToken') sessionToken: string, @Args('confirm') confirm: string): Promise<AccountDeletionPayload> {
    return withUserErrors<AccountDeletionPayload>(async () => ({ deletionScheduledFor: await this.manage.deleteAccount(sessionToken, confirm) }), { deletionScheduledFor: null })
  }

  @Mutation('resendGuardianConfirmLink')
  @UseGuards(SignedInGuard)
  resendConfirm(@CurrentViewer() viewer: Viewer): Promise<OkPayload> {
    return withUserErrors<OkPayload>(async () => {
      await this.notice.resendConfirm(viewer.userId)
      return { ok: true }
    }, { ok: false })
  }

  @Mutation('resendGuardianManageLink')
  @UseGuards(SignedInGuard)
  resendManage(@CurrentViewer() viewer: Viewer): Promise<OkPayload> {
    return withUserErrors<OkPayload>(async () => {
      await this.notice.resendManage(viewer.userId)
      return { ok: true }
    }, { ok: false })
  }
}
