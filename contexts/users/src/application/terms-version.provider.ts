import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { Errors } from '@lvn-backend/errors'
import { PrismaService } from '@lvn-backend/prisma-base'
import { decodeSettingValue } from '../domain/setting-catalog'
import { resolveTerms, termsChangeError, TERMS_PUBLISHED_VERSIONS_SETTING, TERMS_VERSION_SETTING, type TermsResolution } from '../domain/terms'
import { USERS_CONFIG, type UsersConfig } from '../users.config'
import { PlatformSettingsStore } from './platform-settings.store'

const KEYS = [TERMS_VERSION_SETTING, TERMS_PUBLISHED_VERSIONS_SETTING]

/**
 * ADR-0103: the terms version that sign-up, completeRegistration and acceptTerms require, and the versions an admin
 * may choose. Order: the saved `terms_version` AppSetting, then TERMS_VERSION, then DEFAULT_TERMS_VERSION.
 *
 * Hot-path reads use PlatformSettingsStore, the process's AppSetting cache. A save or reset in this process updates it
 * at once; every API and worker process re-reads the table every 15 seconds, so another process follows within that.
 */
@Injectable()
export class TermsVersionProvider implements OnModuleInit {
  private readonly log = new Logger('TermsVersion')

  constructor(
    private readonly db: PrismaService,
    private readonly store: PlatformSettingsStore,
    @Inject(USERS_CONFIG) private readonly config: UsersConfig,
  ) {}

  /** The config refuses TERMS_VERSION outside TERMS_PUBLISHED_VERSIONS; this catches it outside the built-in list. */
  onModuleInit(): void {
    const fromEnv = this.resolveWith(null, null)
    if (fromEnv.source === 'ENV' && !fromEnv.published.includes(fromEnv.version)) {
      this.log.warn(`TERMS_VERSION ${fromEnv.version} is not a published terms version (${fromEnv.published.join(', ')}). Set TERMS_PUBLISHED_VERSIONS or change TERMS_VERSION.`)
    }
  }

  /** The version a person must accept now. */
  current(): string {
    return this.resolve().version
  }

  /** The version and the published list from this process's cache. */
  resolve(): TermsResolution {
    return this.resolveWith(this.store.string(TERMS_VERSION_SETTING, null), this.store.string(TERMS_PUBLISHED_VERSIONS_SETTING, null))
  }

  /**
   * The same, read from the database instead of the cache. `change` replaces one saved value first (null: the row is
   * removed), to check a save or reset before it is written.
   */
  async resolveFresh(change?: { key: string; value: string | null }): Promise<TermsResolution> {
    const rows = await this.db.appSetting.findMany({ where: { key: { in: KEYS } } })
    const saved = new Map<string, string | null>()
    for (const row of rows) {
      const value = decodeSettingValue(row.value, row.enabled)
      saved.set(row.key, typeof value === 'string' ? value : null)
    }
    if (change) saved.set(change.key, change.value)
    return this.resolveWith(saved.get(TERMS_VERSION_SETTING) ?? null, saved.get(TERMS_PUBLISHED_VERSIONS_SETTING) ?? null)
  }

  /**
   * Refuses (VALIDATION) a save or reset of `terms_version` or `terms_published_versions` that would leave the version
   * in effect outside the published list. Other keys pass. `value` null is a reset.
   */
  async assertChangeAllowed(key: string, value: string | null, field: string[]): Promise<void> {
    if (!KEYS.includes(key)) return
    const message = termsChangeError(key, await this.resolveFresh({ key, value }))
    if (message) throw Errors.validation(message, field)
  }

  private resolveWith(savedVersion: string | null, savedPublished: string | null): TermsResolution {
    const env = this.config.settingFallbacks
    return resolveTerms({ savedVersion, savedPublished, envVersion: env.terms_version, envPublished: env.terms_published_versions })
  }
}
