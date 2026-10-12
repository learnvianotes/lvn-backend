import { Inject, Injectable } from '@nestjs/common'
import { milestoneFor } from '@lvn/contracts/domain'
import { docSchema, docText } from '@lvn/contracts/validation'
import { Errors } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { AUDIT, NOTE_ACCESS, PEOPLE, POLICY, type Audit, type NoteAccess, type People, type Policy } from '@lvn-backend/facades'
import { newId, PrismaService, type Prisma } from '@lvn-backend/prisma-base'
import { RateLimiter } from '@lvn-backend/redis'
import { ClassroomsService } from './classrooms.service'
import { GroupsService } from './groups.service'
import { MentionsService } from './mentions.service'
import { ModerationService } from './moderation.service'

export type CommentTargetKind = 'NOTE' | 'GROUP_POST' | 'CLASSROOM_POST'
export type ReactionTargetKind = CommentTargetKind | 'COMMENT'
export type ReactionKindName = 'LIKE' | 'HELPFUL' | 'CELEBRATE'
export interface CommentTarget {
  type: CommentTargetKind
  id: string
}
export type CommentRow = Prisma.CommentGetPayload<object>

export const COMMENT_LIMITS = { chars: 5000, perHour: 30, reactionsPerHour: 200, replies: 100 } as const
const KINDS: ReactionKindName[] = ['LIKE', 'HELPFUL', 'CELEBRATE']

/** A discussion as one viewer meets it (ADR-0047): what it is on, whose it is and what they may do in it. */
export interface Place {
  target: CommentTarget
  /** Whose content it is: the note's owner or the post's author */
  ownerId: string
  canComment: boolean
  /** Why not, in words, when they may not */
  whyNot: string | null
  /** Removes other people's comments: the note's owner, group moderators, class staff */
  canModerate: boolean
  /** Class announcements: a student's thread is theirs and the staff's */
  classThreads: boolean
  staff: boolean
  /** Reaction counts are milestones for everyone but the owner (ADR-0027) */
  publicNote: boolean
  link: { kind: 'NOTE'; noteId: string } | { kind: 'GROUP'; groupId: string } | { kind: 'CLASSROOM'; classroomId: string }
}

export interface ReactionSummary {
  counts: { kind: ReactionKindName; count: number | null; atLeast: boolean }[]
  viewerReaction: ReactionKindName | null
}

/**
 * Comments and reactions (§4.5, ADR-0016, ADR-0047) on notes, group posts and class announcements. The read rule of
 * each target decides who reads and joins its discussion: notes through NOTE_ACCESS, posts through their group or class.
 */
@Injectable()
export class CommentsService {
  constructor(
    private readonly db: PrismaService,
    private readonly limiter: RateLimiter,
    private readonly groups: GroupsService,
    private readonly classrooms: ClassroomsService,
    private readonly moderation: ModerationService,
    private readonly mentions: MentionsService,
    @Inject(NOTE_ACCESS) private readonly notes: NoteAccess,
    @Inject(PEOPLE) private readonly people: People,
    @Inject(POLICY) private readonly policy: Policy,
    @Inject(AUDIT) private readonly audit: Audit,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  /** The discussion of a target for this viewer; null when they cannot read the target. */
  async place(viewerId: string, target: CommentTarget): Promise<Place | null> {
    const base = { target, classThreads: false, staff: false, publicNote: false }
    let place: Place
    if (target.type === 'NOTE') {
      const reach = await this.notes.reach(viewerId, target.id)
      if (!reach) return null
      place = { ...base, ownerId: reach.ownerId, canComment: reach.canComment, whyNot: reach.canComment ? null : await this.whyNot(viewerId, reach.visibility === 'PUBLIC'), canModerate: reach.access === 'OWNER', publicNote: reach.visibility === 'PUBLIC', link: { kind: 'NOTE', noteId: target.id } }
    } else if (target.type === 'GROUP_POST') {
      const p = await this.groups.postPlace(viewerId, target.id)
      if (!p) return null
      place = { ...base, ownerId: p.authorId, canComment: p.canComment, whyNot: p.canComment ? null : await this.whyNot(viewerId, false, 'You are muted in this group for now.'), canModerate: p.canModerate, link: { kind: 'GROUP', groupId: p.groupId } }
    } else {
      const p = await this.classrooms.postPlace(viewerId, target.id)
      if (!p) return null
      place = { ...base, ownerId: p.authorId, canComment: true, whyNot: null, canModerate: p.staff, classThreads: true, staff: p.staff, link: { kind: 'CLASSROOM', classroomId: p.classroomId } }
    }
    // A block stops comments both ways, with the same words whoever blocked (ADR-0016).
    if (place.canComment && place.ownerId !== viewerId && (await this.people.blockedBetween(viewerId, place.ownerId))) {
      place = { ...place, canComment: false, whyNot: "You can't comment here." }
    }
    return place
  }

  private async whyNot(viewerId: string, publicNote: boolean, otherwise = "You can't comment here."): Promise<string> {
    const actor = await this.policy.actor(viewerId)
    if (!actor?.institutionVerified) return 'Verify your account to comment.'
    if (publicNote && actor.restrictedMinor) return 'Comments on public notes are not open to your account yet.'
    return otherwise
  }

  private async require(viewerId: string, target: CommentTarget): Promise<Place> {
    const place = await this.place(viewerId, target)
    if (!place) throw Errors.notFound('This is not there any more.')
    return place
  }

  /** What of a discussion the viewer sees: no blocked people, approvals waiting only for their two people, class threads. */
  private async visible(viewerId: string, place: Place): Promise<Prisma.CommentWhereInput> {
    const hidden = await this.people.blockedIds(viewerId)
    const and: Prisma.CommentWhereInput[] = [
      { OR: [{ state: 'VISIBLE' }, { authorId: viewerId }, { ownerId: viewerId }] },
      // Held, hidden or removed by moderation (ADR-0051): its author's alone.
      { OR: [{ moderation: 'OK' }, { authorId: viewerId }] },
    ]
    if (hidden.length) and.push({ authorId: { notIn: hidden } })
    if (place.classThreads && !place.staff) and.push({ OR: [{ visibleTo: null }, { visibleTo: viewerId }] })
    return { targetType: place.target.type, targetId: place.target.id, AND: and }
  }

  /** The document, and the scorer's verdict when it flags it: the comment is then held for review (ADR-0051). */
  private body(raw: unknown) {
    const doc = docSchema.safeParse(raw)
    if (!doc.success) throw Errors.validation('This comment could not be read.', ['input', 'body'])
    const text = docText(doc.data).trim()
    if (!text) throw Errors.validation('Write something first.', ['input', 'body'])
    if (text.length > COMMENT_LIMITS.chars) throw Errors.validation(`Keep comments to ${COMMENT_LIMITS.chars} characters.`, ['input', 'body'])
    return { doc: doc.data as Prisma.InputJsonValue, held: this.moderation.verdictOf(text) }
  }

  private heldReason(message: string) {
    return `A moderator will look at this before others see it: ${message}`
  }

  async add(viewerId: string, input: { target: CommentTarget; cardId?: string | null; parentId?: string | null; body: unknown }): Promise<string> {
    const place = await this.require(viewerId, input.target)
    if (!place.canComment) throw Errors.forbidden(place.whyNot ?? undefined)
    const { doc: body, held } = this.body(input.body)
    if (input.cardId && (input.target.type !== 'NOTE' || !(await this.notes.hasCard(input.target.id, input.cardId)))) throw Errors.validation('That card is not in this note.', ['input', 'cardId'])
    let parent: CommentRow | null = null
    if (input.parentId) {
      parent = await this.db.comment.findFirst({ where: { AND: [await this.visible(viewerId, place), { id: input.parentId, parentId: null, deletedAt: null }] } })
      if (!parent) throw Errors.notFound('That comment is not there any more.')
      if (parent.authorId !== viewerId && (await this.people.blockedBetween(viewerId, parent.authorId))) throw Errors.forbidden("You can't reply to this comment.")
    }
    const rate = await this.limiter.hit(`core:comment:${viewerId}`, { max: COMMENT_LIMITS.perHour, windowSeconds: 3600 })
    if (!rate.allowed) throw Errors.rateLimited(rate.retryAfter, 'You have commented a lot in the last hour. Try again later.')
    // Class threads (ADR-0047): staff speak to the class; a student speaks to the staff only.
    const visibleTo = place.classThreads ? (place.staff ? (parent?.visibleTo ?? null) : viewerId) : null
    const pending = place.ownerId !== viewerId && (await this.people.restricts(place.ownerId, viewerId))
    const id = newId()
    await this.db.comment.create({
      data: { id, targetType: input.target.type, targetId: input.target.id, cardId: parent ? parent.cardId : (input.cardId ?? null), parentId: parent?.id ?? null, authorId: viewerId, ownerId: place.ownerId, visibleTo, body, state: pending ? 'PENDING_APPROVAL' : 'VISIBLE', ...(held ? { moderation: 'PENDING_REVIEW' as const, moderationReason: this.heldReason(held.message) } : {}) },
    })
    if (held) await this.moderation.fileSystemReport('COMMENT', id, held.reason, `Held when posted: ${held.message}`)
    // Who is told: nobody for a comment waiting for approval or review, never the author, never someone who restricts them.
    const recipients: { userId: string; kind: 'COMMENT' | 'REPLY' }[] = []
    if (!pending && !held) {
      if (parent && parent.authorId !== viewerId && !(await this.people.restricts(parent.authorId, viewerId))) recipients.push({ userId: parent.authorId, kind: 'REPLY' })
      if (place.ownerId !== viewerId && !recipients.some((r) => r.userId === place.ownerId)) recipients.push({ userId: place.ownerId, kind: 'COMMENT' })
    }
    await this.events.publish('CommentAdded', { commentId: id, targetType: input.target.type, targetId: input.target.id, authorId: viewerId, recipients, place: place.link })
    // People named with @handle who can read the comment (ADR-0054); not while it waits for approval or review.
    if (!pending && !held) await this.mentionIn(id, viewerId, docText(body as never), null, place, recipients.map((r) => r.userId))
    return id
  }

  private mentionIn(commentId: string, authorId: string, text: string, before: string | null, place: Place, alreadyTold: string[] = []) {
    return this.mentions.mention({ entityType: 'COMMENT', entityId: commentId, authorId, text, before, place: place.link, alreadyTold, canSee: async (userId) => !!(await this.get(userId, commentId)) })
  }

  /** The comment, when the viewer can see it, with the discussion it is in. */
  async get(viewerId: string, commentId: string): Promise<{ comment: CommentRow; place: Place } | null> {
    const row = await this.db.comment.findUnique({ where: { id: commentId } })
    if (!row) return null
    const place = await this.place(viewerId, { type: row.targetType, id: row.targetId })
    if (!place) return null
    const seen = await this.db.comment.count({ where: { AND: [await this.visible(viewerId, place), { id: commentId }] } })
    return seen ? { comment: row, place } : null
  }

  private async mustGet(viewerId: string, commentId: string) {
    const found = await this.get(viewerId, commentId)
    if (!found || found.comment.deletedAt) throw Errors.notFound('That comment is not there any more.')
    return found
  }

  async edit(viewerId: string, commentId: string, body: unknown): Promise<string> {
    const { comment, place } = await this.mustGet(viewerId, commentId)
    if (comment.authorId !== viewerId) throw Errors.forbidden('Only its author edits a comment.')
    if (comment.moderation === 'HIDDEN' || comment.moderation === 'REMOVED') throw Errors.validation('A moderator took this comment down; appeal instead of editing it.')
    const { doc, held } = this.body(body)
    await this.db.comment.update({ where: { id: commentId }, data: { body: doc, editedAt: new Date(), ...(held ? { moderation: 'PENDING_REVIEW' as const, moderationReason: this.heldReason(held.message) } : {}) } })
    if (held) await this.moderation.fileSystemReport('COMMENT', commentId, held.reason, `Held when edited: ${held.message}`)
    // Only people named for the first time in this edit are told.
    else if (comment.state === 'VISIBLE' && comment.moderation === 'OK') await this.mentionIn(commentId, viewerId, docText(doc as never), docText(comment.body as never), place)
    return commentId
  }

  /** The author, or whoever moderates the place, removes a comment; with replies it stays as "removed". */
  async remove(viewerId: string, commentId: string): Promise<string> {
    const { comment, place } = await this.mustGet(viewerId, commentId)
    const mine = comment.authorId === viewerId
    if (!mine && !place.canModerate) throw Errors.forbidden('Only its author or a moderator removes a comment.')
    await this.db.comment.update({ where: { id: commentId }, data: { deletedAt: new Date() } })
    if (!mine) await this.audit.record({ actorId: viewerId, action: 'comment.remove', targetType: comment.targetType, targetId: comment.targetId, metadata: { commentId, authorId: comment.authorId } })
    return commentId
  }

  /** The owner lets a restricted person's comment be seen (ADR-0016). */
  async approve(viewerId: string, commentId: string): Promise<string> {
    const { comment } = await this.mustGet(viewerId, commentId)
    if (comment.ownerId !== viewerId) throw Errors.forbidden('Only the owner approves comments here.')
    if (comment.state === 'PENDING_APPROVAL') await this.db.comment.update({ where: { id: commentId }, data: { state: 'VISIBLE' } })
    return commentId
  }

  /** Top-level comments, oldest first; a removed one stays while it has replies. */
  async list(viewerId: string, place: Place, size: number, after: [string, string] | null, cardId?: string | null) {
    const seen = await this.visible(viewerId, place)
    return this.db.comment.findMany({
      where: {
        AND: [
          seen,
          { parentId: null, ...(cardId ? { cardId } : {}) },
          { OR: [{ deletedAt: null }, { replies: { some: { AND: [seen, { deletedAt: null }] } } }] },
          ...(after ? [{ OR: [{ createdAt: { gt: new Date(after[0]) } }, { createdAt: new Date(after[0]), id: { gt: after[1] } }] }] : []),
        ],
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: size + 1,
    })
  }

  async replies(viewerId: string, place: Place, parentId: string) {
    return this.db.comment.findMany({ where: { AND: [await this.visible(viewerId, place), { parentId, deletedAt: null }] }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: COMMENT_LIMITS.replies })
  }

  async count(viewerId: string, place: Place): Promise<number> {
    return this.db.comment.count({ where: { AND: [await this.visible(viewerId, place), { deletedAt: null }] } })
  }

  // ── Reactions ────────────────────────────────────────────────────────────────────────────────────────────────

  /** The place and whose content a reaction target is; null when the viewer cannot see it. */
  private async reactionPlace(viewerId: string, target: { type: ReactionTargetKind; id: string }): Promise<{ place: Place; ownerId: string } | null> {
    if (target.type === 'COMMENT') {
      const found = await this.get(viewerId, target.id)
      if (!found || found.comment.deletedAt) return null
      return { place: found.place, ownerId: found.comment.authorId }
    }
    const place = await this.place(viewerId, { type: target.type, id: target.id })
    return place ? { place, ownerId: place.ownerId } : null
  }

  async react(viewerId: string, target: { type: ReactionTargetKind; id: string }, kind: ReactionKindName | null): Promise<void> {
    const found = await this.reactionPlace(viewerId, target)
    if (!found) throw Errors.notFound('This is not there any more.')
    // The same reasons as for commenting, in reacting's words.
    if (!found.place.canComment) throw Errors.forbidden(found.place.whyNot?.replace(/\bcomment\b/, 'react') ?? undefined)
    if (found.ownerId !== viewerId && (await this.people.blockedBetween(viewerId, found.ownerId))) throw Errors.forbidden("You can't react here.")
    const key = { targetType_targetId_userId: { targetType: target.type, targetId: target.id, userId: viewerId } }
    if (!kind) {
      await this.db.reaction.deleteMany({ where: { targetType: target.type, targetId: target.id, userId: viewerId } })
      return
    }
    const rate = await this.limiter.hit(`core:react:${viewerId}`, { max: COMMENT_LIMITS.reactionsPerHour, windowSeconds: 3600 })
    if (!rate.allowed) throw Errors.rateLimited(rate.retryAfter, 'You have reacted a lot in the last hour. Try again later.')
    await this.db.reaction.upsert({ where: key, create: { targetType: target.type, targetId: target.id, userId: viewerId, kind }, update: { kind } })
  }

  /** The reactions on a target the viewer can see, after a change. */
  async reactionsOf(viewerId: string, target: { type: ReactionTargetKind; id: string }): Promise<ReactionSummary | null> {
    const found = await this.reactionPlace(viewerId, target)
    return found ? this.reactions(viewerId, target, found.place, found.ownerId) : null
  }

  /** Counts by kind: exact, except on a PUBLIC note for anyone but the content's owner, who see milestones (ADR-0027). */
  async reactions(viewerId: string, target: { type: ReactionTargetKind; id: string }, place: Place, ownerId: string): Promise<ReactionSummary> {
    const [groups, mine] = await Promise.all([
      this.db.reaction.groupBy({ by: ['kind'], where: { targetType: target.type, targetId: target.id }, _count: { _all: true } }),
      this.db.reaction.findUnique({ where: { targetType_targetId_userId: { targetType: target.type, targetId: target.id, userId: viewerId } }, select: { kind: true } }),
    ])
    const exact = !place.publicNote || ownerId === viewerId
    const counts = KINDS.map((kind) => {
      const n = groups.find((g) => g.kind === kind)?._count._all ?? 0
      if (exact) return { kind, count: n, atLeast: false }
      const m = milestoneFor(n)
      return { kind, count: m, atLeast: m !== null }
    })
    return { counts, viewerReaction: (mine?.kind as ReactionKindName | undefined) ?? null }
  }
}
