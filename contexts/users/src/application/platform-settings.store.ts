import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import type { PlatformSettings } from '@lvn-backend/facades'
import { PrismaService, type Prisma } from '@lvn-backend/prisma-base'
import { DEFAULT_ACCOUNT_MINIMUM_AGE, DEFAULT_GUARDIAN_NOTICE_VERSION, GUARDIAN_NOTICE_VERSION_SETTING } from '../domain/guardian-consent'
import { decodeSettingValue } from '../domain/setting-catalog'
import { USERS_CONFIG, type UsersConfig } from '../users.config'

type Stored = boolean | number | string | null

/**
 * The AppSetting rows, cached in this process for a few seconds (ADR-0101). A missing key is not cached: readers
 * use the fallback they were given, which is the environment or the catalog default. Writes update the cache at once.
 */
@Injectable()
export class PlatformSettingsStore implements OnModuleInit, OnModuleDestroy, PlatformSettings {
  private readonly log = new Logger('PlatformSettings')
  private cache = new Map<string, Stored>()
  private timer: NodeJS.Timeout | null = null

  constructor(
    private readonly db: PrismaService,
    @Inject(USERS_CONFIG) private readonly config: UsersConfig,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.reload()
    this.timer = setInterval(() => void this.reload(), 15_000)
    this.timer.unref()
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer)
  }

  boolean(key: string, fallback: boolean): boolean {
    if (!this.cache.has(key)) return fallback
    const value = this.cache.get(key)
    return typeof value === 'boolean' ? value : fallback
  }

  integer(key: string, fallback: number | null): number | null {
    if (!this.cache.has(key)) return fallback
    const value = this.cache.get(key)
    if (value === null) return null
    return typeof value === 'number' && Number.isInteger(value) ? value : fallback
  }

  string(key: string, fallback: string | null): string | null {
    if (!this.cache.has(key)) return fallback
    const value = this.cache.get(key)
    return typeof value === 'string' ? value : fallback
  }

  /** Youngest age that may sign up. The admin setting, or 13 when no row is saved. The environment is not read. */
  minimumAge(): number {
    return this.integer('account_minimum_age', DEFAULT_ACCOUNT_MINIMUM_AGE) ?? DEFAULT_ACCOUNT_MINIMUM_AGE
  }

  /** Notice version stored on a new under-18 guardian consent row. */
  guardianNoticeVersion(): string {
    return this.string(GUARDIAN_NOTICE_VERSION_SETTING, DEFAULT_GUARDIAN_NOTICE_VERSION) || DEFAULT_GUARDIAN_NOTICE_VERSION
  }

  /** Age below which an account is a restricted minor. The environment applies until an admin saves it. */
  consentAge(): number {
    return this.integer('digital_consent_age', this.config.settingFallbacks.digital_consent_age) ?? this.config.settingFallbacks.digital_consent_age
  }

  async reload(): Promise<void> {
    try {
      const rows = await this.db.appSetting.findMany()
      const next = new Map<string, Stored>()
      for (const row of rows) next.set(row.key, decodeSettingValue(row.value, row.enabled))
      this.cache = next
    } catch (e) {
      this.log.warn(`Settings were not read: ${(e as Error).message}`)
    }
  }

  async put(key: string, value: Stored, updatedBy: string): Promise<void> {
    const data = { enabled: value === true, value: { v: value } as Prisma.InputJsonValue, updatedBy }
    await this.db.appSetting.upsert({ where: { key }, create: { key, ...data }, update: data })
    this.cache.set(key, value)
  }

  /** Removes the row. Returns whether one was stored. Readers then use the environment or the catalog default. */
  async remove(key: string): Promise<boolean> {
    const { count } = await this.db.appSetting.deleteMany({ where: { key } })
    this.cache.delete(key)
    return count > 0
  }
}
