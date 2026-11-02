import { UseGuards } from '@nestjs/common'
import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { withUserErrors, type UserError } from '@lvn-backend/errors'
import type { QuizVisibility } from '../domain/shared-quiz'
import { SharedQuizzesService, type SharedAttemptRow, type SharedQuizInput, type SharedQuizRow, type SubmitSharedAttemptInput } from '../application/shared-quizzes.service'

const toAttempt = (attempt: SharedAttemptRow) => ({
  id: attempt.id,
  score: attempt.score,
  total: attempt.total,
  submittedAt: attempt.submittedAt,
  answers: attempt.answers.map((answer) => ({ questionId: answer.questionId, choiceIds: answer.choiceIds, correct: answer.correct })),
})

type QuizPayload = { quiz: SharedQuizRow | null; userErrors: UserError[] }
type AttemptPayload = { attempt: ReturnType<typeof toAttempt> | null; quiz: SharedQuizRow | null; userErrors: UserError[] }

/** Quizzes shared by a link or in public, outside a class. */
@Resolver('SharedQuiz')
export class SharedQuizzesResolver {
  constructor(private readonly quizzes: SharedQuizzesService) {}

  @Query('sharedQuiz')
  sharedQuiz(@Args('id') id: string, @CurrentViewer() viewer: Viewer | null) {
    return this.quizzes.get(viewer?.userId ?? null, id)
  }

  @Query('sharedQuizByLink')
  sharedQuizByLink(@Args('token') token: string, @CurrentViewer() viewer: Viewer | null) {
    return this.quizzes.byLink(viewer?.userId ?? null, token)
  }

  @Query('myQuizzes')
  @UseGuards(SignedInGuard)
  myQuizzes(@Args('first') first: number | null, @CurrentViewer() viewer: Viewer) {
    return this.quizzes.mine(viewer.userId, first)
  }

  @Query('publicQuizzes')
  publicQuizzes(@Args('first') first: number | null) {
    return this.quizzes.publicList(first)
  }

  @ResolveField('owner')
  owner(@Parent() quiz: SharedQuizRow) {
    return { __typename: 'User', id: quiz.ownerId }
  }

  @ResolveField('questionCount')
  questionCount(@Parent() quiz: SharedQuizRow) {
    return this.quizzes.questionCount(quiz.id)
  }

  @ResolveField('questions')
  questions(@Parent() quiz: SharedQuizRow, @CurrentViewer() viewer: Viewer | null) {
    return this.quizzes.questions(viewer?.userId ?? null, quiz)
  }

  @ResolveField('sharePath')
  sharePath(@Parent() quiz: SharedQuizRow, @CurrentViewer() viewer: Viewer | null) {
    if (viewer?.userId !== quiz.ownerId || quiz.visibility === 'PRIVATE' || !quiz.publishedAt) return null
    return `/q/${quiz.linkToken}`
  }

  @ResolveField('visibilityChoices')
  visibilityChoices(@Parent() quiz: SharedQuizRow, @CurrentViewer() viewer: Viewer | null) {
    if (!viewer) return null
    return this.quizzes.choicesFor(viewer.userId, quiz)
  }

  @ResolveField('myAttempts')
  async myAttempts(@Parent() quiz: SharedQuizRow, @CurrentViewer() viewer: Viewer | null) {
    if (!viewer) return []
    return (await this.quizzes.attempts(viewer.userId, quiz.id)).map(toAttempt)
  }

  @ResolveField('stats')
  stats(@Parent() quiz: SharedQuizRow, @CurrentViewer() viewer: Viewer | null) {
    return this.quizzes.stats(viewer?.userId ?? null, quiz)
  }

  @ResolveField('viewerIsOwner')
  viewerIsOwner(@Parent() quiz: SharedQuizRow, @CurrentViewer() viewer: Viewer | null) {
    return viewer?.userId === quiz.ownerId
  }

  @Mutation('createSharedQuiz')
  @UseGuards(SignedInGuard)
  createSharedQuiz(@Args('input') input: SharedQuizInput, @CurrentViewer() viewer: Viewer): Promise<QuizPayload> {
    return withUserErrors<QuizPayload>(async () => ({ quiz: await this.quizzes.create(viewer.userId, input) }), { quiz: null })
  }

  @Mutation('updateSharedQuiz')
  @UseGuards(SignedInGuard)
  updateSharedQuiz(@Args('input') input: SharedQuizInput & { quizId: string }, @CurrentViewer() viewer: Viewer): Promise<QuizPayload> {
    return withUserErrors<QuizPayload>(async () => ({ quiz: await this.quizzes.update(viewer.userId, input.quizId, input) }), { quiz: null })
  }

  @Mutation('setSharedQuizVisibility')
  @UseGuards(SignedInGuard)
  setSharedQuizVisibility(@Args('input') input: { quizId: string; visibility: QuizVisibility }, @CurrentViewer() viewer: Viewer): Promise<QuizPayload> {
    return withUserErrors<QuizPayload>(async () => ({ quiz: await this.quizzes.setVisibility(viewer.userId, input.quizId, input.visibility) }), { quiz: null })
  }

  @Mutation('submitSharedQuizAttempt')
  @UseGuards(SignedInGuard)
  submitSharedQuizAttempt(@Args('input') input: SubmitSharedAttemptInput, @CurrentViewer() viewer: Viewer): Promise<AttemptPayload> {
    return withUserErrors<AttemptPayload>(
      async () => {
        const attempt = await this.quizzes.submit(viewer.userId, input)
        return { attempt: toAttempt(attempt), quiz: await this.quizzes.get(viewer.userId, input.quizId) }
      },
      { attempt: null, quiz: null },
    )
  }

  @Mutation('deleteSharedQuiz')
  @UseGuards(SignedInGuard)
  deleteSharedQuiz(@Args('input') input: { quizId: string }, @CurrentViewer() viewer: Viewer): Promise<{ ok: boolean; userErrors: UserError[] }> {
    return withUserErrors(async () => (await this.quizzes.remove(viewer.userId, input.quizId), { ok: true }), { ok: false })
  }
}
