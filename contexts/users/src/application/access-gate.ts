import { Injectable } from '@nestjs/common'
import type { GlobalRole } from '@lvn/contracts/domain'
import { Errors } from '@lvn-backend/errors'
import { PrismaService } from '@lvn-backend/prisma-base'
import { INVITE_ONLY_FIELD, INVITE_ONLY_MESSAGE, normalizeAllowlistEmail } from '../domain/access-allowlist'
import { ACCESS_ALLOWLIST_SETTING } from '../domain/setting-catalog'
import { PlatformSettingsStore } from './platform-settings.store'

/**
 * Whether an email may sign up or sign in while the beta allowlist is on (contracts 0.71.0).
 * Only interactive authentication calls this. The system publisher never signs in, and note publishing does not.
 */
@Injectable()
export class AccessGate {
  constructor(
    private readonly db: PrismaService,
    private readonly settings: PlatformSettingsStore,
  ) {}

  /** Public. False until an admin turns `access_allowlist_enabled` on. */
  inviteOnly(): boolean {
    return this.settings.boolean(ACCESS_ALLOWLIST_SETTING, false)
  }

  async roleFor(email: string): Promise<GlobalRole | null> {
    const row = await this.db.accessAllowlistEntry.findUnique({
      where: { email: normalizeAllowlistEmail(email) },
      select: { role: true },
    })
    return (row?.role as GlobalRole | undefined) ?? null
  }

  /** Switch off: everyone. Switch on: listed emails only, matched case-insensitively. */
  async allows(email: string): Promise<boolean> {
    if (!this.inviteOnly()) return true
    const row = await this.db.accessAllowlistEntry.findUnique({
      where: { email: normalizeAllowlistEmail(email) },
      select: { id: true },
    })
    return row !== null
  }

  async assertAllowed(email: string): Promise<void> {
    if (!(await this.allows(email))) throw Errors.forbidden(INVITE_ONLY_MESSAGE, [...INVITE_ONLY_FIELD])
  }
}
