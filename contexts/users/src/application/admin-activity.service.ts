import { Injectable } from '@nestjs/common'
import { Errors } from '@lvn-backend/errors'
import { isUuid, Prisma, PrismaService } from '@lvn-backend/prisma-base'
import { AdminService } from './admin.service'

const DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_DAYS = 30
const MAX_DAYS = 366
const PAGE_DEFAULT = 50
const PAGE_MAX = 100

export interface ActivityFilter {
  actorId?: string | null
  action?: string | null
  targetType?: string | null
  from?: Date | null
  to?: Date | null
}

/**
 * Reads the append-only audit log for the admin dashboard. Writing stays on AuditService;
 * nothing here updates or deletes a row.
 */
@Injectable()
export class AdminActivityService {
  constructor(
    private readonly db: PrismaService,
    private readonly admin: AdminService,
  ) {}

  async list(adminId: string, filter: ActivityFilter | null | undefined, cursor: string | null | undefined, limit: number | null | undefined) {
    await this.admin.assertAdmin(adminId)
    const take = Math.min(Math.max(limit ?? PAGE_DEFAULT, 1), PAGE_MAX)
    const where = this.where(filter, cursor)
    const rows = await this.db.auditLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
    })
    const page = rows.slice(0, take)
    const next = rows.length > take ? page.at(-1) : undefined
    return {
      entries: page.map((row) => ({
        id: row.id,
        actorId: row.actorId,
        actorEmail: row.actorEmail,
        action: row.action,
        targetType: row.targetType,
        targetId: row.targetId,
        details: row.metadata,
        ip: row.ip,
        userAgent: row.userAgent,
        createdAt: row.createdAt,
      })),
      nextCursor: next ? encodeCursor(next.createdAt, next.id) : null,
    }
  }

  async summary(adminId: string, from: Date | null | undefined, to: Date | null | undefined) {
    await this.admin.assertAdmin(adminId)
    const { start, end } = window(from, to)
    const where = { createdAt: { gte: start, lt: end } }
    const [grouped, days] = await Promise.all([
      this.db.auditLog.groupBy({ by: ['action'], where, _count: { _all: true } }),
      this.db.$queryRaw<Array<{ day: Date; count: number }>>(
        Prisma.sql`SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::int AS count FROM users."AuditLog" WHERE "createdAt" >= ${start} AND "createdAt" < ${end} GROUP BY 1 ORDER BY 1`,
      ),
    ])
    const byAction = grouped
      .map((row) => ({ action: row.action, count: row._count._all }))
      .sort((a, b) => b.count - a.count || a.action.localeCompare(b.action))
    return {
      from: start,
      to: end,
      total: byAction.reduce((sum, row) => sum + row.count, 0),
      byAction,
      byDay: days.map((row) => ({ day: new Date(row.day), count: Number(row.count) })),
    }
  }

  private where(filter: ActivityFilter | null | undefined, cursor: string | null | undefined): Prisma.AuditLogWhereInput {
    const { start, end } = window(filter?.from, filter?.to, false)
    const and: Prisma.AuditLogWhereInput[] = []
    if (filter?.from || filter?.to) and.push({ createdAt: { gte: start, lt: end } })
    if (filter?.actorId) {
      if (!isUuid(filter.actorId)) throw Errors.validation('Unknown account.', ['filter', 'actorId'])
      and.push({ actorId: filter.actorId })
    }
    if (filter?.action) and.push({ action: filter.action })
    if (filter?.targetType) and.push({ targetType: filter.targetType })
    if (cursor) {
      const parsed = decodeCursor(cursor)
      if (!parsed) throw Errors.validation('That page cursor is not valid.', ['cursor'])
      and.push({
        OR: [{ createdAt: { lt: parsed.at } }, { createdAt: parsed.at, id: { lt: parsed.id } }],
      })
    }
    return and.length ? { AND: and } : {}
  }
}

/** A bounded window. Without dates, the summary uses the last 30 days and a list is not bounded. */
function window(from: Date | null | undefined, to: Date | null | undefined, bounded = true): { start: Date; end: Date } {
  const end = to ?? new Date()
  const start = from ?? new Date(end.getTime() - DEFAULT_DAYS * DAY_MS)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw Errors.validation('Use a real date.', ['from'])
  if (start.getTime() >= end.getTime()) throw Errors.validation('The start must be before the end.', ['from'])
  if ((bounded || from || to) && end.getTime() - start.getTime() > MAX_DAYS * DAY_MS) throw Errors.validation('The window can be at most 366 days.', ['from'])
  return { start, end }
}

function encodeCursor(at: Date, id: string): string {
  return Buffer.from(`${at.toISOString()}|${id}`).toString('base64url')
}

function decodeCursor(cursor: string): { at: Date; id: string } | null {
  const text = Buffer.from(cursor, 'base64url').toString('utf8')
  const split = text.lastIndexOf('|')
  if (split <= 0) return null
  const at = new Date(text.slice(0, split))
  const id = text.slice(split + 1)
  if (Number.isNaN(at.getTime()) || !isUuid(id)) return null
  return { at, id }
}
