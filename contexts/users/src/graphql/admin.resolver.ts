import { UseGuards } from '@nestjs/common'
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql'
import { CurrentViewer, RequireMfa, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { withUserErrors } from '@lvn-backend/errors'
import { AccountAdminService } from '../application/account-admin.service'
import { AdminMetricsService } from '../application/admin-metrics.service'
import { AdminTermsService } from '../application/admin-terms.service'
import { AppSettingsService } from '../application/app-settings.service'
import { PlanAdminService } from '../application/plan-admin.service'
import type {
  AdminManagedUser,
  AdminMetrics,
  AdminPlanPayload,
  AdminSetting,
  AdminSettingPayload,
  AdminTermsStatus,
  AdminUserList,
  AdminUserPayload,
  MutationAdminDeleteUserArgs,
  MutationAdminSetAccountStandingArgs,
  MutationAdminUpdateUserArgs,
  MutationCreateAdminPlanArgs,
  MutationDeleteAdminPlanArgs,
  MutationResetAdminSettingArgs,
  MutationUpdateAdminPlanArgs,
  MutationUpdateAdminSettingArgs,
  OkPayload,
  QueryAdminMetricsArgs,
  QueryAdminUsersArgs,
} from './schema.types'

/** Platform-admin dashboard (ADR-0101). */
@Resolver()
@UseGuards(SignedInGuard)
@RequireMfa()
export class AdminDashboardResolver {
  constructor(
    private readonly metrics: AdminMetricsService,
    private readonly settings: AppSettingsService,
    private readonly plans: PlanAdminService,
    private readonly accounts: AccountAdminService,
    private readonly terms: AdminTermsService,
  ) {}

  @Query('adminMetrics')
  adminMetrics(@Args() args: QueryAdminMetricsArgs, @CurrentViewer() viewer: Viewer): Promise<AdminMetrics> {
    return this.metrics.metrics(viewer.userId, args.from, args.to) as Promise<AdminMetrics>
  }

  @Query('adminSettings')
  adminSettings(@CurrentViewer() viewer: Viewer): Promise<AdminSetting[]> {
    return this.settings.list(viewer.userId) as Promise<AdminSetting[]>
  }

  @Query('adminTermsStatus')
  adminTermsStatus(@CurrentViewer() viewer: Viewer): Promise<AdminTermsStatus> {
    return this.terms.status(viewer.userId) as Promise<AdminTermsStatus>
  }

  @Query('adminPlans')
  adminPlans(@CurrentViewer() viewer: Viewer) {
    return this.plans.list(viewer.userId)
  }

  @Mutation('updateAdminSetting')
  updateAdminSetting(@Args() { input }: MutationUpdateAdminSettingArgs, @CurrentViewer() viewer: Viewer): Promise<AdminSettingPayload> {
    return withUserErrors<AdminSettingPayload>(async () => ({ setting: (await this.settings.update(viewer.userId, input.key, input.value)) as AdminSetting }), { setting: null })
  }

  @Mutation('resetAdminSetting')
  resetAdminSetting(@Args() { key }: MutationResetAdminSettingArgs, @CurrentViewer() viewer: Viewer): Promise<AdminSettingPayload> {
    return withUserErrors<AdminSettingPayload>(async () => ({ setting: (await this.settings.reset(viewer.userId, key)) as AdminSetting }), { setting: null })
  }

  @Mutation('createAdminPlan')
  createAdminPlan(@Args() { input }: MutationCreateAdminPlanArgs, @CurrentViewer() viewer: Viewer): Promise<AdminPlanPayload> {
    return withUserErrors<AdminPlanPayload>(async () => ({ plan: await this.plans.create(viewer.userId, input) }), { plan: null })
  }

  @Mutation('updateAdminPlan')
  updateAdminPlan(@Args() { input }: MutationUpdateAdminPlanArgs, @CurrentViewer() viewer: Viewer): Promise<AdminPlanPayload> {
    return withUserErrors<AdminPlanPayload>(async () => ({ plan: await this.plans.update(viewer.userId, input) }), { plan: null })
  }

  @Query('adminUsers')
  adminUsers(@Args() args: QueryAdminUsersArgs, @CurrentViewer() viewer: Viewer): Promise<AdminUserList> {
    return this.accounts.list(viewer.userId, args.status, args.search, args.first) as Promise<AdminUserList>
  }

  @Mutation('adminUpdateUser')
  adminUpdateUser(@Args() { input }: MutationAdminUpdateUserArgs, @CurrentViewer() viewer: Viewer): Promise<AdminUserPayload> {
    return withUserErrors<AdminUserPayload>(async () => ({ user: (await this.accounts.update(viewer.userId, input)) as AdminManagedUser }), { user: null })
  }

  @Mutation('adminSetAccountStanding')
  adminSetAccountStanding(@Args() { input }: MutationAdminSetAccountStandingArgs, @CurrentViewer() viewer: Viewer): Promise<AdminUserPayload> {
    return withUserErrors<AdminUserPayload>(async () => ({ user: (await this.accounts.setStanding(viewer.userId, input)) as AdminManagedUser }), { user: null })
  }

  @Mutation('adminDeleteUser')
  adminDeleteUser(@Args() { input }: MutationAdminDeleteUserArgs, @CurrentViewer() viewer: Viewer): Promise<OkPayload> {
    return withUserErrors<OkPayload>(async () => {
      await this.accounts.delete(viewer.userId, input)
      return { ok: true }
    }, { ok: false })
  }

  @Mutation('deleteAdminPlan')
  deleteAdminPlan(@Args() { id }: MutationDeleteAdminPlanArgs, @CurrentViewer() viewer: Viewer): Promise<OkPayload> {
    return withUserErrors<OkPayload>(async () => {
      await this.plans.remove(viewer.userId, id)
      return { ok: true }
    }, { ok: false })
  }
}
