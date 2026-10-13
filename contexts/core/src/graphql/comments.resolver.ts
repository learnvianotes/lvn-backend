import { UseGuards } from '@nestjs/common'
import { Args, Mutation, Parent, Query, ResolveField, Resolver, ResolveReference } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { withUserErrors, type UserError } from '@lvn-backend/errors'
import { connection, decodeCursor, pageSize } from '@lvn-backend/graphql'
import { CommentsService, type CommentRow, type CommentTargetKind, type Place, type ReactionKindName, type ReactionSummary, type ReactionTargetKind } from '../application/comments.service'
import { ModerationService, moderationFor, type ContentState } from '../application/moderation.service'

const userRef = (id: string) => ({ __typename: 'User', id })

/** A discussion as resolved for one viewer: the place decides everything under it. */
export interface DiscussionParent {
  place: Place
}
export interface CommentParent {
  row: CommentRow
  place: Place
}
type CommentPayload = { comment: CommentParent | null; userErrors: UserError[] }
type ReactPayload = { reactions: ReactionSummary | null; userErrors: UserError[] }

async function discussionOf(comments: CommentsService, viewerId: string | undefined, type: CommentTargetKind, id: string): Promise<DiscussionParent | null> {
  if (!viewerId) return null
  const place = await comments.place(viewerId, { type, id })
  return place ? { place } : null
}

/** core's part of the notes subgraph's Note: its discussion (ADR-0047). */
@Resolver('Note')
export class NoteDiscussionResolver {
  constructor(private readonly comments: CommentsService) {}

  // Apollo calls this with (reference, context, info); see UserReferenceResolver in users for why there are no decorators.
  @ResolveReference()
  resolveReference(reference: { id: string }) {
    return { id: reference.id }
  }

  @ResolveField('discussion')
  discussion(@Parent() note: { id: string }, @CurrentViewer() viewer: Viewer | null) {
    return discussionOf(this.comments, viewer?.userId, 'NOTE', note.id)
  }
}

@Resolver('GroupPost')
export class GroupPostDiscussionResolver {
  constructor(
    private readonly comments: CommentsService,
    private readonly moderationService: ModerationService,
  ) {}

  @ResolveField('moderationCanAppeal')
  moderationCanAppeal(@Parent() post: { id: string; author: { id: string }; moderation: ContentState }, @CurrentViewer() viewer: Viewer | null) {
    return this.moderationService.canAppeal(viewer?.userId, 'GROUP_POST', { id: post.id, authorId: post.author.id, moderation: post.moderation })
  }

  @ResolveField('discussion')
  discussion(@Parent() post: { id: string }, @CurrentViewer() viewer: Viewer | null) {
    return discussionOf(this.comments, viewer?.userId, 'GROUP_POST', post.id)
  }
}

@Resolver('ClassroomPost')
export class ClassroomPostDiscussionResolver {
  constructor(
    private readonly comments: CommentsService,
    private readonly moderationService: ModerationService,
  ) {}

  @ResolveField('moderationCanAppeal')
  moderationCanAppeal(@Parent() post: { id: string; author: { id: string }; moderation: ContentState }, @CurrentViewer() viewer: Viewer | null) {
    return this.moderationService.canAppeal(viewer?.userId, 'CLASSROOM_POST', { id: post.id, authorId: post.author.id, moderation: post.moderation })
  }

  @ResolveField('discussion')
  discussion(@Parent() post: { id: string }, @CurrentViewer() viewer: Viewer | null) {
    return discussionOf(this.comments, viewer?.userId, 'CLASSROOM_POST', post.id)
  }
}

@Resolver('Discussion')
@UseGuards(SignedInGuard)
export class DiscussionResolver {
  constructor(private readonly comments: CommentsService) {}

  @Query('discussion')
  discussion(@Args('target') target: { type: CommentTargetKind; id: string }, @CurrentViewer() viewer: Viewer) {
    return discussionOf(this.comments, viewer.userId, target.type, target.id)
  }

  @ResolveField('comments')
  async list(@Parent() d: DiscussionParent, @Args('first') first: number | null, @Args('after') after: string | null, @Args('cardId') cardId: string | null, @CurrentViewer() viewer: Viewer) {
    const size = pageSize(first)
    const rows = await this.comments.list(viewer.userId, d.place, size, decodeCursor(after, 2) as [string, string] | null, cardId)
    return connection(rows, size, (c) => [c.createdAt.toISOString(), c.id], (row): CommentParent => ({ row, place: d.place }))
  }

  @ResolveField('commentCount')
  commentCount(@Parent() d: DiscussionParent, @CurrentViewer() viewer: Viewer) {
    return this.comments.count(viewer.userId, d.place)
  }

  @ResolveField('reactions')
  reactions(@Parent() d: DiscussionParent, @CurrentViewer() viewer: Viewer) {
    // A resource takes comments but no reactions: people save it instead (ADR-0075).
    const { target } = d.place
    if (target.type === 'RESOURCE') return { counts: [], viewerReaction: null }
    return this.comments.reactions(viewer.userId, { type: target.type, id: target.id }, d.place, d.place.ownerId)
  }

  @ResolveField('viewerCanComment')
  viewerCanComment(@Parent() d: DiscussionParent) {
    return d.place.canComment
  }

  @ResolveField('whyNot')
  whyNot(@Parent() d: DiscussionParent) {
    return d.place.whyNot
  }
}

@Resolver('Comment')
@UseGuards(SignedInGuard)
export class CommentResolver {
  constructor(
    private readonly comments: CommentsService,
    private readonly moderationService: ModerationService,
  ) {}

  @ResolveField('id')
  id(@Parent() c: CommentParent) {
    return c.row.id
  }

  @ResolveField('author')
  author(@Parent() c: CommentParent) {
    return c.row.deletedAt ? null : userRef(c.row.authorId)
  }

  @ResolveField('body')
  body(@Parent() c: CommentParent) {
    return c.row.deletedAt ? null : c.row.body
  }

  @ResolveField('cardId')
  cardId(@Parent() c: CommentParent) {
    return c.row.cardId
  }

  @ResolveField('removed')
  removed(@Parent() c: CommentParent) {
    return !!c.row.deletedAt
  }

  @ResolveField('pendingApproval')
  pendingApproval(@Parent() c: CommentParent) {
    return c.row.state === 'PENDING_APPROVAL'
  }

  @ResolveField('private')
  private_(@Parent() c: CommentParent) {
    return c.row.visibleTo !== null
  }

  @ResolveField('moderation')
  moderation(@Parent() c: CommentParent) {
    return c.row.moderation
  }

  @ResolveField('moderationReason')
  moderationReason(@Parent() c: CommentParent, @CurrentViewer() viewer: Viewer | null) {
    return moderationFor(c.row, viewer?.userId ?? '').moderationReason
  }

  @ResolveField('moderationCanAppeal')
  moderationCanAppeal(@Parent() c: CommentParent, @CurrentViewer() viewer: Viewer | null) {
    return this.moderationService.canAppeal(viewer?.userId, 'COMMENT', c.row)
  }

  @ResolveField('createdAt')
  createdAt(@Parent() c: CommentParent) {
    return c.row.createdAt
  }

  @ResolveField('editedAt')
  editedAt(@Parent() c: CommentParent) {
    return c.row.editedAt
  }

  @ResolveField('replies')
  async replies(@Parent() c: CommentParent, @CurrentViewer() viewer: Viewer) {
    if (c.row.parentId) return []
    return (await this.comments.replies(viewer.userId, c.place, c.row.id)).map((row): CommentParent => ({ row, place: c.place }))
  }

  @ResolveField('reactions')
  reactions(@Parent() c: CommentParent, @CurrentViewer() viewer: Viewer) {
    return this.comments.reactions(viewer.userId, { type: 'COMMENT', id: c.row.id }, c.place, c.row.authorId)
  }

  @ResolveField('viewerCan')
  viewerCan(@Parent() c: CommentParent, @CurrentViewer() viewer: Viewer) {
    const live = !c.row.deletedAt
    const mine = c.row.authorId === viewer.userId
    return {
      reply: live && !c.row.parentId && c.place.canComment,
      edit: live && mine,
      delete: live && (mine || c.place.canModerate),
      approve: live && c.row.state === 'PENDING_APPROVAL' && c.row.ownerId === viewer.userId,
    }
  }

  private payload(viewerId: string, run: () => Promise<string>): Promise<CommentPayload> {
    return withUserErrors<CommentPayload>(
      async () => {
        const found = await this.comments.get(viewerId, await run())
        return { comment: found ? { row: found.comment, place: found.place } : null }
      },
      { comment: null },
    )
  }

  @Mutation('addComment')
  addComment(@Args('input') input: { target: { type: CommentTargetKind; id: string }; cardId?: string | null; parentId?: string | null; body: unknown }, @CurrentViewer() viewer: Viewer) {
    return this.payload(viewer.userId, () => this.comments.add(viewer.userId, input))
  }

  @Mutation('editComment')
  editComment(@Args('input') input: { commentId: string; body: unknown }, @CurrentViewer() viewer: Viewer) {
    return this.payload(viewer.userId, () => this.comments.edit(viewer.userId, input.commentId, input.body))
  }

  @Mutation('deleteComment')
  deleteComment(@Args('input') input: { commentId: string }, @CurrentViewer() viewer: Viewer) {
    return this.payload(viewer.userId, () => this.comments.remove(viewer.userId, input.commentId))
  }

  @Mutation('approveComment')
  approveComment(@Args('input') input: { commentId: string }, @CurrentViewer() viewer: Viewer) {
    return this.payload(viewer.userId, () => this.comments.approve(viewer.userId, input.commentId))
  }

  @Mutation('react')
  react(@Args('input') input: { target: { type: ReactionTargetKind; id: string }; kind?: ReactionKindName | null }, @CurrentViewer() viewer: Viewer): Promise<ReactPayload> {
    return withUserErrors<ReactPayload>(async () => {
      await this.comments.react(viewer.userId, input.target, input.kind ?? null)
      return { reactions: await this.comments.reactionsOf(viewer.userId, input.target) }
    }, { reactions: null })
  }
}
