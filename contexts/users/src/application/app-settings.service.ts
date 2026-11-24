import { Inject, Injectable } from '@nestjs/common'
import { Errors } from '@lvn-backend/errors'
import { PrismaService } from '@lvn-backend/prisma-base'
import { PUBLIC_NOTES_REQUIRE_VERIFICATION, unverifiedGatesFromSetting } from '@lvn/contracts/domain'
import { decodeSettingValue, parseSettingInput, serializeSetting, SETTING_CATALOG, settingDef, STUDENT_ID_AI_AUTO_APPROVE_SETTING, STUDENT_ID_AI_CHECK_SETTING, STUDENT_ID_AI_THRESHOLD_SETTING, STUDENT_ID_IMAGE_RETENTION_SETTING, UNVERIFIED_GATED_ACTIONS_SETTING, type SettingDef } from '../domain/setting-catalog'
import { USERS_CONFIG, type UsersConfig } from '../users.config'
import { AuditService } from './audit.service'
import { PlatformSettingsStore } from './platform-settings.store'
import { PolicyService } from './policy.service'
import { TermsVersionProvider } from './terms-version.provider'

export { GOOGLE_SIGN_IN_SETTING, STUDENT_ID_VERIFICATION_SETTING } from '../domain/setting-catalog'

export interface AdminSettingView {
  key: string
  type: SettingDef['type']
  category: string
  description: string
  value: string
  overridden: boolean
  updatedAt: Date | null
  constraints: { min: number | null; max: number | null; maxLength: number | null; pattern: string | null; nullable: boolean }
}

/**
 * Switches and limits a platform admin changes from the admin tools (ADR-0099, ADR-0100, ADR-0101).
 * Ports, URLs and connection details stay in the environment. A missing row keeps today's environment value.
 */
@Injectable()
export class AppSettingsService {
  constructor(
    private readonly db: PrismaService,
    private readonly store: PlatformSettingsStore,
    private readonly policy: PolicyService,
    private readonly audit: AuditService,
    @Inject(USERS_CONFIG) private readonly config: UsersConfig,
    private readonly terms: TermsVersionProvider,
  ) {}

  /** Public. False until an admin turns it on, including when the row has never been written. */
  async studentIdVerificationEnabled(): Promise<boolean> {
    return this.store.boolean('student_id_verification', false)
  }

  async studentIdVerificationSettings(adminId: string): Promise<{ enabled: boolean; updatedAt: Date | null; aiCheckEnabled: boolean; autoApproveOnHighConfidence: boolean; confidenceThreshold: number; imageRetentionDays: number }> {
    await this.assertAdmin(adminId)
    const [view, ai, auto, threshold, retention] = await Promise.all([
      this.one('student_id_verification'),
      this.one(STUDENT_ID_AI_CHECK_SETTING),
      this.one(STUDENT_ID_AI_AUTO_APPROVE_SETTING),
      this.one(STUDENT_ID_AI_THRESHOLD_SETTING),
      this.one(STUDENT_ID_IMAGE_RETENTION_SETTING),
    ])
    return {
      enabled: view.value === 'true',
      updatedAt: view.updatedAt,
      aiCheckEnabled: ai.value === 'true',
      autoApproveOnHighConfidence: auto.value === 'true',
      confidenceThreshold: Number(threshold.value),
      imageRetentionDays: Number(retention.value),
    }
  }

  /** Public. Missing row is the built-in list. A saved empty value gates nothing. */
  unverifiedGatedActions(): string[] {
    return [...unverifiedGatesFromSetting(this.store.string(UNVERIFIED_GATED_ACTIONS_SETTING, null))]
  }

  /** Public. Missing row means Public notes and quizzes require a verified account. */
  publicNotesRequireVerification(): boolean {
    return this.store.boolean(PUBLIC_NOTES_REQUIRE_VERIFICATION, true)
  }

  /** Public. Youngest age that may sign up. At least 13. A saved value below 13 is read as 13 and is not rewritten. */
  minimumAge(): number {
    return this.store.minimumAge()
  }

  /** Public to sign-in. True until an admin writes the row off, including when the row has never been written. */
  async googleSignInEnabled(): Promise<boolean> {
    return this.store.boolean('google_sign_in', true)
  }

  async setGoogleSignInEnabled(adminId: string, enabled: boolean): Promise<boolean> {
    await this.write(adminId, 'google_sign_in', enabled ? 'true' : 'false', 'settings.google_sign_in')
    return enabled
  }

  async setStudentIdVerificationEnabled(adminId: string, enabled: boolean): Promise<void> {
    await this.write(adminId, 'student_id_verification', enabled ? 'true' : 'false', 'settings.student_id_verification')
  }

  async list(adminId: string): Promise<AdminSettingView[]> {
    await this.assertAdmin(adminId)
    const rows = await this.db.appSetting.findMany()
    const byKey = new Map(rows.map((row) => [row.key, row]))
    return SETTING_CATALOG.map((def) => this.view(def, byKey.get(def.key)))
  }

  async update(adminId: string, key: string, raw: string): Promise<AdminSettingView> {
    await this.write(adminId, key, raw, 'settings.updated')
    return this.one(key)
  }

  async reset(adminId: string, key: string): Promise<AdminSettingView> {
    await this.assertAdmin(adminId)
    const def = settingDef(key)
    if (!def) throw Errors.validation('That setting is not one an admin can change.', ['key'])
    // ADR-0103: the version in effect after the reset must still be a published one.
    await this.terms.assertChangeAllowed(key, null, ['key'])
    const previous = (await this.one(key)).value
    const removed = await this.store.remove(key)
    const after = await this.one(key)
    if (removed) {
      await this.audit.record({ actorId: adminId, action: 'settings.reset', targetType: 'AppSetting', metadata: { key, previous, value: after.value } })
    }
    return after
  }

  private async write(adminId: string, key: string, raw: string, action: string): Promise<void> {
    await this.assertAdmin(adminId)
    const def = settingDef(key)
    if (!def) throw Errors.validation('That setting is not one an admin can change.', ['input', 'key'])
    const parsed = parseSettingInput(def, raw)
    if (!parsed.ok) throw Errors.validation(parsed.message, ['input', 'value'])
    // ADR-0103: terms_version must be a published version, and the published list must keep the version in effect.
    await this.terms.assertChangeAllowed(key, typeof parsed.value === 'string' ? parsed.value : null, ['input', 'value'])
    // The value in effect before this save: the saved row, the environment or the built-in default.
    const previous = (await this.one(key)).value
    await this.store.put(key, parsed.value, adminId)
    // targetId is a uuid column. The setting key is not one, so it lives in the metadata.
    // `enabled` stays on boolean rows so the older switch mutations keep the audit shape they already wrote.
    await this.audit.record({
      actorId: adminId,
      action,
      targetType: 'AppSetting',
      metadata: { key, value: serializeSetting(parsed.value), previous, ...(typeof parsed.value === 'boolean' ? { enabled: parsed.value } : {}) },
    })
  }

  private async one(key: string): Promise<AdminSettingView> {
    const def = settingDef(key)
    if (!def) throw Errors.validation('That setting is not one an admin can change.', ['key'])
    return this.view(def, await this.db.appSetting.findUnique({ where: { key } }))
  }

  private view(def: SettingDef, row: { value: unknown; enabled: boolean; updatedAt: Date } | null | undefined): AdminSettingView {
    const constraints = { min: def.min ?? null, max: def.max ?? null, maxLength: def.maxLength ?? null, pattern: def.pattern ?? null, nullable: def.nullable }
    const base = { key: def.key, type: def.type, category: def.category, description: def.description, constraints }
    if (!row) return { ...base, value: serializeSetting(this.unset(def)), overridden: false, updatedAt: null }
    return { ...base, value: serializeSetting(decodeSettingValue(row.value, row.enabled)), overridden: true, updatedAt: row.updatedAt }
  }

  private unset(def: SettingDef): boolean | number | string | null {
    const fallbacks = this.config.settingFallbacks
    if (def.environmentFallback && def.key in fallbacks) {
      // Undefined is a variable that is not set (TERMS_VERSION): the built-in default applies.
      const value = fallbacks[def.key as keyof typeof fallbacks]
      if (value !== undefined) return value
    }
    return def.defaultValue
  }

  private async assertAdmin(userId: string): Promise<void> {
    const actor = await this.policy.actor(userId)
    if (!actor) throw Errors.unauthenticated()
    if (actor.globalRole !== 'PLATFORM_ADMIN') throw Errors.forbidden()
  }
}
