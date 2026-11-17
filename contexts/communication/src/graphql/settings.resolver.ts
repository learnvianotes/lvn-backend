import { Inject, UseGuards } from '@nestjs/common'
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql'
import type { NotificationCategory } from '@lvn/contracts/notifications'
import { CurrentViewer, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { Errors, withUserErrors, type UserError } from '@lvn-backend/errors'
import { AudienceService } from '../audience/audience.service'
import { COMMUNICATION_CONFIG, type CommunicationConfig } from '../communication.config'
import { readUnsubscribeToken, type EmailKind } from '../email/unsubscribe'
import { PreferencesService, type Settings } from '../preferences/preferences.service'
import { DevicesService } from '../push/devices.service'
import { PushService } from '../push/push.service'

type SettingsPayload = { settings: (Settings & { pushAvailable: boolean; devices: number }) | null; userErrors: UserError[] }

/** Preferences, devices and one-click unsubscribe (ADR-0050). */
@Resolver()
export class SettingsResolver {
  constructor(
    private readonly preferences: PreferencesService,
    private readonly devices: DevicesService,
    private readonly push: PushService,
    @Inject(COMMUNICATION_CONFIG) private readonly config: CommunicationConfig,
    private readonly audience: AudienceService,
  ) {}

  private async full(userId: string, settings: Settings) {
    return { ...settings, pushAvailable: this.push.enabled, devices: await this.devices.count(userId) }
  }

  @Query('notificationSettings')
  @UseGuards(SignedInGuard)
  async notificationSettings(@CurrentViewer() viewer: Viewer) {
    return this.full(viewer.userId, await this.preferences.settings(viewer.userId))
  }

  @Mutation('updateNotificationSettings')
  @UseGuards(SignedInGuard)
  updateNotificationSettings(@Args('input') input: { categories?: { category: NotificationCategory; push?: boolean | null; email?: boolean | null }[] | null; quietStart?: string | null; quietEnd?: string | null; timeZone?: string | null; weeklyDigest?: boolean | null; productEmails?: boolean | null }, @CurrentViewer() viewer: Viewer): Promise<SettingsPayload> {
    return withUserErrors<SettingsPayload>(async () => {
      const settings = await this.preferences.update(viewer.userId, input)
      if (input.productEmails != null) await this.audience.applyProductEmails(viewer.userId, input.productEmails)
      return { settings: await this.full(viewer.userId, settings) }
    }, { settings: null })
  }

  @Mutation('registerDevice')
  @UseGuards(SignedInGuard)
  registerDevice(@Args('input') input: { token: string; platform: 'ANDROID' | 'IOS' }, @CurrentViewer() viewer: Viewer) {
    return withUserErrors(async () => (await this.devices.register(viewer.userId, input.token, input.platform), { ok: true }), { ok: false })
  }

  @Mutation('unregisterDevice')
  @UseGuards(SignedInGuard)
  async unregisterDevice(@Args('input') input: { token: string }, @CurrentViewer() viewer: Viewer) {
    await this.devices.unregister(viewer.userId, input.token)
    return { ok: true, userErrors: [] }
  }

  @Mutation('unsubscribeEmail')
  unsubscribeEmail(@Args('input') input: { token: string }): Promise<{ kind: EmailKind | null; userErrors: UserError[] }> {
    return withUserErrors(async () => {
      const read = readUnsubscribeToken(this.config.hmacSecret, input.token.trim())
      if (!read) throw Errors.validation('This unsubscribe link is not valid. Change your email settings from your account instead.', ['input', 'token'])
      await this.preferences.stopEmail(read.userId, read.kind)
      if (read.kind === 'MARKETING') await this.audience.applyProductEmails(read.userId, false)
      return { kind: read.kind }
    }, { kind: null })
  }
}
