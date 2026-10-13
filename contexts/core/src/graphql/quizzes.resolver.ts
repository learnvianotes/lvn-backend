import { UseGuards } from '@nestjs/common'
import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { withUserErrors, type UserError } from '@lvn-backend/errors'
import { ClassQuizzesService, type ClassQuizRow, type PublishQuizInput, type QuizAttemptRow, type SubmitAttemptInput } from '../application/class-quizzes.service'
import type { ClassroomParent } from './classrooms.resolver'

const toAttempt = (a: QuizAttemptRow) => ({ id: a.id, score: a.score, total: a.total, submittedAt: a.submittedAt, answers: a.answers.map((x) => ({ questionId: x.questionId, choiceIds: x.choiceIds, correct: x.correct })) })

/** Classroom quizzes (ADR-0064). */
@Resolver('ClassQuiz')
@UseGuards(SignedInGuard)
export class ClassQuizzesResolver {
  constructor(private readonly quizzes: ClassQuizzesService) {}

  @Query('classQuiz')
  classQuiz(@Args('id') id: string, @CurrentViewer() viewer: Viewer) {
    return this.quizzes.get(viewer.userId, id)
  }

  @ResolveField('author')
  author(@Parent() q: ClassQuizRow) {
    return { __typename: 'User', id: q.authorId }
  }

  @ResolveField('questionCount')
  questionCount(@Parent() q: ClassQuizRow) {
    return this.quizzes.questionCount(q.id)
  }

  @ResolveField('questions')
  questions(@Parent() q: ClassQuizRow, @CurrentViewer() viewer: Viewer) {
    return this.quizzes.questions(viewer.userId, q)
  }

  @ResolveField('myAttempts')
  async myAttempts(@Parent() q: ClassQuizRow, @CurrentViewer() viewer: Viewer) {
    return (await this.quizzes.attempts(viewer.userId, q.id)).map(toAttempt)
  }

  @ResolveField('submittedCount')
  submittedCount(@Parent() q: ClassQuizRow, @CurrentViewer() viewer: Viewer) {
    return this.quizzes.submittedCount(viewer.userId, q)
  }

  @ResolveField('viewerCanDelete')
  viewerCanDelete(@Parent() q: ClassQuizRow, @CurrentViewer() viewer: Viewer) {
    return this.quizzes.isStaff(viewer.userId, q)
  }

  @Mutation('publishClassQuiz')
  publishClassQuiz(@Args('input') input: PublishQuizInput, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<{ quiz: ClassQuizRow | null; userErrors: UserError[] }>(async () => ({ quiz: await this.quizzes.publish(viewer.userId, input) }), { quiz: null })
  }

  @Mutation('submitQuizAttempt')
  submitQuizAttempt(@Args('input') input: SubmitAttemptInput, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<{ attempt: ReturnType<typeof toAttempt> | null; quiz: ClassQuizRow | null; userErrors: UserError[] }>(
      async () => {
        const attempt = await this.quizzes.submit(viewer.userId, input)
        return { attempt: toAttempt(attempt), quiz: await this.quizzes.get(viewer.userId, input.quizId) }
      },
      { attempt: null, quiz: null },
    )
  }

  @Mutation('deleteClassQuiz')
  deleteClassQuiz(@Args('input') input: { quizId: string }, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<{ ok: boolean; userErrors: UserError[] }>(async () => (await this.quizzes.remove(viewer.userId, input.quizId), { ok: true }), { ok: false })
  }
}

/** The class's quizzes on the Classroom type (members only). */
@Resolver('Classroom')
@UseGuards(SignedInGuard)
export class ClassroomQuizzesResolver {
  constructor(private readonly service: ClassQuizzesService) {}

  // Empty for anyone who is not a member: the service checks.
  @ResolveField('quizzes')
  quizzes(@Parent() c: ClassroomParent, @Args('first') first: number | null, @CurrentViewer() viewer: Viewer) {
    return this.service.list(viewer.userId, c.id, first ?? 20)
  }
}
