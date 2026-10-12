import { readFileSync } from 'node:fs'
import { Inject, Injectable } from '@nestjs/common'
import { Action, can, type ModerationActionType, type ModerationScope, type ReportEntityType, type ReportReason } from '@lvn/contracts/domain'
import { docSchema, docText } from '@lvn/contracts/validation'
import { Errors } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { AUDIT, NOTE_MODERATION, POLICY, type Audit, type ModeratedNote, type Moderation, type ModerationStateKind, type ModerationSubject, type NoteModeration, type Policy } from '@lvn-backend/facades'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { RateLimiter } from '@lvn-backend/redis'
import { CORE_CONFIG, type CoreConfig } from '../core.config'
import { builtInWords, parseWordList, score, type WordRule } from '../domain/rule-scorer'
import { CLASS_ROLE, type StoredClassRole } from './classrooms.service'
import { CONTRACT_ROLE, type StoredRole } from './groups.service'

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

export type Scope = { scope: ModerationScope; scopeId: string | null }
type ContentType = 'COMMENT' | 'GROUP_POST' | 'CLASSROOM_POST' | 'DOUBT'
const CONTENT: ReadonlySet<string> = new Set<ContentType>(['COMMENT', 'GROUP_POST', 'CLASSROOM_POST', 'DOUBT'])
export const isContent = (t: string): t is ContentType => CONTENT.has(t)
export type ContentState = 'OK' | 'PENDING_REVIEW' | 'HIDDEN' | 'REMOVED'
const EXCERPT = 400

/** A row's moderation as the viewer sees it: the reason (a hold, a hide, a warning) is its author's alone (ADR-0051). */
export function moderationFor(row: { authorId: string; moderation: ContentState; moderationReason: string | null }, viewerId: string) {
  return { moderation: row.moderation, moderationReason: row.authorId === viewerId ? row.moderationReason : null }
}

/** Where an entity's case belongs (ADR-0051), who it is about, and where it opens. */
export interface Subject extends Scope {
  authorId: string | null
  path: string
  noteId?: string
  groupId?: string
  classroomId?: string
}

/** A comment, post, announcement or doubt as its scope's moderators see it. */
export interface ModeratedContent {
  entityType: ContentType
  id: string
  authorId: string
  excerpt: string
  moderation: ContentState
  moderationReason: string | null
  deleted: boolean
  path: string
}

export interface ModerationCase extends Scope {
  entityType: ReportEntityType
  entityId: string
  note: ModeratedNote | null
  content: ModeratedContent | null
  /** GROUP cases: the group itself */
  groupId: string | null
  reports: { reason: ReportReason; details: string | null; reporterId: string | null; createdAt: Date }[]
  appeal: { message: string; createdAt: Date } | null
  openedAt: Date
}

/** The text of a rich-text body, cut for the queue. */
function excerptOf(body: unknown, prefix = ''): string {
  const doc = docSchema.safeParse(body)
  return `${prefix}${doc.success ? docText(doc.data).trim() : ''}`.slice(0, EXCERPT)
}

/**
 * Moderation in the `core` context (§15.1, ADR-0037, ADR-0051): the MODERATION facade that screens content on its way
 * to the public, reports from people, the queues of each scope (a group's moderators, a class's staff, the platform's
 * admins) with their decisions, and the author's one appeal. Notes' moderation state is changed through
 * NOTE_MODERATION, the state of core's own comments, posts, announcements and doubts here; every decision is a
 * ModerationAction and an audit entry.
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

  /** Reports on notes and accounts; other kinds come through ScopedReportsService, which checks what the reporter sees. */
  async report(viewerId: string, input: { entityType: ReportEntityType; entityId: string; reason: ReportReason; details?: string | null }): Promise<void> {
    const actor = await this.policy.actor(viewerId)
    if (!can(actor, Action.CONTENT_REPORT)) throw Errors.forbidden()
    if (input.entityType === 'NOTE') {
      // Only what the reporter can see can be reported; anything else is "not found", as everywhere (§5).
      if (!(await this.notes.canRead(viewerId, input.entityId))) throw Errors.notFound('Note not found.')
      const [note] = await this.notes.describe([input.entityId])
      if (note?.ownerId === viewerId) throw Errors.validation('This is your own note.', ['input', 'entityId'])
    } else if (input.entityType === 'USER') {
      if (input.entityId === viewerId) throw Errors.validation('You cannot report yourself.', ['input', 'entityId'])
      if (!(await this.policy.actor(input.entityId))) throw Errors.notFound('Account not found.')
    } else {
      throw Errors.validation('Report this through its own page.', ['input', 'entityType'])
    }
    await this.fileReport(viewerId, input, { scope: 'PLATFORM', scopeId: null })
  }

  /** Files (or renews) a person's report in its scope; several people's reports hold the content for review. */
  async fileReport(viewerId: string, input: { entityType: ReportEntityType; entityId: string; reason: ReportReason; details?: string | null }, scope: Scope): Promise<void> {
    const details = input.details?.trim().slice(0, MAX_DETAILS) || null
    const limit = await this.limiter.hit(`reports:${viewerId}`, { max: 20, windowSeconds: 3600 })
    if (!limit.allowed) throw Errors.rateLimited(limit.retryAfter, 'You have sent many reports in the last hour. Try again later.')

    const key = { entityType: input.entityType, entityId: input.entityId, reporterId: viewerId }
    const saved = await this.db.report.upsert({
      where: { entityType_entityId_reporterId: key },
      create: { id: newId(), ...key, reason: input.reason, details, ...scope },
      update: { reason: input.reason, details, status: 'OPEN', resolvedAt: null, resolvedById: null, ...scope },
    })
    await this.events.publish('ContentReported', { reportId: saved.id, entityType: input.entityType, entityId: input.entityId })

    const people = await this.db.report.count({ where: { entityType: input.entityType, entityId: input.entityId, status: 'OPEN', reporterId: { not: null } } })
    if (people < REPORTS_TO_HOLD) return
    if (input.entityType === 'NOTE') {
      const [note] = await this.notes.describe([input.entityId])
      if (note?.visibility === 'PUBLIC' && note.moderation === 'OK') {
        await this.notes.setState(input.entityId, 'PENDING_REVIEW', 'Several people reported this note. A moderator will look at it.')
        await this.audit.record({ actorId: null, action: 'moderation.held', targetType: 'NOTE', targetId: input.entityId, metadata: { reports: people } })
      }
    } else if (isContent(input.entityType)) {
      const held = await this.setContentState(input.entityType, input.entityId, 'PENDING_REVIEW', 'Several people reported this. A moderator will look at it.', 'OK')
      if (held) await this.audit.record({ actorId: null, action: 'moderation.held', targetType: input.entityType, targetId: input.entityId, metadata: { reports: people } })
    }
  }

  /** The scorer's own report, in the content's scope, for content it holds (ADR-0051: flagged comments). */
  async fileSystemReport(entityType: ContentType, entityId: string, reason: ReportReason, details: string): Promise<void> {
    const subject = await this.subject(entityType, entityId)
    if (!subject) return
    const key = { entityType, entityId, reporterId: null }
    const existing = await this.db.report.findFirst({ where: key, select: { id: true } })
    const id = existing?.id ?? newId()
    if (existing) await this.db.report.update({ where: { id }, data: { reason, details, status: 'OPEN', resolvedAt: null, resolvedById: null } })
    else await this.db.report.create({ data: { id, ...key, reason, details, scope: subject.scope, scopeId: subject.scopeId } })
    await this.audit.record({ actorId: null, action: 'moderation.held', targetType: entityType, targetId: entityId, metadata: { reason } })
    await this.events.publish('ContentReported', { reportId: id, entityType, entityId })
  }

  /** The verdict's report reason, for content the scorer flags. */
  verdictOf(text: string): { reason: ReportReason; message: string } | null {
    const v = score({ title: '', text }, this.words)
    return v.flagged ? { reason: v.reason!, message: v.message! } : null
  }

  // ── Scopes ───────────────────────────────────────────────────────────────────────────────────────────────

  /** Where an entity's case belongs, from core's own rows (and notes' for a note); null when it is gone. */
  async subject(entityType: ReportEntityType, entityId: string): Promise<Subject | null> {
    const platform = { scope: 'PLATFORM' as const, scopeId: null }
    switch (entityType) {
      case 'NOTE': {
        const [note] = await this.notes.describe([entityId])
        return note ? { ...platform, authorId: note.ownerId, path: `/notes/${note.id}`, noteId: note.id } : null
      }
      case 'USER':
        return { ...platform, authorId: entityId, path: `/u/${entityId}` }
      case 'GROUP': {
        const g = await this.db.group.findUnique({ where: { id: entityId }, select: { ownerId: true } })
        return g ? { ...platform, authorId: g.ownerId, path: `/groups/${entityId}`, groupId: entityId } : null
      }
      case 'GROUP_POST': {
        const p = await this.db.groupPost.findUnique({ where: { id: entityId }, select: { groupId: true, authorId: true } })
        return p ? { scope: 'GROUP', scopeId: p.groupId, authorId: p.authorId, path: `/groups/${p.groupId}`, groupId: p.groupId } : null
      }
      case 'DOUBT': {
        const d = await this.db.doubt.findUnique({ where: { id: entityId }, select: { groupId: true, authorId: true } })
        return d ? { scope: 'GROUP', scopeId: d.groupId, authorId: d.authorId, path: `/groups/${d.groupId}/doubts/${entityId}`, groupId: d.groupId } : null
      }
      case 'CLASSROOM_POST': {
        const a = await this.db.classroomPost.findUnique({ where: { id: entityId }, select: { classroomId: true, authorId: true } })
        return a ? { scope: 'CLASSROOM', scopeId: a.classroomId, authorId: a.authorId, path: `/classes/${a.classroomId}`, classroomId: a.classroomId } : null
      }
      case 'COMMENT': {
        const c = await this.db.comment.findUnique({ where: { id: entityId }, select: { targetType: true, targetId: true, authorId: true } })
        if (!c) return null
        if (c.targetType === 'NOTE') return { ...platform, authorId: c.authorId, path: `/notes/${c.targetId}`, noteId: c.targetId }
        const place = await this.subject(c.targetType, c.targetId)
        return place ? { ...place, authorId: c.authorId } : null
      }
      default:
        return null
    }
  }

  /** Platform admins moderate everywhere; group moderators and mentors their group; class staff their class. */
  async canModerate(userId: string, scope: Scope): Promise<boolean> {
    const actor = await this.policy.actor(userId)
    if (can(actor, Action.CONTENT_MODERATE)) return true
    if (!scope.scopeId) return false
    if (scope.scope === 'GROUP') {
      const m = await this.db.groupMember.findUnique({ where: { groupId_userId: { groupId: scope.scopeId, userId } }, select: { role: true } })
      return !!m && can(actor, Action.GROUP_MODERATE_POSTS, { kind: 'group', role: CONTRACT_ROLE[m.role as StoredRole] })
    }
    const m = await this.db.classroomMember.findUnique({ where: { classroomId_userId: { classroomId: scope.scopeId, userId } }, select: { role: true } })
    return !!m && can(actor, Action.CLASSROOM_MODERATE_REPORTS, { kind: 'classroom', role: CLASS_ROLE[m.role as StoredClassRole] })
  }

  /** Sets the state of a comment, post, announcement or doubt; with `from`, only when it is in that state. */
  async setContentState(entityType: ContentType, entityId: string, state: ContentState, reason: string | null, from?: ContentState): Promise<boolean> {
    const where = { id: entityId, ...(from ? { moderation: from } : {}) }
    const data = { moderation: state, moderationReason: state === 'OK' ? null : reason }
    const result =
      entityType === 'COMMENT'
        ? await this.db.comment.updateMany({ where, data })
        : entityType === 'GROUP_POST'
          ? await this.db.groupPost.updateMany({ where, data })
          : entityType === 'CLASSROOM_POST'
            ? await this.db.classroomPost.updateMany({ where, data })
            : await this.db.doubt.updateMany({ where, data })
    return result.count > 0
  }

  /** The latest warning to a group's owner from the last 30 days (ADR-0051): a group has no state of its own to keep it. */
  async groupWarning(groupId: string): Promise<string | null> {
    const since = new Date(Date.now() - 30 * 86_400_000)
    const warned = await this.db.moderationAction.findFirst({ where: { entityType: 'GROUP', entityId: groupId, action: 'WARN', createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, select: { reason: true } })
    return warned?.reason ?? null
  }

  /** The author may appeal content a moderator hid or removed, once (ADR-0051). */
  async canAppeal(userId: string | undefined, entityType: ContentType, row: { id: string; authorId: string; moderation: ContentState }): Promise<boolean> {
    if (!userId || row.authorId !== userId || (row.moderation !== 'HIDDEN' && row.moderation !== 'REMOVED')) return false
    return !(await this.db.moderationAppeal.count({ where: { entityType, entityId: row.id, userId } }))
  }

  private async setReason(entityType: ContentType, entityId: string, reason: string | null): Promise<void> {
    const where = { id: entityId, moderation: 'OK' as const }
    const data = { moderationReason: reason }
    if (entityType === 'COMMENT') await this.db.comment.updateMany({ where, data })
    else if (entityType === 'GROUP_POST') await this.db.groupPost.updateMany({ where, data })
    else if (entityType === 'CLASSROOM_POST') await this.db.classroomPost.updateMany({ where, data })
    else await this.db.doubt.updateMany({ where, data })
  }

  private async describeContent(entityType: ContentType, ids: string[]): Promise<ModeratedContent[]> {
    if (!ids.length) return []
    const out: ModeratedContent[] = []
    const base = (r: { id: string; authorId: string; moderation: ContentState; moderationReason: string | null; deletedAt: Date | null }, excerpt: string, path: string) => ({ entityType, id: r.id, authorId: r.authorId, excerpt, moderation: r.moderation, moderationReason: r.moderationReason, deleted: !!r.deletedAt, path })
    if (entityType === 'COMMENT') {
      for (const r of await this.db.comment.findMany({ where: { id: { in: ids } } })) out.push(base(r, excerptOf(r.body), (await this.subject('COMMENT', r.id))?.path ?? '/'))
    } else if (entityType === 'GROUP_POST') {
      for (const r of await this.db.groupPost.findMany({ where: { id: { in: ids } } })) out.push(base(r, excerptOf(r.body, r.kind === 'IDEA' ? 'Idea: ' : ''), `/groups/${r.groupId}`))
    } else if (entityType === 'CLASSROOM_POST') {
      for (const r of await this.db.classroomPost.findMany({ where: { id: { in: ids } } })) out.push(base(r, excerptOf(r.body), `/classes/${r.classroomId}`))
    } else {
      for (const r of await this.db.doubt.findMany({ where: { id: { in: ids } } })) out.push(base(r, excerptOf(r.body, `${r.title} — `), `/groups/${r.groupId}/doubts/${r.id}`))
    }
    return out
  }

  // ── Queues (ADR-0037, ADR-0051) ──────────────────────────────────────────────────────────────────────────────

  /**
   * Open cases, oldest first: entities with open reports or an open appeal. With a scope, that group's or class's
   * cases for its moderators; without, every case, for platform admins.
   */
  async queue(userId: string, offset: number, size: number, scope?: Scope | null): Promise<{ cases: ModerationCase[]; hasMore: boolean }> {
    if (scope && scope.scope !== 'PLATFORM') {
      if (!(await this.canModerate(userId, scope))) throw Errors.forbidden()
    } else {
      await this.requireModerator(userId)
    }
    const where = scope ? { scope: scope.scope, ...(scope.scope === 'PLATFORM' ? {} : { scopeId: scope.scopeId }) } : {}
    const [reports, appeals] = await Promise.all([
      this.db.report.findMany({ where: { status: 'OPEN', ...where }, orderBy: { createdAt: 'asc' }, take: 2_000 }),
      this.db.moderationAppeal.findMany({ where: { status: 'OPEN', ...where }, orderBy: { createdAt: 'asc' }, take: 500 }),
    ])
    const cases = new Map<string, ModerationCase>()
    const caseOf = (r: { entityType: ReportEntityType; entityId: string; createdAt: Date; scope: ModerationScope; scopeId: string | null }) => {
      const key = `${r.entityType}:${r.entityId}`
      let c = cases.get(key)
      if (!c) cases.set(key, (c = { entityType: r.entityType, entityId: r.entityId, scope: r.scope, scopeId: r.scopeId, note: null, content: null, groupId: r.entityType === 'GROUP' ? r.entityId : null, reports: [], appeal: null, openedAt: r.createdAt }))
      if (r.createdAt < c.openedAt) c.openedAt = r.createdAt
      return c
    }
    for (const r of reports) caseOf(r).reports.push({ reason: r.reason, details: r.details, reporterId: r.reporterId, createdAt: r.createdAt })
    for (const a of appeals) caseOf(a).appeal = { message: a.message, createdAt: a.createdAt }
    const all = [...cases.values()].sort((a, b) => a.openedAt.getTime() - b.openedAt.getTime())
    const page = all.slice(offset, offset + size)
    const notes = new Map((await this.notes.describe(page.filter((c) => c.entityType === 'NOTE').map((c) => c.entityId))).map((n) => [n.id, n]))
    const contents = new Map<string, ModeratedContent>()
    for (const type of CONTENT) {
      for (const d of await this.describeContent(type as ContentType, page.filter((c) => c.entityType === type).map((c) => c.entityId))) contents.set(`${type}:${d.id}`, d)
    }
    for (const c of page) {
      c.note = notes.get(c.entityId) ?? null
      c.content = contents.get(`${c.entityType}:${c.entityId}`) ?? null
    }
    return { cases: page, hasMore: all.length > offset + size }
  }

  /** A moderator's decision on a case: the entity's new state, the reports and appeal closed, the action recorded. */
  async decide(userId: string, input: { entityType: ReportEntityType; entityId: string; action: ModerationActionType; reason?: string | null }): Promise<void> {
    const subject = await this.subject(input.entityType, input.entityId)
    if (!subject) throw Errors.notFound('That is not there any more.')
    if (!(await this.canModerate(userId, subject))) throw Errors.forbidden()
    const platform = can(await this.policy.actor(userId), Action.CONTENT_MODERATE)
    // Nobody in a group or class decides on their own content; a platform admin does.
    if (!platform && subject.authorId === userId) throw Errors.forbidden('Another moderator decides about your own content.')
    const reason = input.reason?.trim().slice(0, MAX_DETAILS) || null
    if (input.action === 'SUSPEND') throw Errors.validation('Suspending accounts is not available yet.', ['input', 'action'])
    if ((input.action === 'HIDE' || input.action === 'REMOVE' || input.action === 'WARN') && !reason) {
      throw Errors.validation('Say why: the author is told.', ['input', 'reason'])
    }
    if (input.entityType === 'USER' && input.action !== 'DISMISS' && input.action !== 'WARN') {
      throw Errors.validation('Accounts can be warned or their reports dismissed.', ['input', 'action'])
    }
    if (input.entityType === 'GROUP' && !['WARN', 'DISMISS', 'REMOVE'].includes(input.action)) {
      throw Errors.validation('A group can be warned, removed, or its reports dismissed.', ['input', 'action'])
    }
    let note: ModeratedNote | undefined
    if (input.entityType === 'NOTE') {
      ;[note] = await this.notes.describe([input.entityId])
      if (!note) throw Errors.notFound('Note not found.')
    }
    let before: ContentState | null = null
    if (isContent(input.entityType)) before = (await this.describeContent(input.entityType, [input.entityId]))[0]?.moderation ?? null

    const now = new Date()
    await this.db.$transaction([
      this.db.report.updateMany({ where: { entityType: input.entityType, entityId: input.entityId, status: 'OPEN' }, data: { status: 'RESOLVED', resolvedAt: now, resolvedById: userId } }),
      this.db.moderationAppeal.updateMany({ where: { entityType: input.entityType, entityId: input.entityId, status: 'OPEN' }, data: { status: 'DECIDED', decidedAt: now } }),
      this.db.moderationAction.create({ data: { id: newId(), entityType: input.entityType, entityId: input.entityId, action: input.action, reason, actorId: userId, scope: subject.scope, scopeId: subject.scopeId } }),
    ])
    if (note) {
      const next = NOTE_STATE[input.action]
      if (next === 'release') {
        if (note.moderation === 'PENDING_REVIEW') await this.notes.setState(note.id, 'OK', null)
      } else if (next) {
        await this.notes.setState(note.id, next, reason)
      }
    }
    let told: 'HIDDEN' | 'REMOVED' | 'WARNED' | 'RESTORED' | null = null
    if (isContent(input.entityType)) {
      const next = NOTE_STATE[input.action]
      if (input.action === 'WARN') {
        // The content stays (a held one is released); the author reads the warning with it.
        if (before === 'OK' || before === 'PENDING_REVIEW') await this.setContentState(input.entityType, input.entityId, 'OK', null)
        await this.setReason(input.entityType, input.entityId, reason)
      } else if (next === 'release') {
        if (before === 'PENDING_REVIEW') await this.setContentState(input.entityType, input.entityId, 'OK', null)
      } else if (next) {
        await this.setContentState(input.entityType, input.entityId, next, reason)
      }
      told = input.action === 'HIDE' ? 'HIDDEN' : input.action === 'REMOVE' ? 'REMOVED' : input.action === 'WARN' ? 'WARNED' : input.action === 'APPROVE' && (before === 'HIDDEN' || before === 'REMOVED') ? 'RESTORED' : null
    }
    if (input.entityType === 'GROUP') {
      if (input.action === 'REMOVE') {
        await this.db.group.update({ where: { id: input.entityId }, data: { deletedAt: now } })
        await this.events.publish('GroupDeleted', { groupId: input.entityId })
      }
      told = input.action === 'WARN' ? 'WARNED' : input.action === 'REMOVE' ? 'REMOVED' : null
    }
    await this.audit.record({ actorId: userId, action: `moderation.${input.action.toLowerCase()}`, targetType: input.entityType, targetId: input.entityId, metadata: { ...(reason ? { reason } : {}), scope: subject.scope, ...(subject.scopeId ? { scopeId: subject.scopeId } : {}) } })
    if (told && subject.authorId) {
      await this.events.publish('ContentModerated', {
        entityType: input.entityType,
        entityId: input.entityId,
        authorId: subject.authorId,
        kind: told,
        path: subject.path,
        ...(subject.groupId ? { groupId: subject.groupId } : {}),
        ...(subject.classroomId ? { classroomId: subject.classroomId } : {}),
        ...(subject.noteId ? { noteId: subject.noteId } : {}),
      })
    }
  }

  // ── Appeals ──────────────────────────────────────────────────────────────────────────────────────────────

  /** The author's one appeal against hiding or removing their note or content; it reopens the case in its scope. */
  async appeal(userId: string, input: { entityType: ReportEntityType; entityId: string; message: string }): Promise<void> {
    const message = input.message.trim().slice(0, MAX_APPEAL)
    let scope: Scope = { scope: 'PLATFORM', scopeId: null }
    if (input.entityType === 'NOTE') {
      const [note] = await this.notes.describe([input.entityId])
      if (!note || note.ownerId !== userId) throw Errors.notFound('Note not found.')
      if (note.moderation !== 'HIDDEN' && note.moderation !== 'REMOVED') throw Errors.validation('Only notes moderators hid or removed can be appealed.', ['input', 'entityId'])
      if (!message) throw Errors.validation('Tell the moderators why the note should come back.', ['input', 'message'])
    } else if (isContent(input.entityType)) {
      const [content] = await this.describeContent(input.entityType, [input.entityId])
      if (!content || content.authorId !== userId || content.deleted) throw Errors.notFound('That is not there any more.')
      if (content.moderation !== 'HIDDEN' && content.moderation !== 'REMOVED') throw Errors.validation('Only what moderators hid or removed can be appealed.', ['input', 'entityId'])
      if (!message) throw Errors.validation('Tell the moderators why it should come back.', ['input', 'message'])
      const subject = await this.subject(input.entityType, input.entityId)
      if (subject) scope = { scope: subject.scope, scopeId: subject.scopeId }
    } else {
      throw Errors.validation('This cannot be appealed.', ['input', 'entityType'])
    }
    const existing = await this.db.moderationAppeal.findUnique({ where: { entityType_entityId_userId: { entityType: input.entityType, entityId: input.entityId, userId } } })
    if (existing) throw Errors.validation(input.entityType === 'NOTE' ? 'You have already appealed for this note.' : 'You have already appealed for this.', ['input', 'entityId'])
    await this.db.moderationAppeal.create({ data: { id: newId(), entityType: input.entityType, entityId: input.entityId, userId, message, ...scope } })
    await this.audit.record({ actorId: userId, action: 'moderation.appeal', targetType: input.entityType, targetId: input.entityId })
  }

  private async requireModerator(userId: string): Promise<void> {
    if (!can(await this.policy.actor(userId), Action.CONTENT_MODERATE)) throw Errors.forbidden()
  }
}
