import { UseGuards } from '@nestjs/common'
import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { withUserErrors, type UserError } from '@lvn-backend/errors'
import { ReviewsService, type ReviewRating } from '../application/reviews.service'

type Ok = { ok: boolean; userErrors: UserError[] }

/** Flashcard reviews (ADR-0068). */
@Resolver()
@UseGuards(SignedInGuard)
export class ReviewsResolver {
  constructor(private readonly reviews: ReviewsService) {}

  @Query('reviewQueue')
  reviewQueue(@CurrentViewer() viewer: Viewer) {
    return this.reviews.queue(viewer.userId)
  }

  @Mutation('reviewCard')
  reviewCard(@Args('input') input: { cardId: string; rating: ReviewRating; reviewedAt?: string | null; durationMs?: number | null; clientOpId: string }, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<{ review: Awaited<ReturnType<ReviewsService['review']>> | null; userErrors: UserError[] }>(async () => ({ review: await this.reviews.review(viewer.userId, input) }), { review: null })
  }

  @Mutation('studyNoteCards')
  studyNoteCards(@Args('input') input: { noteId: string }, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<Ok>(async () => (await this.reviews.study(viewer.userId, input.noteId), { ok: true }), { ok: false })
  }

  @Mutation('stopStudyingNoteCards')
  stopStudyingNoteCards(@Args('input') input: { noteId: string }, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<Ok>(async () => (await this.reviews.stopStudying(viewer.userId, input.noteId), { ok: true }), { ok: false })
  }

  @Mutation('resetCardReview')
  resetCardReview(@Args('input') input: { cardId: string }, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<Ok>(async () => (await this.reviews.resetCard(viewer.userId, input.cardId), { ok: true }), { ok: false })
  }
}

/** core's part of the notes subgraph's Note: whether the viewer studies its flashcards. */
@Resolver('Note')
export class NoteStudyResolver {
  constructor(private readonly reviews: ReviewsService) {}

  @ResolveField('viewerStudying')
  viewerStudying(@Parent() note: { id: string }, @CurrentViewer() viewer: Viewer | null) {
    return viewer ? this.reviews.studying(viewer.userId, note.id) : null
  }
}
