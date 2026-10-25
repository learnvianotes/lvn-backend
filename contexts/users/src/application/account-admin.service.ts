import { createHash } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import { Errors } from '@lvn-backend/errors'
import { Prisma, PrismaService } from '@lvn-backend/prisma-base'
import type { AccountStatus } from '../domain/account-status'
import { isStudyPublisher } from '../domain/study-publisher'
import { AGE_BLOCK_REASON, dateOfBirthSchema, displayNameSchema, emailSchema, isBelowMinimumAge } from '../domain/rules'
import { AccountDeletionService } from './account-deletion.service'
import { AuditService } from './audit.service'
import { parseField } from './input'
import { PlatformSettingsStore } from './platform-settings.store'
import { PolicyService } from './policy.service'
import { SessionService } from './session.service'

const REASON_MAX = 500
const LIST_MAX = 100

export interface ManagedUser {
  id: string
  email: string
  displayName: string
  handle: string
  dateOfBirth: string | null
  accountStatus: AccountStatus
  statusReason: string | null
  globalRole: string
  createdAt: Date
}

export type AdminUserStatusFilter = 'AGE_BLOCKED' | 'BLOCKED_OR_SUSPENDED' | 'ACTIVE'

const SELECT = {
  id: true,
  email: true,
  displayName: true,
  handle: true,
  dateOfBirth: true,
  accountStatus: true,
  statusReason: true,
  globalRole: true,
  createdAt: true,
  deletedAt: true,
} as const

type Row = {
  id: string
  email: string
  displayName: string
  handle: string
  dateOfBirth: Date | null
  accountStatus: AccountStatus
  statusReason: string | null
  globalRole: string
  createdAt: Date
  deletedAt: Date | null
}

/**
 * Platform-admin account operations: list by standing, correct a profile and re-run the age gate, block or suspend,
 * and permanently delete. Every change records the acting admin and a reason.
 */
@Injectable()
export class AccountAdminService {
  constructor(
    private readonly db: PrismaService,
    private readonly policy: PolicyService,
    private readonly settings: PlatformSettingsStore,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
    private readonly deletion: AccountDeletionService,
  ) {}

  async list(actorId: string, status: AdminUserStatusFilter, search: string | null | undefined, first: number | null | undefined): Promise<{ users: ManagedUser[]; total: number }> {
    await this.requireAdmin(actorId)
    const take = Math.min(Math.max(first ?? 50, 1), LIST_MAX)
    const where = this.where(status, search)
    const [rows, total] = await Promise.all([
      this.db.user.findMany({ where, select: SELECT, orderBy: { createdAt: 'desc' }, take }),
      this.db.user.count({ where }),
    ])
    return { users: rows.map((row) => this.toManaged(row)), total }
  }

  async update(
    actorId: string,
    input: { userId: string; displayName?: string | null; email?: string | null; dateOfBirth?: string | null; reason: string },
  ): Promise<ManagedUser> {
    await this.requireAdmin(actorId)
    const reason = this.reason(input.reason, 'reason')
    const user = await this.live(input.userId)
    const data: Prisma.UserUpdateInput = {}
    const fields: string[] = []
    if (input.displayName != null) {
      data.displayName = parseField(displayNameSchema, input.displayName, 'displayName')
      fields.push('displayName')
    }
    if (input.email != null) {
      data.email = parseField(emailSchema, input.email, 'email')
      fields.push('email')
    }
    const minimum = this.settings.minimumAge()
    const nextDob = input.dateOfBirth != null ? parseField(dateOfBirthSchema, input.dateOfBirth, 'dateOfBirth') : user.dateOfBirth
    const passes = nextDob !== null && !isBelowMinimumAge(nextDob, minimum)
    if (input.dateOfBirth != null) {
      data.dateOfBirth = nextDob
      fields.push('dateOfBirth')
    }
    if (!fields.length) throw Errors.validation('Choose a name, an email, or a date of birth to change.', ['input'])
    // A new date of birth that would let an under-age account pass is refused until the reason note is present.
    // `reason` was already required above; an empty note never reaches this point.
    let unblocked = false
    if (input.dateOfBirth != null && !passes) {
      data.accountStatus = 'AGE_BLOCKED'
      data.statusReason = AGE_BLOCK_REASON
    } else if (user.accountStatus === 'AGE_BLOCKED' && passes) {
      data.accountStatus = 'ACTIVE'
      data.statusReason = null
      data.suspendedUntil = null
      data.suspensionReason = null
      unblocked = true
    }
    try {
      await this.db.user.update({ where: { id: user.id }, data })
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw Errors.conflict('An account with this email already exists.', ['input', 'email'])
      throw e
    }
    if (data.accountStatus === 'AGE_BLOCKED' && user.accountStatus !== 'AGE_BLOCKED') await this.sessions.revokeAll(user.id)
    await this.audit.record({
      actorId,
      action: 'account.admin.updated',
      targetType: 'USER',
      targetId: user.id,
      metadata: { reason, fields, ageUnblocked: unblocked },
    })
    return this.toManaged(await this.live(user.id))
  }

  async setStanding(actorId: string, input: { userId: string; status: AccountStatus; reason: string; until?: Date | null }): Promise<ManagedUser> {
    await this.requireAdmin(actorId)
    if (input.userId === actorId) throw Errors.validation('You cannot change your own standing.', ['input', 'userId'])
    const reason = this.reason(input.reason, 'reason')
    const user = await this.live(input.userId)
    if (input.status === 'AGE_BLOCKED') throw Errors.validation('The age gate sets this status. Correct the date of birth, with a reason.', ['input', 'status'])
    if (input.status === 'ACTIVE') {
      const minimum = this.settings.minimumAge()
      const stillUnder = user.accountStatus === 'AGE_BLOCKED' || (user.dateOfBirth !== null && isBelowMinimumAge(user.dateOfBirth, minimum))
      if (stillUnder) throw Errors.validation('This date of birth is still below the minimum age. Correct it, with a reason, before the account can pass.', ['input', 'dateOfBirth'])
      await this.db.user.update({ where: { id: user.id }, data: { accountStatus: 'ACTIVE', statusReason: null, suspendedUntil: null, suspensionReason: null } })
      await this.audit.record({ actorId, action: 'account.admin.unblocked', targetType: 'USER', targetId: user.id, metadata: { reason } })
      return this.toManaged(await this.live(user.id))
    }
    if (input.status === 'SUSPENDED') {
      if (!input.until || input.until.getTime() <= Date.now()) throw Errors.validation('Choose a time in the future.', ['input', 'until'])
      await this.db.user.update({
        where: { id: user.id },
        data: { accountStatus: 'SUSPENDED', statusReason: reason, suspendedUntil: input.until, suspensionReason: reason },
      })
      await this.sessions.revokeAll(user.id)
      await this.audit.record({ actorId, action: 'account.admin.suspended', targetType: 'USER', targetId: user.id, metadata: { reason, until: input.until.toISOString() } })
      return this.toManaged(await this.live(user.id))
    }
    await this.db.user.update({
      where: { id: user.id },
      data: { accountStatus: 'BLOCKED', statusReason: reason, suspendedUntil: null, suspensionReason: null },
    })
    await this.sessions.revokeAll(user.id)
    await this.audit.record({ actorId, action: 'account.admin.blocked', targetType: 'USER', targetId: user.id, metadata: { reason } })
    return this.toManaged(await this.live(user.id))
  }

  async delete(actorId: string, input: { userId: string; reason: string; confirm: string }): Promise<void> {
    await this.requireAdmin(actorId)
    if (input.confirm !== 'DELETE') throw Errors.validation('Type DELETE to confirm.', ['input', 'confirm'])
    if (input.userId === actorId) throw Errors.validation('You cannot delete your own account this way.', ['input', 'userId'])
    const reason = this.reason(input.reason, 'reason')
    const user = await this.live(input.userId)
    await this.deletion.adminErase(user.id, actorId, reason, emailHash(user.email))
  }

  private where(status: AdminUserStatusFilter, search: string | null | undefined): Prisma.UserWhereInput {
    const text = search?.trim()
    const standing: Prisma.UserWhereInput =
      status === 'AGE_BLOCKED'
        ? { accountStatus: 'AGE_BLOCKED' }
        : status === 'ACTIVE'
          ? { accountStatus: 'ACTIVE' }
          : { accountStatus: { in: ['BLOCKED', 'SUSPENDED'] } }
    return {
      deletedAt: null,
      ...standing,
      ...(text
        ? { OR: [{ email: { contains: text, mode: 'insensitive' } }, { displayName: { contains: text, mode: 'insensitive' } }, { handle: { contains: text, mode: 'insensitive' } }] }
        : {}),
    }
  }

  private async requireAdmin(actorId: string): Promise<void> {
    const actor = await this.policy.actor(actorId)
    if (actor?.globalRole !== 'PLATFORM_ADMIN') throw Errors.forbidden()
  }

  private async live(userId: string): Promise<Row> {
    const user = await this.db.user.findUnique({ where: { id: userId }, select: SELECT })
    if (!user || user.deletedAt || isStudyPublisher(user)) throw Errors.notFound('Account not found.')
    return user
  }

  private reason(value: string, field: string): string {
    const reason = value.trim()
    if (!reason) throw Errors.validation('Add a reason for this change.', ['input', field])
    if (reason.length > REASON_MAX) throw Errors.validation(`Use at most ${REASON_MAX} characters.`, ['input', field])
    return reason
  }

  private toManaged(row: Row): ManagedUser {
    return {
      id: row.id,
      email: row.email,
      displayName: row.displayName,
      handle: row.handle,
      dateOfBirth: row.dateOfBirth ? row.dateOfBirth.toISOString().slice(0, 10) : null,
      accountStatus: row.accountStatus,
      statusReason: row.statusReason,
      globalRole: row.globalRole,
      createdAt: row.createdAt,
    }
  }
}

export function emailHash(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex')
}
