import { Inject, Injectable, type OnModuleInit } from '@nestjs/common'
import { Action, can, CardType, LearningEventType } from '@lvn/contracts/domain'
import { docText, inlineText, parseCardContent, type CardContent } from '@lvn/contracts/validation'
import { Errors } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { NOTE_ACCESS, TOPICS, type NoteAccess, type Topics } from '@lvn-backend/facades'
import { newId, PrismaService, type Prisma } from '@lvn-backend/prisma-base'
import { RateLimiter } from '@lvn-backend/redis'
import { ClassroomsService } from './classrooms.service'
import { LearningEventsService } from './learning-events.service'

export const QUIZ_LIMITS = { title: 120, questions: 50, quizzesPerHour: 30, attemptsPerHour: 60 } as const

export type QuizContent = CardContent<typeof CardType.QUIZ>
export type ClassQuizRow = Prisma.ClassQuizGetPayload<object>
export type QuizAttemptRow = Prisma.QuizAttemptGetPayload<{ include: { answers: true } }>

export interface PublishQuizInput {
  classroomId: string
  title: string
  questions: unknown[]
  sourceNoteId?: string | null
}

export interface SubmitAttemptInput {
  quizId: string
  clientOpId: string
  answers: { questionId: string; choiceIds: string[] }[]
}

/** A question as a viewer sees it: the correct choices and the explanation only once they may know them. */
export interface QuestionView {
  id: string
  position: number
  question: unknown
  choices: { id: string; content: unknown }[]
  multiple: boolean
  correct: string[] | null
  explanation: unknown
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x))

/**
 * Classroom quizzes (ADR-0064): staff publish a quiz of quiz-card questions to their class; members take it, scored
 * here; a person's first attempt is their score and later ones are practice. Answers stay hidden from a member until
 * they have submitted once.
 */
@Injectable()
export class ClassQuizzesService implements OnModuleInit {
  constructor(
    private readonly db: PrismaService,
    private readonly limiter: RateLimiter,
    private readonly classes: ClassroomsService,
    @Inject(NOTE_ACCESS) private readonly notes: NoteAccess,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    private readonly learning: LearningEventsService,
    @Inject(TOPICS) private readonly topics: Topics,
  ) {}

  onModuleInit(): void {
    // Attempts are the person's own data: they go with the account; quizzes they published stay with the class.
    this.events.subscribe('UserDeleted', async ({ payload }) => {
      await this.db.quizAttempt.deleteMany({ where: { userId: payload.userId } })
    })
  }

  async publish(actorId: string, input: PublishQuizInput): Promise<ClassQuizRow> {
    const { resource, actor } = await this.classes.require(actorId, input.classroomId)
    if (!can(actor, Action.CLASSROOM_PUBLISH_QUIZ, resource)) throw Errors.forbidden('Only the class’s teacher and TAs publish quizzes.')
    const title = input.title.trim()
    if (!title) throw Errors.validation('Give the quiz a title.', ['input', 'title'])
    if (title.length > QUIZ_LIMITS.title) throw Errors.validation(`Keep the title to ${QUIZ_LIMITS.title} characters.`, ['input', 'title'])
    if (!input.questions.length) throw Errors.validation('Add at least one question.', ['input', 'questions'])
    if (input.questions.length > QUIZ_LIMITS.questions) throw Errors.validation(`A quiz has at most ${QUIZ_LIMITS.questions} questions.`, ['input', 'questions'])
    const contents = input.questions.map((q, i) => question(q, i))
    const rate = await this.limiter.hit(`core:class:quiz:${actorId}`, { max: QUIZ_LIMITS.quizzesPerHour, windowSeconds: 3600 })
    if (!rate.allowed) throw Errors.rateLimited(rate.retryAfter, 'You have published a lot of quizzes in the last hour. Try again later.')
    // The note it was made from, kept only when its author can read it.
    const sourceNoteId = input.sourceNoteId && (await this.notes.reach(actorId, input.sourceNoteId)) ? input.sourceNoteId : null
    const id = newId()
    const [quiz] = await this.db.$transaction([
      this.db.classQuiz.create({ data: { id, classroomId: input.classroomId, authorId: actorId, title, sourceNoteId, questions: { create: contents.map((content, position) => ({ id: newId(), position, content: content as Prisma.InputJsonValue })) } } }),
      this.db.classroom.update({ where: { id: input.classroomId }, data: { updatedAt: new Date() } }),
    ])
    const members = await this.db.classroomMember.findMany({ where: { classroomId: input.classroomId, userId: { not: actorId } }, select: { userId: true } })
    for (let i = 0; i < members.length; i += 1000) {
      await this.events.publish('QuizPublished', { quizId: id, classroomId: input.classroomId, authorId: actorId, memberIds: members.slice(i, i + 1000).map((m) => m.userId) })
    }
    return quiz
  }

  /** The class's quizzes, newest first, for its members; empty for anyone else. */
  async list(viewerId: string, classroomId: string, first = 20): Promise<ClassQuizRow[]> {
    const place = await this.classes.require(viewerId, classroomId).catch(() => null)
    if (!place?.role) return []
    return this.db.classQuiz.findMany({ where: { classroomId, deletedAt: null }, orderBy: { publishedAt: 'desc' }, take: Math.min(Math.max(first, 1), 100) })
  }

  /** One quiz, for a member of its class; null for anyone else. */
  async get(viewerId: string, quizId: string): Promise<ClassQuizRow | null> {
    const quiz = await this.db.classQuiz.findFirst({ where: { id: quizId, deletedAt: null } })
    if (!quiz) return null
    const place = await this.classes.require(viewerId, quiz.classroomId).catch(() => null)
    return place?.role ? quiz : null
  }

  /** Whether the viewer is the class's staff, for whom the answers and the count of submissions are open. */
  async isStaff(viewerId: string, quiz: ClassQuizRow): Promise<boolean> {
    const { resource, actor } = await this.classes.require(viewerId, quiz.classroomId)
    return can(actor, Action.CLASSROOM_PUBLISH_QUIZ, resource)
  }

  async questions(viewerId: string, quiz: ClassQuizRow): Promise<QuestionView[]> {
    const reveal = (await this.isStaff(viewerId, quiz)) || (await this.db.quizAttempt.count({ where: { quizId: quiz.id, userId: viewerId } })) > 0
    const rows = await this.db.classQuizQuestion.findMany({ where: { quizId: quiz.id }, orderBy: { position: 'asc' } })
    return rows.map((r) => {
      const c = r.content as unknown as QuizContent
      return { id: r.id, position: r.position, question: c.question, choices: c.choices, multiple: c.multiple, correct: reveal ? c.correct : null, explanation: reveal ? (c.explanation ?? null) : null }
    })
  }

  questionCount(quizId: string): Promise<number> {
    return this.db.classQuizQuestion.count({ where: { quizId } })
  }

  /** The viewer's own attempts, newest first. */
  attempts(viewerId: string, quizId: string): Promise<QuizAttemptRow[]> {
    return this.db.quizAttempt.findMany({ where: { quizId, userId: viewerId }, include: { answers: true }, orderBy: { submittedAt: 'desc' }, take: 50 })
  }

  /** Staff: how many of the class's students have submitted it; null for everyone else (ADR-0064, per-student results wait for Phase 6). */
  async submittedCount(viewerId: string, quiz: ClassQuizRow): Promise<number | null> {
    if (!(await this.isStaff(viewerId, quiz))) return null
    const students = await this.db.classroomMember.findMany({ where: { classroomId: quiz.classroomId, role: 'STUDENT' }, select: { userId: true } })
    const took = await this.db.quizAttempt.findMany({ where: { quizId: quiz.id, userId: { in: students.map((s) => s.userId) } }, distinct: ['userId'], select: { userId: true } })
    return took.length
  }

  async submit(viewerId: string, input: SubmitAttemptInput): Promise<QuizAttemptRow> {
    // The same submission id returns the same attempt: a phone retries safely (§11).
    const again = await this.db.quizAttempt.findUnique({ where: { clientOpId: input.clientOpId }, include: { answers: true } })
    if (again) {
      if (again.userId !== viewerId || again.quizId !== input.quizId) throw Errors.validation('This submission id was used for something else.', ['input', 'clientOpId'])
      return again
    }
    const quiz = await this.get(viewerId, input.quizId)
    if (!quiz) throw Errors.notFound('Quiz not found.')
    const rows = await this.db.classQuizQuestion.findMany({ where: { quizId: quiz.id }, orderBy: { position: 'asc' } })
    const given = new Map<string, string[]>()
    for (const a of input.answers) {
      const row = rows.find((r) => r.id === a.questionId)
      if (!row) throw Errors.validation('An answer is for a question that is not in this quiz.', ['input', 'answers'])
      const choices = (row.content as unknown as QuizContent).choices.map((c) => c.id)
      const picked = [...new Set(a.choiceIds)]
      if (picked.some((id) => !choices.includes(id))) throw Errors.validation('An answer picks a choice the question does not have.', ['input', 'answers'])
      given.set(row.id, picked)
    }
    const rate = await this.limiter.hit(`core:class:quiz-attempt:${viewerId}`, { max: QUIZ_LIMITS.attemptsPerHour, windowSeconds: 3600 })
    if (!rate.allowed) throw Errors.rateLimited(rate.retryAfter, 'You have taken a lot of quizzes in the last hour. Try again later.')
    const answers = rows.map((r) => {
      const chosen = given.get(r.id) ?? []
      return { questionId: r.id, choiceIds: chosen, correct: chosen.length > 0 && sameSet(chosen, (r.content as unknown as QuizContent).correct) }
    })
    try {
      const attempt = await this.db.quizAttempt.create({
        data: { id: newId(), quizId: quiz.id, userId: viewerId, clientOpId: input.clientOpId, score: answers.filter((a) => a.correct).length, total: rows.length, answers: { create: answers } },
        include: { answers: true },
      })
      // A learning action (ADR-0030, ADR-0067): its answers count towards the day, and towards its source note's topics
      // (ADR-0070: weak topics, Readiness).
      const topicIds = quiz.sourceNoteId ? ((await this.topics.ofNotes([quiz.sourceNoteId])).get(quiz.sourceNoteId) ?? []) : []
      await this.learning.record(viewerId, { type: LearningEventType.QUIZ_COMPLETED, entityType: 'CLASS_QUIZ', entityId: quiz.id, topicKeys: topicIds.slice(0, 10).map((id) => `topic:${id}`), metadata: { answered: given.size, correct: attempt.score, total: attempt.total } })
      return attempt
    } catch (e) {
      // Two tries of the same submission at once: the first one stands.
      if ((e as { code?: string }).code === 'P2002') return this.db.quizAttempt.findUniqueOrThrow({ where: { clientOpId: input.clientOpId }, include: { answers: true } })
      throw e
    }
  }

  async remove(actorId: string, quizId: string): Promise<void> {
    const quiz = await this.db.classQuiz.findFirst({ where: { id: quizId, deletedAt: null } })
    if (!quiz) throw Errors.notFound('Quiz not found.')
    const { resource, actor } = await this.classes.require(actorId, quiz.classroomId)
    if (!can(actor, Action.CLASSROOM_PUBLISH_QUIZ, resource)) throw Errors.forbidden('Only the class’s teacher and TAs remove quizzes.')
    await this.db.classQuiz.update({ where: { id: quizId }, data: { deletedAt: new Date() } })
  }
}

/** A question as quiz card content: complete words, any page anchor dropped. */
function question(raw: unknown, i: number): QuizContent {
  const { anchor: _anchor, ...rest } = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const parsed = parseCardContent(CardType.QUIZ, rest)
  const field = ['input', 'questions', String(i)]
  if (!parsed.ok) throw Errors.validation(`Question ${i + 1} is not a complete question: ${parsed.message}`, field)
  const content = parsed.content as QuizContent
  if (!docText(content.question).trim()) throw Errors.validation(`Question ${i + 1} has no words.`, field)
  if (content.choices.some((c) => !inlineText(c.content).trim())) throw Errors.validation(`A choice in question ${i + 1} is empty.`, field)
  return content
}
