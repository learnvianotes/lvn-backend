import { createHash } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import { Errors } from '@lvn-backend/errors'
import { Prisma, PrismaService } from '@lvn-backend/prisma-base'
import type { AccountStatus } from '../domain/account-status'
import { isStudyPublisher } from '../domain/study-publisher'
import { enforcedMinimumAge } from '../domain/guardian-consent'
import { AGE_BLOCK_REASON, ageOf, ageSchema, dateOfBirthSchema, displayNameSchema, emailSchema, isBelowMinimumAge, type AgeFacts } from '../domain/rules'
import { AGE_FIELDS } from './age'
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
  /** YYYY-MM-DD, only when the account has one (registered before ADR-0104, or set by an admin). */
  dateOfBirth: string | null
  /** ADR-0104: whole years now, from the date of birth or the declared age; null when neither is known. */
  age: number | null
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
  ...AGE_FIELDS,
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
  accountStatus: AccountStatus
  statusReason: string | null
  globalRole: string
  createdAt: Date
  deletedAt: Date | null
} & AgeFacts

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
    input: { userId: string; displayName?: string | null; email?: string | null; age?: number | null; dateOfBirth?: string | null; reason: string },
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
    // ADR-0104: a stored date of birth decides the age, so an age is only taken for an account without one, and
    // never together with a date of birth. The age is as of now.
    if (input.age != null && input.dateOfBirth != null) throw Errors.validation('Correct either the age or the date of birth, not both.', ['input', 'age'])
    let next: AgeFacts = user
    if (input.dateOfBirth != null) {
      const dateOfBirth = parseField(dateOfBirthSchema, input.dateOfBirth, 'dateOfBirth')
      data.dateOfBirth = dateOfBirth
      next = { ...next, dateOfBirth }
      fields.push('dateOfBirth')
    } else if (input.age != null) {
      const declaredAge = parseField(ageSchema, input.age, 'age')
      if (user.dateOfBirth) throw Errors.validation('This account has a date of birth. Correct the date of birth instead.', ['input', 'age'])
      const ageDeclaredAt = new Date()
      data.declaredAge = declaredAge
      data.ageDeclaredAt = ageDeclaredAt
      next = { ...next, declaredAge, ageDeclaredAt }
      fields.push('age')
    }
    const ageChanged = input.dateOfBirth != null || input.age != null
    const age = ageOf(next)
    const passes = age !== null && !isBelowMinimumAge(age, enforcedMinimumAge(this.settings.minimumAge()))
    if (!fields.length) throw Errors.validation('Choose a name, an email, an age or a date of birth to change.', ['input'])
    // A new age that would let an under-age account pass is refused until the reason note is present.
    // `reason` was already required above; an empty note never reaches this point.
    let unblocked = false
    if (ageChanged && !passes) {
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
    if (input.status === 'AGE_BLOCKED') throw Errors.validation('The age gate sets this status. Correct the age, with a reason.', ['input', 'status'])
    if (input.status === 'ACTIVE') {
      const age = ageOf(user)
      const stillUnder = user.accountStatus === 'AGE_BLOCKED' || (age !== null && isBelowMinimumAge(age, enforcedMinimumAge(this.settings.minimumAge())))
      if (stillUnder) {
        // Point at the input that would correct it: the date of birth when the account has one (ADR-0104).
        if (user.dateOfBirth) throw Errors.validation('This date of birth is still below the minimum age. Correct it, with a reason, before the account can pass.', ['input', 'dateOfBirth'])
        throw Errors.validation('This age is still below the minimum age. Correct it, with a reason, before the account can pass.', ['input', 'age'])
      }
      await this.db.user.update({ where: { id: user.id }, data: { accountStatus: 'ACTIVE', statusReason: null, suspendedUntil: null, suspensionReason: null } })
      await this.audit.record({ actorId, action: 'account.admin.unblocked', targetType: 'USER', targetId: user.id, metadata: { reason } })
      return this.toManaged(await this.live(user.id))
    }
    if (input.status === 'SUSPENDED') {
      // GraphQL delivers DateTime input as an ISO string; a Date is what the unit tests pass.
      const until = input.until instanceof Date ? input.until : new Date(input.until ?? '')
      if (!input.until || Number.isNaN(until.getTime()) || until.getTime() <= Date.now()) throw Errors.validation('Choose a time in the future.', ['input', 'until'])
      await this.db.user.update({
        where: { id: user.id },
        data: { accountStatus: 'SUSPENDED', statusReason: reason, suspendedUntil: until, suspensionReason: reason },
      })
      await this.sessions.revokeAll(user.id)
      await this.audit.record({ actorId, action: 'account.admin.suspended', targetType: 'USER', targetId: user.id, metadata: { reason, until: until.toISOString() } })
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
      age: ageOf(row),
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
