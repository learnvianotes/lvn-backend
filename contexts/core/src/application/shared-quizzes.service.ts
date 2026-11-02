import { randomBytes } from 'node:crypto'
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common'
import { LearningEventType, PUBLIC_NOTES_REQUIRE_VERIFICATION, type Actor } from '@lvn/contracts/domain'
import { Errors } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { PLATFORM_SETTINGS, POLICY, type PlatformSettings, type Policy } from '@lvn-backend/facades'
import { newId, PrismaService, type Prisma } from '@lvn-backend/prisma-base'
import { RateLimiter } from '@lvn-backend/redis'
import { answerIsCorrect, maySetQuizPublic, quizReadable, quizReadableByLink, quizStats, quizVisibilityChoices, type QuizStats, type QuizVisibility, type QuizVisibilityChoice } from '../domain/shared-quiz'
import { QUIZ_LIMITS, parseQuizQuestion, type QuestionView, type QuizContent } from './class-quizzes.service'
import { LearningEventsService } from './learning-events.service'

export type SharedQuizRow = Prisma.SharedQuizGetPayload<object>
export type SharedAttemptRow = Prisma.SharedQuizAttemptGetPayload<{ include: { answers: true } }>

export interface SharedQuizInput {
  title: string
  questions: unknown[]
  visibility?: QuizVisibility | null
}

export interface SubmitSharedAttemptInput {
  quizId: string
  clientOpId: string
  answers: { questionId: string; choiceIds: string[] }[]
}

/**
 * Quizzes a person shares outside a class. Attempts stay with the taker. The owner sees aggregates and no names.
 * The first attempt of each person is the score.
 */
@Injectable()
export class SharedQuizzesService implements OnModuleInit {
  constructor(
    private readonly db: PrismaService,
    private readonly limiter: RateLimiter,
    private readonly learning: LearningEventsService,
    @Inject(POLICY) private readonly policy: Policy,
    @Inject(PLATFORM_SETTINGS) private readonly settings: PlatformSettings,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  onModuleInit(): void {
    this.events.subscribe('UserDeleted', async ({ payload }) => {
      await this.db.sharedQuizAttempt.deleteMany({ where: { userId: payload.userId } })
    })
  }

  async create(ownerId: string, input: SharedQuizInput): Promise<SharedQuizRow> {
    const actor = await this.requireActor(ownerId)
    const title = this.title(input.title)
    const questions = this.questionsOf(input.questions)
    const visibility = input.visibility ?? 'PRIVATE'
    this.assertVisibility(actor, visibility)
    const rate = await this.limiter.hit(`core:quiz:${ownerId}`, { max: QUIZ_LIMITS.quizzesPerHour, windowSeconds: 3600 })
    if (!rate.allowed) throw Errors.rateLimited(rate.retryAfter, 'You have made a lot of quizzes in the last hour. Try again later.')
    return this.db.sharedQuiz.create({
      data: {
        id: newId(),
        ownerId,
        title,
        visibility,
        linkToken: randomBytes(24).toString('base64url'),
        publishedAt: visibility === 'PRIVATE' ? null : new Date(),
        questions: { create: questions.map((content, position) => ({ id: newId(), position, content: content as unknown as Prisma.InputJsonValue })) },
      },
    })
  }

  async update(ownerId: string, quizId: string, input: SharedQuizInput): Promise<SharedQuizRow> {
    const quiz = await this.owned(ownerId, quizId)
    const title = this.title(input.title)
    const questions = this.questionsOf(input.questions)
    const taken = await this.db.sharedQuizAttempt.count({ where: { quizId } })
    if (taken) throw Errors.validation('This quiz has been taken, so its questions stay as they are.')
    await this.db.$transaction(async (tx) => {
      await tx.sharedQuizQuestion.deleteMany({ where: { quizId } })
      await tx.sharedQuiz.update({
        where: { id: quizId },
        data: { title, questions: { create: questions.map((content, position) => ({ id: newId(), position, content: content as unknown as Prisma.InputJsonValue })) } },
      })
    })
    return { ...quiz, title }
  }

  async setVisibility(ownerId: string, quizId: string, visibility: QuizVisibility): Promise<SharedQuizRow> {
    const actor = await this.requireActor(ownerId)
    const quiz = await this.owned(ownerId, quizId)
    this.assertVisibility(actor, visibility)
    const publishedAt = visibility === 'PRIVATE' ? null : (quiz.publishedAt ?? new Date())
    return this.db.sharedQuiz.update({ where: { id: quizId }, data: { visibility, publishedAt } })
  }

  async remove(ownerId: string, quizId: string): Promise<void> {
    await this.owned(ownerId, quizId)
    await this.db.sharedQuiz.update({ where: { id: quizId }, data: { deletedAt: new Date() } })
  }

  async get(viewerId: string | null, quizId: string): Promise<SharedQuizRow | null> {
    const quiz = await this.db.sharedQuiz.findUnique({ where: { id: quizId } })
    return quiz && quizReadable(quiz, viewerId) ? quiz : null
  }

  async byLink(viewerId: string | null, token: string): Promise<SharedQuizRow | null> {
    const quiz = await this.db.sharedQuiz.findUnique({ where: { linkToken: token } })
    return quiz && quizReadableByLink(quiz, viewerId) ? quiz : null
  }

  async mine(ownerId: string, first: number | null | undefined): Promise<SharedQuizRow[]> {
    return this.db.sharedQuiz.findMany({ where: { ownerId, deletedAt: null }, orderBy: { updatedAt: 'desc' }, take: cap(first) })
  }

  async publicList(first: number | null | undefined): Promise<SharedQuizRow[]> {
    return this.db.sharedQuiz.findMany({ where: { visibility: 'PUBLIC', deletedAt: null, publishedAt: { not: null } }, orderBy: { publishedAt: 'desc' }, take: cap(first) })
  }

  async choicesFor(viewerId: string, quiz: SharedQuizRow): Promise<QuizVisibilityChoice[] | null> {
    if (viewerId !== quiz.ownerId) return null
    const actor = await this.policy.actor(viewerId)
    if (!actor) return null
    return quizVisibilityChoices(actor, this.settings.boolean(PUBLIC_NOTES_REQUIRE_VERIFICATION, true))
  }

  async questions(viewerId: string | null, quiz: SharedQuizRow): Promise<QuestionView[]> {
    const reveal = viewerId !== null && (viewerId === quiz.ownerId || (await this.db.sharedQuizAttempt.count({ where: { quizId: quiz.id, userId: viewerId } })) > 0)
    const rows = await this.db.sharedQuizQuestion.findMany({ where: { quizId: quiz.id }, orderBy: { position: 'asc' } })
    return rows.map((row) => {
      const content = row.content as unknown as QuizContent
      return { id: row.id, position: row.position, question: content.question, choices: content.choices, multiple: content.multiple, correct: reveal ? content.correct : null, explanation: reveal ? (content.explanation ?? null) : null }
    })
  }

  questionCount(quizId: string): Promise<number> {
    return this.db.sharedQuizQuestion.count({ where: { quizId } })
  }

  /** The viewer's own attempts. Another person's attempts are never returned. */
  attempts(viewerId: string, quizId: string): Promise<SharedAttemptRow[]> {
    return this.db.sharedQuizAttempt.findMany({ where: { quizId, userId: viewerId }, include: { answers: true }, orderBy: { submittedAt: 'desc' }, take: 50 })
  }

  /** Owner only. Counts, never user ids. */
  async stats(viewerId: string | null, quiz: SharedQuizRow): Promise<QuizStats | null> {
    if (viewerId !== quiz.ownerId) return null
    const [questions, attempts] = await Promise.all([
      this.db.sharedQuizQuestion.findMany({ where: { quizId: quiz.id }, orderBy: { position: 'asc' }, select: { id: true } }),
      this.db.sharedQuizAttempt.findMany({ where: { quizId: quiz.id }, include: { answers: { select: { questionId: true, correct: true } } } }),
    ])
    return quizStats(questions.map((question) => question.id), attempts)
  }

  async submit(viewerId: string, input: SubmitSharedAttemptInput): Promise<SharedAttemptRow> {
    const again = await this.db.sharedQuizAttempt.findUnique({ where: { clientOpId: input.clientOpId }, include: { answers: true } })
    if (again) {
      if (again.userId !== viewerId || again.quizId !== input.quizId) throw Errors.validation('This submission id was used for something else.', ['input', 'clientOpId'])
      return again
    }
    const quiz = await this.get(viewerId, input.quizId)
    if (!quiz) throw Errors.notFound('Quiz not found.')
    const rows = await this.db.sharedQuizQuestion.findMany({ where: { quizId: quiz.id }, orderBy: { position: 'asc' } })
    const given = new Map<string, string[]>()
    for (const answer of input.answers) {
      const row = rows.find((item) => item.id === answer.questionId)
      if (!row) throw Errors.validation('An answer is for a question that is not in this quiz.', ['input', 'answers'])
      const choices = (row.content as unknown as QuizContent).choices.map((choice) => choice.id)
      const picked = [...new Set(answer.choiceIds)]
      if (picked.some((id) => !choices.includes(id))) throw Errors.validation('An answer picks a choice the question does not have.', ['input', 'answers'])
      given.set(row.id, picked)
    }
    const rate = await this.limiter.hit(`core:quiz-attempt:${viewerId}`, { max: QUIZ_LIMITS.attemptsPerHour, windowSeconds: 3600 })
    if (!rate.allowed) throw Errors.rateLimited(rate.retryAfter, 'You have taken a lot of quizzes in the last hour. Try again later.')
    const answers = rows.map((row) => {
      const chosen = given.get(row.id) ?? []
      return { questionId: row.id, choiceIds: chosen, correct: answerIsCorrect(chosen, (row.content as unknown as QuizContent).correct) }
    })
    try {
      const attempt = await this.db.sharedQuizAttempt.create({
        data: { id: newId(), quizId: quiz.id, userId: viewerId, clientOpId: input.clientOpId, score: answers.filter((answer) => answer.correct).length, total: rows.length, answers: { create: answers } },
        include: { answers: true },
      })
      await this.learning.record(viewerId, { type: LearningEventType.QUIZ_COMPLETED, entityType: 'SHARED_QUIZ', entityId: quiz.id, metadata: { answered: given.size, correct: attempt.score, total: attempt.total } })
      return attempt
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') return this.db.sharedQuizAttempt.findUniqueOrThrow({ where: { clientOpId: input.clientOpId }, include: { answers: true } })
      throw e
    }
  }

  private title(raw: string): string {
    const title = raw.trim()
    if (!title) throw Errors.validation('Give the quiz a title.', ['input', 'title'])
    if (title.length > QUIZ_LIMITS.title) throw Errors.validation(`Keep the title to ${QUIZ_LIMITS.title} characters.`, ['input', 'title'])
    return title
  }

  private questionsOf(raw: unknown[]): ReturnType<typeof parseQuizQuestion>[] {
    if (!raw.length) throw Errors.validation('Add at least one question.', ['input', 'questions'])
    if (raw.length > QUIZ_LIMITS.questions) throw Errors.validation(`A quiz has at most ${QUIZ_LIMITS.questions} questions.`, ['input', 'questions'])
    return raw.map((question, i) => parseQuizQuestion(question, i))
  }

  private assertVisibility(actor: Actor, visibility: QuizVisibility): void {
    if (visibility === 'PUBLIC' && !maySetQuizPublic(actor, this.settings.boolean(PUBLIC_NOTES_REQUIRE_VERIFICATION, true))) {
      throw Errors.forbidden(actor.restrictedMinor ? 'Your account cannot make quizzes public.' : 'Your account cannot make quizzes public.')
    }
    if (visibility !== 'PRIVATE' && actor.suspended) throw Errors.forbidden('Your account is suspended.')
  }

  private async requireActor(userId: string): Promise<Actor> {
    const actor = await this.policy.actor(userId)
    if (!actor) throw Errors.unauthenticated()
    return actor
  }

  private async owned(ownerId: string, quizId: string): Promise<SharedQuizRow> {
    const quiz = await this.db.sharedQuiz.findFirst({ where: { id: quizId, ownerId, deletedAt: null } })
    if (!quiz) throw Errors.notFound('Quiz not found.')
    return quiz
  }
}

const cap = (first: number | null | undefined) => Math.min(Math.max(first ?? 20, 1), 50)
