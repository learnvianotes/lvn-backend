import { Injectable } from '@nestjs/common'
import { Errors } from '@lvn-backend/errors'
import { PrismaService } from '@lvn-backend/prisma-base'
import { AuditService } from './audit.service'
import { PolicyService } from './policy.service'

/** ADR-0099. A missing row means college-ID verification is off. */
export const STUDENT_ID_VERIFICATION_SETTING = 'student_id_verification'

/**
 * Switches a platform admin changes from the admin tools, stored as data. Not environment variables: turning college-ID
 * verification on does not need a deploy, and it does not turn general uploads on (ADR-0097).
 */
@Injectable()
export class AppSettingsService {
  constructor(
    private readonly db: PrismaService,
    private readonly policy: PolicyService,
    private readonly audit: AuditService,
  ) {}

  /** Public. False until an admin turns it on, including when the row has never been written. */
  async studentIdVerificationEnabled(): Promise<boolean> {
    const row = await this.db.appSetting.findUnique({ where: { key: STUDENT_ID_VERIFICATION_SETTING }, select: { enabled: true } })
    return row?.enabled ?? false
  }

  async studentIdVerificationSettings(adminId: string): Promise<{ enabled: boolean; updatedAt: Date | null }> {
    await this.assertAdmin(adminId)
    const row = await this.db.appSetting.findUnique({ where: { key: STUDENT_ID_VERIFICATION_SETTING } })
    return { enabled: row?.enabled ?? false, updatedAt: row?.updatedAt ?? null }
  }

  async setStudentIdVerificationEnabled(adminId: string, enabled: boolean): Promise<void> {
    await this.assertAdmin(adminId)
    await this.db.appSetting.upsert({
      where: { key: STUDENT_ID_VERIFICATION_SETTING },
      create: { key: STUDENT_ID_VERIFICATION_SETTING, enabled, updatedBy: adminId },
      update: { enabled, updatedBy: adminId },
    })
    // targetId is a uuid column. The setting key is not one, so it lives in the metadata.
    await this.audit.record({
      actorId: adminId,
      action: 'settings.student_id_verification',
      targetType: 'AppSetting',
      metadata: { key: STUDENT_ID_VERIFICATION_SETTING, enabled },
    })
  }

  private async assertAdmin(userId: string): Promise<void> {
    const actor = await this.policy.actor(userId)
    if (!actor) throw Errors.unauthenticated()
    if (actor.globalRole !== 'PLATFORM_ADMIN') throw Errors.forbidden()
  }
}
