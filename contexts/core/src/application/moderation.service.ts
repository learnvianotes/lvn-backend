import { readFileSync } from 'node:fs'
import { Inject, Injectable } from '@nestjs/common'
import { Action, can, type ModerationActionType, type ReportEntityType, type ReportReason } from '@lvn/contracts/domain'
import { Errors } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { AUDIT, NOTE_MODERATION, POLICY, type Audit, type ModeratedNote, type Moderation, type ModerationStateKind, type ModerationSubject, type NoteModeration, type Policy } from '@lvn-backend/facades'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { RateLimiter } from '@lvn-backend/redis'
import { CORE_CONFIG, type CoreConfig } from '../core.config'
import { builtInWords, parseWordList, score, type WordRule } from '../domain/rule-scorer'

/** Open reports from this many different people hold a public note until a moderator looks (ADR-0037). */
export const REPORTS_TO_HOLD = 3
const MAX_DETAILS = 1_000
const MAX_APPEAL = 2_000

/** What each decision does to a note's moderation state; undefined leaves it, `release` frees a held note. */
const NOTE_STATE: Record<ModerationActionType, ModerationStateKind | 'release' | undefined> = {
  APPROVE: 'OK',
  HIDE: 'HIDDEN',
  REMOVE: 'REMOVED',
  DISMISS: 'release',
  WARN: 'release',
  SUSPEND: undefined,
}

export interface ModerationCase {
  entityType: ReportEntityType
  entityId: string
  note: ModeratedNote | null
  reports: { reason: ReportReason; details: string | null; reporterId: string | null; createdAt: Date }[]
  appeal: { message: string; createdAt: Date } | null
  openedAt: Date
}

/**
 * Moderation in the `core` context (§15.1, ADR-0037): the MODERATION facade that screens content on its way to the
 * public, reports from people, the platform queue with its decisions, and the author's one appeal. Notes' moderation
 * state is changed through NOTE_MODERATION; every decision is a ModerationAction and an audit entry.
 */
@Injectable()
export class ModerationService implements Moderation {
  private readonly words: WordRule[]

  constructor(
    private readonly db: PrismaService,
    private readonly limiter: RateLimiter,
    @Inject(POLICY) private readonly policy: Policy,
    @Inject(NOTE_MODERATION) private readonly notes: NoteModeration,
    @Inject(AUDIT) private readonly audit: Audit,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(CORE_CONFIG) config: CoreConfig,
  ) {
    const extra = config.moderation.wordsFile ? parseWordList(readFileSync(config.moderation.wordsFile, 'utf8')) : []
    this.words = [...builtInWords(), ...extra]
  }

  // ── MODERATION facade ────────────────────────────────────────────────────────────────────────────────────

  /** The rule-based verdict on a few words (ADR-0047): comments are refused when flagged, with the reason in words. */
  check(text: string): { flagged: boolean; message: string | null } {
    const verdict = score({ title: '', text }, this.words)
    return { flagged: verdict.flagged, message: verdict.flagged ? verdict.message : null }
  }

  async screen(subject: ModerationSubject): Promise<{ held: boolean; reason: string | null }> {
    const verdict = score(subject, this.words)
    if (!verdict.flagged) return { held: false, reason: null }
    const id = newId()
    await this.db.report.create({ data: { id, entityType: subject.type, entityId: subject.id, reporterId: null, reason: verdict.reason!, details: `Held on the way to the public: ${verdict.message}` } })
    await this.audit.record({ actorId: null, action: 'moderation.held', targetType: subject.type, targetId: subject.id, metadata: { reason: verdict.reason } })
    await this.events.publish('ContentReported', { reportId: id, entityType: subject.type, entityId: subject.id })
    return { held: true, reason: `A moderator will look at this note before it is public: ${verdict.message}` }
  }

  // ── Reports ──────────────────────────────────────────────────────────────────────────────────────────────

  async report(viewerId: string, input: { entityType: ReportEntityType; entityId: string; reason: ReportReason; details?: string | null }): Promise<void> {
    const actor = await this.policy.actor(viewerId)
    if (!can(actor, Action.CONTENT_REPORT)) throw Errors.forbidden()
    const details = input.details?.trim().slice(0, MAX_DETAILS) || null
    if (input.entityType === 'NOTE') {
      // Only what the reporter can see can be reported; anything else is "not found", as everywhere (§5).
      if (!(await this.notes.canRead(viewerId, input.entityId))) throw Errors.notFound('Note not found.')
      const [note] = await this.notes.describe([input.entityId])
      if (note?.ownerId === viewerId) throw Errors.validation('This is your own note.', ['input', 'entityId'])
    } else {
      if (input.entityId === viewerId) throw Errors.validation('You cannot report yourself.', ['input', 'entityId'])
      if (!(await this.policy.actor(input.entityId))) throw Errors.notFound('Account not found.')
    }
    const limit = await this.limiter.hit(`reports:${viewerId}`, { max: 20, windowSeconds: 3600 })
    if (!limit.allowed) throw Errors.rateLimited(limit.retryAfter, 'You have sent many reports in the last hour. Try again later.')

    const key = { entityType: input.entityType, entityId: input.entityId, reporterId: viewerId }
    const saved = await this.db.report.upsert({
      where: { entityType_entityId_reporterId: key },
      create: { id: newId(), ...key, reason: input.reason, details },
      update: { reason: input.reason, details, status: 'OPEN', resolvedAt: null, resolvedById: null },
    })
    await this.events.publish('ContentReported', { reportId: saved.id, entityType: input.entityType, entityId: input.entityId })

    if (input.entityType === 'NOTE') {
      const people = await this.db.report.count({ where: { entityType: 'NOTE', entityId: input.entityId, status: 'OPEN', reporterId: { not: null } } })
      const [note] = await this.notes.describe([input.entityId])
      if (people >= REPORTS_TO_HOLD && note?.visibility === 'PUBLIC' && note.moderation === 'OK') {
        await this.notes.setState(input.entityId, 'PENDING_REVIEW', 'Several people reported this note. A moderator will look at it.')
        await this.audit.record({ actorId: null, action: 'moderation.held', targetType: 'NOTE', targetId: input.entityId, metadata: { reports: people } })
      }
    }
  }

  // ── The platform queue (PLATFORM_ADMIN until the admin app exists, §15.1) ─────────────────────────────────

  /** Open cases, oldest first: entities with open reports or an open appeal. */
  async queue(adminId: string, offset: number, size: number): Promise<{ cases: ModerationCase[]; hasMore: boolean }> {
    await this.requireModerator(adminId)
    const [reports, appeals] = await Promise.all([
      this.db.report.findMany({ where: { status: 'OPEN' }, orderBy: { createdAt: 'asc' }, take: 2_000 }),
      this.db.moderationAppeal.findMany({ where: { status: 'OPEN' }, orderBy: { createdAt: 'asc' }, take: 500 }),
    ])
    const cases = new Map<string, ModerationCase>()
    const caseOf = (entityType: ReportEntityType, entityId: string, at: Date) => {
      const key = `${entityType}:${entityId}`
      let c = cases.get(key)
      if (!c) cases.set(key, (c = { entityType, entityId, note: null, reports: [], appeal: null, openedAt: at }))
      if (at < c.openedAt) c.openedAt = at
      return c
    }
    for (const r of reports) caseOf(r.entityType, r.entityId, r.createdAt).reports.push({ reason: r.reason, details: r.details, reporterId: r.reporterId, createdAt: r.createdAt })
    for (const a of appeals) caseOf(a.entityType, a.entityId, a.createdAt).appeal = { message: a.message, createdAt: a.createdAt }
    const all = [...cases.values()].sort((a, b) => a.openedAt.getTime() - b.openedAt.getTime())
    const page = all.slice(offset, offset + size)
    const notes = new Map((await this.notes.describe(page.filter((c) => c.entityType === 'NOTE').map((c) => c.entityId))).map((n) => [n.id, n]))
    for (const c of page) c.note = notes.get(c.entityId) ?? null
    return { cases: page, hasMore: all.length > offset + size }
  }

  /** A moderator's decision on a case: the entity's new state, the reports and appeal closed, the action recorded. */
  async decide(adminId: string, input: { entityType: ReportEntityType; entityId: string; action: ModerationActionType; reason?: string | null }): Promise<void> {
    await this.requireModerator(adminId)
    const reason = input.reason?.trim().slice(0, MAX_DETAILS) || null
    if (input.action === 'SUSPEND') throw Errors.validation('Suspending accounts is not available yet.', ['input', 'action'])
    if ((input.action === 'HIDE' || input.action === 'REMOVE' || input.action === 'WARN') && !reason) {
      throw Errors.validation('Say why: the author is told.', ['input', 'reason'])
    }
    if (input.entityType === 'USER' && input.action !== 'DISMISS' && input.action !== 'WARN') {
      throw Errors.validation('Accounts can be warned or their reports dismissed.', ['input', 'action'])
    }
    let note: ModeratedNote | undefined
    if (input.entityType === 'NOTE') {
      ;[note] = await this.notes.describe([input.entityId])
      if (!note) throw Errors.notFound('Note not found.')
    }

    const now = new Date()
    await this.db.$transaction([
      this.db.report.updateMany({ where: { entityType: input.entityType, entityId: input.entityId, status: 'OPEN' }, data: { status: 'RESOLVED', resolvedAt: now, resolvedById: adminId } }),
      this.db.moderationAppeal.updateMany({ where: { entityType: input.entityType, entityId: input.entityId, status: 'OPEN' }, data: { status: 'DECIDED', decidedAt: now } }),
      this.db.moderationAction.create({ data: { id: newId(), entityType: input.entityType, entityId: input.entityId, action: input.action, reason, actorId: adminId } }),
    ])
    if (note) {
      const next = NOTE_STATE[input.action]
      if (next === 'release') {
        if (note.moderation === 'PENDING_REVIEW') await this.notes.setState(note.id, 'OK', null)
      } else if (next) {
        await this.notes.setState(note.id, next, reason)
      }
    }
    await this.audit.record({ actorId: adminId, action: `moderation.${input.action.toLowerCase()}`, targetType: input.entityType, targetId: input.entityId, metadata: reason ? { reason } : {} })
  }

  // ── Appeals ──────────────────────────────────────────────────────────────────────────────────────────────

  /** The author's one appeal against hiding or removing their note; it reopens the case. */
  async appeal(userId: string, input: { entityType: ReportEntityType; entityId: string; message: string }): Promise<void> {
    if (input.entityType !== 'NOTE') throw Errors.validation('Only notes can be appealed for now.', ['input', 'entityType'])
    const [note] = await this.notes.describe([input.entityId])
    if (!note || note.ownerId !== userId) throw Errors.notFound('Note not found.')
    if (note.moderation !== 'HIDDEN' && note.moderation !== 'REMOVED') throw Errors.validation('Only notes moderators hid or removed can be appealed.', ['input', 'entityId'])
    const message = input.message.trim().slice(0, MAX_APPEAL)
    if (!message) throw Errors.validation('Tell the moderators why the note should come back.', ['input', 'message'])
    const existing = await this.db.moderationAppeal.findUnique({ where: { entityType_entityId_userId: { entityType: 'NOTE', entityId: note.id, userId } } })
    if (existing) throw Errors.validation('You have already appealed for this note.', ['input', 'entityId'])
    await this.db.moderationAppeal.create({ data: { id: newId(), entityType: 'NOTE', entityId: note.id, userId, message } })
    await this.audit.record({ actorId: userId, action: 'moderation.appeal', targetType: 'NOTE', targetId: note.id })
  }

  private async requireModerator(userId: string): Promise<void> {
    if (!can(await this.policy.actor(userId), Action.CONTENT_MODERATE)) throw Errors.forbidden()
  }
}
