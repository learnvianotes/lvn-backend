import { Inject, Injectable, Logger } from '@nestjs/common'
import { pushMessage, type NotificationCategory, type PushMessage } from '@lvn/contracts/notifications'
import { PEOPLE, type People } from '@lvn-backend/facades'
import { PrismaService } from '@lvn-backend/prisma-base'
import { Queues } from '@lvn-backend/queue'
import { COMMUNICATION_CONFIG, type CommunicationConfig } from '../communication.config'
import { PreferencesService } from '../preferences/preferences.service'
import { DevicesService } from './devices.service'
import { FcmSender } from './fcm'

export const COMMS_PUSH_QUEUE = 'comms.push'

/**
 * The body of a push: written here from the category and the actor's name, never from note, comment or doubt text
 * (ADR-0021). `actor` is null for a recipient who is a restricted minor, who gets no names at all.
 */
export function pushBody(category: NotificationCategory, data: Record<string, unknown>, actor: string | null): string {
  const who = actor ?? 'Someone'
  switch (category) {
    case 'SHARE':
      return `${who} shared a note with you`
    case 'COMMENT':
      return data.kind === 'REPLY' ? `${who} replied to your comment` : `${who} commented`
    case 'FOLLOW':
      return `${who} started following you`
    case 'CONNECTION':
      return data.kind === 'ACCEPTED' ? `${who} accepted your connection request` : `${who} wants to connect with you`
    case 'JOIN_REQUEST':
      return `${who} asked to join`
    case 'JOIN_DECISION':
      return data.decision === 'APPROVED' ? 'Your request to join was accepted' : "Your request to join wasn't accepted"
    case 'CLASSROOM_INVITE':
      return `${who} invited you to a class`
    case 'CLASSROOM_POST':
      return `${who} posted a class announcement`
    case 'QUIZ_PUBLISHED':
      return `${who} published a quiz to your class`
    case 'MENTOR_INVITE':
      return `${who} asked you to mentor a project`
    case 'DOUBT':
      return data.kind === 'ANSWERED' ? `${who} answered your doubt` : data.kind === 'RESOLVED' ? `${who} marked your doubt resolved` : `${who} asked a doubt`
    case 'VERIFICATION':
      return data.kind === 'REQUESTED' ? `${who} asked you to verify their account` : 'There is news about your verification'
    case 'DATA_EXPORT':
      return 'Your data export is ready'
    case 'NOTES_IMPORT':
      return 'Your import is done'
    case 'MENTION':
      return `${who} mentioned you`
    case 'RHYTHM_BUDDY':
      return data.kind === 'ACCEPTED' ? `${who} is now your Rhythm buddy` : `${who} asked you to be Rhythm buddies`
    case 'REVISION_REMINDER':
      return 'Today’s revision for your exam is waiting'
    case 'MODERATION':
      return data.kind === 'RESTORED' ? 'A moderator brought back something of yours' : 'A moderator reviewed something of yours'
    default:
      return 'You have something new'
  }
}

/**
 * Push (ADR-0021, ADR-0050). The API and the worker enqueue one job per notification after writing it; the worker
 * sends it to the person's phones unless they turned the category off, it is their quiet hours, or push is not
 * configured. A token FCM says is gone is deleted.
 */
@Injectable()
export class PushService {
  private readonly log = new Logger('Push')
  private readonly fcm: FcmSender | null

  constructor(
    private readonly db: PrismaService,
    private readonly queues: Queues,
    private readonly devices: DevicesService,
    private readonly preferences: PreferencesService,
    @Inject(PEOPLE) private readonly people: People,
    @Inject(COMMUNICATION_CONFIG) config: CommunicationConfig,
  ) {
    this.fcm = config.push ? new FcmSender(config.push) : null
  }

  get enabled(): boolean {
    return this.fcm !== null
  }

  async enqueue(notificationIds: string[]): Promise<void> {
    if (!this.fcm || !notificationIds.length) return
    await this.queues.queue(COMMS_PUSH_QUEUE).addBulk(notificationIds.map((notificationId) => ({ name: 'send', data: { notificationId } })))
  }

  /** The message for a notification, checked against the contract; null when there is nothing to send. */
  async message(notificationId: string): Promise<{ userId: string; category: NotificationCategory; message: PushMessage } | null> {
    const n = await this.db.notification.findUnique({ where: { id: notificationId } })
    if (!n || n.readAt) return null
    const contact = await this.people.contactOf(n.userId)
    if (!contact) return null
    const actor = n.actorId && !contact.restrictedMinor ? ((await this.people.namesOf([n.actorId]))[n.actorId] ?? null) : null
    const category = n.category as NotificationCategory
    const message = pushMessage.parse({ title: 'LearnViaNotes', body: pushBody(category, (n.data ?? {}) as Record<string, unknown>, actor).slice(0, 120), data: { notificationId: n.id, category, path: n.path } })
    return { userId: n.userId, category, message }
  }

  /** Sends one notification's push; returns how many phones got it. Throws to retry when FCM failed for a while. */
  async deliver(notificationId: string, at = new Date()): Promise<number> {
    if (!this.fcm) return 0
    const built = await this.message(notificationId)
    if (!built || !(await this.preferences.pushAllowed(built.userId, built.category, at))) return 0
    const tokens = await this.devices.tokensOf(built.userId)
    let sent = 0
    let retry = false
    for (const token of tokens) {
      const result = await this.fcm.send(token, built.message)
      if (result === 'SENT') sent++
      else if (result === 'GONE') await this.devices.forget(token)
      else retry = true
    }
    if (retry && !sent) throw new Error(`push of ${notificationId} failed; it will be retried`)
    this.log.log(`push ${built.category} to ${sent} of ${tokens.length} devices`)
    return sent
  }
}
