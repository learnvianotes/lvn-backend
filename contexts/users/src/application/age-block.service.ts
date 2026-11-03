import { Injectable } from '@nestjs/common'
import { newId, Prisma, PrismaService } from '@lvn-backend/prisma-base'
import { AGE_BLOCK_REASON } from '../domain/rules'
import { AuditService } from './audit.service'
import { freeHandle } from './handles'
import { SessionService } from './session.service'

/**
 * An under-age sign-up is kept, not discarded (the age gate is recoverable). The row is AGE_BLOCKED: no session is
 * started, and public reads leave it out. An existing account is never rewritten by someone else's date of birth.
 */
@Injectable()
export class AgeBlockService {
  constructor(
    private readonly db: PrismaService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Email sign-up. Creates the account when the address is new. Does not sign anyone in. `termsVersion` is the version
   * the caller already checked against TermsVersionProvider (ADR-0103); the consent rows record it.
   */
  async holdSignUp(input: { email: string; displayName: string; dateOfBirth: Date; passwordHash: string; globalRole: 'STUDENT' | 'TEACHER' | 'MANAGER' | 'PLATFORM_ADMIN'; termsVersion: string }): Promise<void> {
    const existing = await this.db.user.findUnique({ where: { email: input.email }, select: { id: true, deletedAt: true } })
    if (existing && !existing.deletedAt) return
    const id = newId()
    try {
      await this.db.$transaction(async (tx) => {
        await tx.user.create({
          data: {
            id,
            email: input.email,
            handle: await freeHandle(tx, input.displayName),
            displayName: input.displayName,
            passwordHash: input.passwordHash,
            dateOfBirth: input.dateOfBirth,
            registrationCompletedAt: new Date(),
            globalRole: input.globalRole,
            accountStatus: 'AGE_BLOCKED',
            statusReason: AGE_BLOCK_REASON,
            analyticsOptOut: true,
          },
        })
        await tx.consentRecord.createMany({
          data: (['TERMS', 'PRIVACY', 'PUBLIC_CONTENT_LICENCE'] as const).map((kind) => ({ id: newId(), userId: id, kind, version: input.termsVersion })),
        })
      })
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return
      throw e
    }
    await this.audit.record({ actorId: id, action: 'account.age_blocked', targetType: 'USER', targetId: id, metadata: { source: 'sign_up' } })
  }

  /**
   * Provider registration. The account already exists and may hold a session from the sign-in that created it.
   * That session ends. The row stays, with the date of birth, so an admin can correct it. `termsVersion` is the
   * version the caller already checked (ADR-0103).
   */
  async holdRegistration(userId: string, displayName: string, dateOfBirth: Date, termsVersion: string): Promise<void> {
    await this.db.$transaction([
      this.db.user.update({
        where: { id: userId },
        data: {
          displayName,
          dateOfBirth,
          registrationCompletedAt: new Date(),
          accountStatus: 'AGE_BLOCKED',
          statusReason: AGE_BLOCK_REASON,
          analyticsOptOut: true,
        },
      }),
      this.db.consentRecord.createMany({
        data: (['TERMS', 'PRIVACY', 'PUBLIC_CONTENT_LICENCE'] as const).map((kind) => ({ id: newId(), userId, kind, version: termsVersion })),
      }),
    ])
    await this.sessions.revokeAll(userId)
    await this.audit.record({ actorId: userId, action: 'account.age_blocked', targetType: 'USER', targetId: userId, metadata: { source: 'registration' } })
  }
}
