import { Injectable, Logger } from '@nestjs/common'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import type { NotificationCategory } from '@lvn/contracts/notifications'
import { LiveHub } from '../live/live-hub'
import { PushService } from '../push/push.service'

export interface NewNotification {
  /** Who it is for */
  userId: string
  category: NotificationCategory
  /** In-app path, the same on web and phone ("/notes/<id>") */
  path: string
  actorId?: string | null
  noteId?: string | null
  groupId?: string | null
  classroomId?: string | null
  /** Category facts that are never user content: a decision, counts */
  data?: Record<string, string | number | boolean>
}

export interface NotificationRow {
  id: string
  userId: string
  category: NotificationCategory
  path: string
  actorId: string | null
  noteId: string | null
  groupId: string | null
  classroomId: string | null
  data: unknown
  readAt: Date | null
  createdAt: Date
}

const DAY_MS = 24 * 60 * 60 * 1000
/** ADR-0042: read notifications are kept 90 days, unread ones a year. */
export const KEEP_READ_DAYS = 90
export const KEEP_UNREAD_DAYS = 365

/**
 * In-app notifications (§9.3, ADR-0042): written first, whatever else is sent, then announced to the person's open
 * sockets. A notification never holds note, comment or message text — only ids, a path and small facts.
 */
@Injectable()
export class NotificationService {
  private readonly log = new Logger('Notifications')

  constructor(
    private readonly db: PrismaService,
    private readonly live: LiveHub,
    private readonly push: PushService,
  ) {}

  /** Writes one notification; nobody is told about their own doing. Returns its id, or null when skipped. */
  async notify(n: NewNotification): Promise<string | null> {
    if (n.actorId && n.actorId === n.userId) return null
    const id = newId()
    const createdAt = new Date()
    await this.db.notification.create({ data: this.row(id, n.userId, n, createdAt) })
    await this.announce(n.userId, id, createdAt)
    await this.queuePush([id])
    return id
  }

  /** The same notification for many people (a class announcement): one insert, then each person's sockets. */
  async notifyMany(userIds: string[], n: Omit<NewNotification, 'userId'>): Promise<number> {
    const createdAt = new Date()
    const rows = [...new Set(userIds)].filter((userId) => userId !== n.actorId).map((userId) => this.row(newId(), userId, n, createdAt))
    if (!rows.length) return 0
    await this.db.notification.createMany({ data: rows })
    await Promise.all(rows.map((r) => this.announce(r.userId, r.id, createdAt)))
    await this.queuePush(rows.map((r) => r.id))
    return rows.length
  }

  private row(id: string, userId: string, n: Omit<NewNotification, 'userId'>, createdAt: Date) {
    return { id, userId, category: n.category, path: n.path, actorId: n.actorId ?? null, noteId: n.noteId ?? null, groupId: n.groupId ?? null, classroomId: n.classroomId ?? null, data: n.data, createdAt }
  }

  // Push is a courtesy too (ADR-0050): a full queue never loses the in-app notification.
  private async queuePush(ids: string[]) {
    await this.push.enqueue(ids).catch((err: unknown) => this.log.warn(`push not queued: ${err instanceof Error ? err.message : String(err)}`))
  }

  // Live delivery is a courtesy: the notification is already stored and the next fetch shows it.
  private async announce(userId: string, id: string, createdAt: Date) {
    await this.live.publish(userId, { type: 'event', event: { kind: 'NOTIFICATION', id, at: createdAt.toISOString() } }).catch((err: unknown) => {
      this.log.warn(`live delivery of ${id} failed: ${err instanceof Error ? err.message : String(err)}`)
    })
  }

  /** Newest first; `after` is the [createdAt, id] of the last row of the previous page. */
  async list(userId: string, size: number, after: [string, string] | null): Promise<NotificationRow[]> {
    const before = after ? { createdAt: new Date(after[0]), id: after[1] } : null
    return (await this.db.notification.findMany({
      where: {
        userId,
        ...(before ? { OR: [{ createdAt: { lt: before.createdAt } }, { createdAt: before.createdAt, id: { lt: before.id } }] } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: size + 1,
    })) as NotificationRow[]
  }

  async get(userId: string, id: string): Promise<NotificationRow | null> {
    return (await this.db.notification.findFirst({ where: { id, userId } })) as NotificationRow | null
  }

  unreadCount(userId: string): Promise<number> {
    return this.db.notification.count({ where: { userId, readAt: null } })
  }

  /** Marks the viewer's own notifications read — the listed ones, or all — and returns what stays unread. */
  async markRead(userId: string, ids: string[] | 'all'): Promise<number> {
    await this.db.notification.updateMany({ where: { userId, readAt: null, ...(ids === 'all' ? {} : { id: { in: ids } }) }, data: { readAt: new Date() } })
    return this.unreadCount(userId)
  }

  /** Nightly (ADR-0042). */
  async prune(now = new Date()): Promise<number> {
    const read = await this.db.notification.deleteMany({ where: { readAt: { not: null }, createdAt: { lt: new Date(now.getTime() - KEEP_READ_DAYS * DAY_MS) } } })
    const unread = await this.db.notification.deleteMany({ where: { readAt: null, createdAt: { lt: new Date(now.getTime() - KEEP_UNREAD_DAYS * DAY_MS) } } })
    return read.count + unread.count
  }

  /** A deleted account (§7.2): its notifications go, and it stops being named in anyone else's. */
  async forget(userId: string): Promise<void> {
    await this.db.notification.deleteMany({ where: { userId } })
    await this.db.notification.updateMany({ where: { actorId: userId }, data: { actorId: null } })
  }
}
