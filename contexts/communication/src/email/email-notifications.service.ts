import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import type { NotificationCategory } from '@lvn/contracts/notifications'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { PEOPLE, PLACES, type People, type Places } from '@lvn-backend/facades'
import { PrismaService } from '@lvn-backend/prisma-base'
import { Queues } from '@lvn-backend/queue'
import { COMMUNICATION_CONFIG, type CommunicationConfig } from '../communication.config'
import { MailService } from '../mail/mail.service'
import { PreferencesService } from '../preferences/preferences.service'
import { unsubscribeToken, type EmailKind } from './unsubscribe'

export const COMMS_EMAIL_QUEUE = 'comms.email'
const DAY_MS = 86_400_000

/** One digest line per kind of notification, counted (ADR-0050). Nothing is quoted. */
const DIGEST_LINE: Partial<Record<NotificationCategory, (n: number) => string>> = {
  SHARE: (n) => `${n} ${n === 1 ? 'note' : 'notes'} shared with you`,
  COMMENT: (n) => `${n} ${n === 1 ? 'comment or reply' : 'comments and replies'}`,
  FOLLOW: (n) => `${n} new ${n === 1 ? 'follower' : 'followers'}`,
  CONNECTION: (n) => `${n} connection ${n === 1 ? 'update' : 'updates'}`,
  JOIN_REQUEST: (n) => `${n} ${n === 1 ? 'request' : 'requests'} to join your groups and classes`,
  JOIN_DECISION: (n) => `${n} ${n === 1 ? 'answer' : 'answers'} to your requests to join`,
  CLASSROOM_INVITE: (n) => `${n} class ${n === 1 ? 'invite' : 'invites'}`,
  CLASSROOM_POST: (n) => `${n} class ${n === 1 ? 'announcement' : 'announcements'}`,
  MENTOR_INVITE: (n) => `${n} ${n === 1 ? 'invite' : 'invites'} to mentor`,
  DOUBT: (n) => `${n} ${n === 1 ? 'update' : 'updates'} on doubts`,
}

/**
 * Email beyond the transactional ones (ADR-0050): class announcements to members who keep them on, and a weekly
 * digest of unread notifications. Both carry a one-click unsubscribe for their kind.
 */
@Injectable()
export class EmailNotificationsService implements OnModuleInit {
  private readonly log = new Logger('EmailNotifications')

  constructor(
    private readonly db: PrismaService,
    private readonly queues: Queues,
    private readonly mail: MailService,
    private readonly preferences: PreferencesService,
    @Inject(PEOPLE) private readonly people: People,
    @Inject(PLACES) private readonly places: Places,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(COMMUNICATION_CONFIG) private readonly config: CommunicationConfig,
  ) {}

  onModuleInit(): void {
    // One email job per member; the worker checks the preference when it sends.
    this.events.subscribe('ClassroomPosted', async ({ payload }) => {
      await this.queues.queue(COMMS_EMAIL_QUEUE).addBulk(payload.memberIds.map((userId) => ({ name: 'classroom-post', data: { postId: payload.postId, userId } })))
    })
  }

  /** The page a person opens from the email, and the address mail clients POST to for one-click unsubscribe. */
  private unsubscribe(userId: string, kind: EmailKind) {
    const web = this.config.webUrl.replace(/\/$/, '')
    const t = unsubscribeToken(this.config.hmacSecret, userId, kind)
    return { link: `${web}/unsubscribe?t=${t}`, oneClick: `${web}/unsubscribe/one-click?t=${t}` }
  }

  /** Returns whether an email went out. */
  async sendClassroomPost(postId: string, userId: string): Promise<boolean> {
    if (!(await this.preferences.emailAllowed(userId, 'CLASSROOM_POST'))) return false
    const [contact, post] = await Promise.all([this.people.contactOf(userId), this.places.announcement(postId)])
    if (!contact || !post) return false
    const teacherName = (await this.people.namesOf([post.authorId]))[post.authorId] ?? 'Your teacher'
    const leave = this.unsubscribe(userId, 'CLASSROOM_POST')
    await this.mail.send(
      contact.email,
      'classroomPost',
      { displayName: contact.displayName, teacherName, classroomName: post.classroomName, text: post.text.slice(0, 4000), link: `${this.config.webUrl.replace(/\/$/, '')}/classes/${post.classroomId}`, unsubscribeLink: leave.link },
      { unsubscribeUrl: leave.oneClick },
    )
    return true
  }

  /** Weekly (apps/worker): people with unread notifications from the past week, at most once in six days. */
  async sendDigests(now = new Date()): Promise<number> {
    const since = new Date(now.getTime() - 7 * DAY_MS)
    const unread = await this.db.notification.groupBy({ by: ['userId', 'category'], where: { readAt: null, createdAt: { gte: since } }, _count: { _all: true } })
    const byUser = new Map<string, { category: NotificationCategory; n: number }[]>()
    for (const r of unread) byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), { category: r.category as NotificationCategory, n: r._count._all }])
    let sent = 0
    for (const [userId, counts] of byUser) {
      const settings = await this.db.notificationSettings.findUnique({ where: { userId } })
      if (settings?.weeklyDigest === false || (settings?.lastDigestAt && settings.lastDigestAt > new Date(now.getTime() - 6 * DAY_MS))) continue
      const lines = counts.sort((a, b) => b.n - a.n).flatMap((c) => DIGEST_LINE[c.category]?.(c.n) ?? [])
      const contact = await this.people.contactOf(userId)
      if (!contact || !lines.length) continue
      const leave = this.unsubscribe(userId, 'DIGEST')
      await this.mail.send(contact.email, 'weeklyDigest', { displayName: contact.displayName, lines, link: `${this.config.webUrl.replace(/\/$/, '')}/notifications`, unsubscribeLink: leave.link }, { unsubscribeUrl: leave.oneClick })
      await this.db.notificationSettings.upsert({ where: { userId }, create: { userId, lastDigestAt: now }, update: { lastDigestAt: now } })
      sent++
    }
    this.log.log(`sent ${sent} weekly digests`)
    return sent
  }
}
