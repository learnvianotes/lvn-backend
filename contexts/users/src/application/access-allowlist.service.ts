import { Inject, Injectable } from '@nestjs/common'
import { GlobalRole, type GlobalRole as GlobalRoleName } from '@lvn/contracts/domain'
import { Errors } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { newId, Prisma, PrismaService } from '@lvn-backend/prisma-base'
import {
  ALLOWLIST_NOTE_MAX,
  allowlistGuard,
  normalizeAllowlistEmail,
} from '../domain/access-allowlist'
import { emailSchema } from '../domain/rules'
import { AccessGate } from './access-gate'
import { AuditService } from './audit.service'
import { parseField } from './input'
import { PolicyService } from './policy.service'
import { SessionService } from './session.service'

export interface AccessAllowlistView {
  id: string
  email: string
  role: GlobalRoleName
  note: string | null
  hasAccount: boolean
  addedByEmail: string | null
  createdAt: Date
}

interface EntryRow {
  id: string
  email: string
  role: GlobalRoleName
  note: string | null
  addedById: string | null
  createdAt: Date
}

/**
 * Platform-admin edits of the beta allowlist. The role is written onto an existing account in the same transaction.
 * Removing an email signs that account out. The last platform admin, and your own entry, cannot be removed or demoted.
 */
@Injectable()
export class AccessAllowlistService {
  constructor(
    private readonly db: PrismaService,
    private readonly gate: AccessGate,
    private readonly policies: PolicyService,
    private readonly audit: AuditService,
    private readonly sessions: SessionService,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  async policy(): Promise<{ inviteOnly: boolean }> {
    return { inviteOnly: this.gate.inviteOnly() }
  }

  async list(actorId: string, search?: string | null): Promise<AccessAllowlistView[]> {
    await this.assertAdmin(actorId)
    const q = search?.trim()
    const rows = await this.db.accessAllowlistEntry.findMany({
      where: q
        ? { OR: [{ email: { contains: q, mode: 'insensitive' } }, { note: { contains: q, mode: 'insensitive' } }] }
        : {},
      orderBy: [{ createdAt: 'desc' }, { email: 'asc' }],
    })
    return this.hydrate(rows)
  }

  async add(actorId: string, input: { email: string; role: GlobalRoleName; note?: string | null }): Promise<AccessAllowlistView> {
    const actor = await this.actor(actorId)
    const email = parseField(emailSchema, input.email, 'email')
    const note = this.note(input.note, true)
    const existing = await this.db.accessAllowlistEntry.findUnique({ where: { email }, select: { id: true } })
    if (existing) throw Errors.conflict('This email is already on the access list.', ['input', 'email'])
    const account = await this.account(email)
    const counts = await this.adminCounts()
    this.refuse(allowlistGuard({
      actorEmail: actor.email,
      actorRole: actor.globalRole,
      entryEmail: email,
      entryRole: input.role,
      nextRole: account && account.globalRole !== input.role ? input.role : null,
      accountRole: account?.globalRole ?? null,
      platformAdminEntries: counts.entries,
      platformAdminAccounts: counts.accounts,
      removing: false,
    }))

    const id = newId()
    try {
      await this.db.$transaction(async (tx) => {
        await tx.accessAllowlistEntry.create({ data: { id, email, role: input.role, note, addedById: actorId } })
        if (account && account.globalRole !== input.role) {
          await tx.user.update({ where: { id: account.id }, data: { globalRole: input.role } })
        }
        await this.audit.record({
          actorId,
          action: 'access_allowlist.added',
          targetType: 'AccessAllowlistEntry',
          targetId: id,
          metadata: { email, role: input.role, note },
        }, tx)
      })
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw Errors.conflict('This email is already on the access list.', ['input', 'email'])
      }
      throw e
    }
    if (account && account.globalRole !== input.role) await this.roleApplied(account.id, input.role)
    return this.one(id)
  }

  async update(actorId: string, input: { id: string; role?: GlobalRoleName | null; note?: string | null }): Promise<AccessAllowlistView> {
    const actor = await this.actor(actorId)
    const entry = await this.db.accessAllowlistEntry.findUnique({ where: { id: input.id } })
    if (!entry) throw Errors.notFound('That access list entry was not found.')
    const nextRole = input.role ?? null
    const note = this.note(input.note, false)
    if (nextRole === null && note === undefined) return (await this.hydrate([entry]))[0]!

    const account = await this.account(entry.email)
    const roleChanges = nextRole !== null && (nextRole !== entry.role || (account !== null && account.globalRole !== nextRole))
    const counts = await this.adminCounts()
    this.refuse(allowlistGuard({
      actorEmail: actor.email,
      actorRole: actor.globalRole,
      entryEmail: entry.email,
      entryRole: entry.role as GlobalRoleName,
      nextRole: roleChanges ? nextRole : null,
      accountRole: account?.globalRole ?? null,
      platformAdminEntries: counts.entries,
      platformAdminAccounts: counts.accounts,
      removing: false,
    }))

    const role = (nextRole ?? entry.role) as GlobalRoleName
    await this.db.$transaction(async (tx) => {
      await tx.accessAllowlistEntry.update({
        where: { id: entry.id },
        data: { ...(nextRole ? { role: nextRole } : {}), ...(note !== undefined ? { note } : {}) },
      })
      if (account && account.globalRole !== role) {
        await tx.user.update({ where: { id: account.id }, data: { globalRole: role } })
      }
      await this.audit.record({
        actorId,
        action: 'access_allowlist.updated',
        targetType: 'AccessAllowlistEntry',
        targetId: entry.id,
        metadata: { email: normalizeAllowlistEmail(entry.email), role, note: note === undefined ? entry.note : note, previousRole: entry.role },
      }, tx)
    })
    if (account && account.globalRole !== role) await this.roleApplied(account.id, role)
    return this.one(entry.id)
  }

  async remove(actorId: string, id: string): Promise<void> {
    const actor = await this.actor(actorId)
    const entry = await this.db.accessAllowlistEntry.findUnique({ where: { id } })
    if (!entry) throw Errors.notFound('That access list entry was not found.')
    const account = await this.account(entry.email)
    const counts = await this.adminCounts()
    this.refuse(allowlistGuard({
      actorEmail: actor.email,
      actorRole: actor.globalRole,
      entryEmail: entry.email,
      entryRole: entry.role as GlobalRoleName,
      nextRole: null,
      accountRole: account?.globalRole ?? null,
      platformAdminEntries: counts.entries,
      platformAdminAccounts: counts.accounts,
      removing: true,
    }))

    await this.db.$transaction(async (tx) => {
      await tx.accessAllowlistEntry.delete({ where: { id: entry.id } })
      await this.audit.record({
        actorId,
        action: 'access_allowlist.removed',
        targetType: 'AccessAllowlistEntry',
        targetId: entry.id,
        metadata: { email: normalizeAllowlistEmail(entry.email), role: entry.role },
      }, tx)
    })
    if (account) await this.sessions.revokeAll(account.id)
  }

  private async roleApplied(userId: string, role: GlobalRoleName): Promise<void> {
    await this.sessions.revokeAll(userId)
    await this.events.publish('RoleChanged', { userId, globalRole: role })
  }

  private refuse(result: { ok: true } | { ok: false; message: string }): void {
    if (!result.ok) throw Errors.forbidden(result.message)
  }

  private async actor(actorId: string): Promise<{ email: string; globalRole: GlobalRoleName }> {
    await this.assertAdmin(actorId)
    const user = await this.db.user.findUnique({ where: { id: actorId }, select: { email: true, globalRole: true } })
    if (!user) throw Errors.unauthenticated()
    return { email: user.email, globalRole: user.globalRole as GlobalRoleName }
  }

  private async assertAdmin(userId: string): Promise<void> {
    const actor = await this.policies.actor(userId)
    if (!actor) throw Errors.unauthenticated()
    if (actor.globalRole !== GlobalRole.PLATFORM_ADMIN) throw Errors.forbidden()
  }

  private async account(email: string): Promise<{ id: string; globalRole: GlobalRoleName } | null> {
    const user = await this.db.user.findFirst({
      where: { email: normalizeAllowlistEmail(email), deletedAt: null },
      select: { id: true, globalRole: true },
    })
    return user ? { id: user.id, globalRole: user.globalRole as GlobalRoleName } : null
  }

  private async adminCounts(): Promise<{ entries: number; accounts: number }> {
    const [entries, accounts] = await Promise.all([
      this.db.accessAllowlistEntry.count({ where: { role: 'PLATFORM_ADMIN' } }),
      this.db.user.count({ where: { globalRole: 'PLATFORM_ADMIN', deletedAt: null } }),
    ])
    return { entries, accounts }
  }

  /** `required` stores a missing note as null. Otherwise undefined means "leave it". */
  private note(value: string | null | undefined, required: boolean): string | null | undefined {
    if (value === undefined) return required ? null : undefined
    if (value === null) return null
    const trimmed = value.trim()
    if (!trimmed) return null
    if (trimmed.length > ALLOWLIST_NOTE_MAX) throw Errors.validation(`Use at most ${ALLOWLIST_NOTE_MAX} characters.`, ['input', 'note'])
    return trimmed
  }

  private async one(id: string): Promise<AccessAllowlistView> {
    const row = await this.db.accessAllowlistEntry.findUniqueOrThrow({ where: { id } })
    return (await this.hydrate([row]))[0]!
  }

  private async hydrate(rows: EntryRow[]): Promise<AccessAllowlistView[]> {
    if (!rows.length) return []
    const emails = rows.map((row) => normalizeAllowlistEmail(row.email))
    const adderIds = [...new Set(rows.map((row) => row.addedById).filter((id): id is string => id !== null))]
    const [accounts, adders] = await Promise.all([
      this.db.user.findMany({ where: { email: { in: emails }, deletedAt: null }, select: { email: true } }),
      adderIds.length ? this.db.user.findMany({ where: { id: { in: adderIds }, deletedAt: null }, select: { id: true, email: true } }) : [],
    ])
    const have = new Set(accounts.map((account) => normalizeAllowlistEmail(account.email)))
    const byId = new Map(adders.map((adder) => [adder.id, normalizeAllowlistEmail(adder.email)]))
    return rows.map((row) => ({
      id: row.id,
      email: normalizeAllowlistEmail(row.email),
      role: row.role,
      note: row.note,
      hasAccount: have.has(normalizeAllowlistEmail(row.email)),
      addedByEmail: row.addedById ? (byId.get(row.addedById) ?? null) : null,
      createdAt: row.createdAt,
    }))
  }
}
