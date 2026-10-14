import { Inject, Injectable, type OnModuleInit } from '@nestjs/common'
import { milestoneFor } from '@lvn/contracts/domain'
import { Errors } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { PEOPLE, POLICY, TOPICS, type People, type Policy, type Topics } from '@lvn-backend/facades'
import { newId, Prisma, PrismaService } from '@lvn-backend/prisma-base'
import { bandOf, CONTEST_LIMITS, LISTED_DAYS, shuffle, stateOf, type ContestBandName, type ContestStateName } from '../domain/contests'

type Choice = { id: string; text: string }
type ContestRow = Prisma.ContestGetPayload<object>
type AttemptRow = Prisma.ContestAttemptGetPayload<{ include: { answers: true } }>

export interface ContestInput {
  title: string
  subjectId?: string | null
  opensAt: Date
  closesAt: Date
  minutes: number
  questionCount: number
  questions: { prompt: string; choices: string[]; correct: number; explanation: string }[]
}

export interface ContestView {
  id: string
  title: string
  subjectTitle: string | null
  opensAt: Date
  closesAt: Date
  minutes: number
  questionCount: number
  state: ContestStateName
  participantsMilestone: number | null
  viewerAttempt: AttemptView | null
}

export interface AttemptView {
  id: string
  startedAt: Date
  deadline: Date
  submittedAt: Date | null
  finished: boolean
  score: number | null
  total: number
  questions: { id: string; prompt: string; choices: Choice[]; myChoiceId: string | null; correctChoiceId: string | null; explanation: string | null }[]
  /** The best share right, 0–100, over the person's finished contests on this subject (any subject when it has none) */
  personalBest: number | null
  band: ContestBandName | null
}

/**
 * Weekly contests (ADR-0082): platform admins write a pool of questions with a window and a length; each person makes
 * one attempt, timed by the server, with the questions and their choices in an order picked for them. The right
 * answers and explanations are sent only once an attempt is over. Scores and personal bests are the person's alone;
 * an adult who asks sees a band among adults after the window closes; nobody under 18 is ever in a band or given one.
 */
@Injectable()
export class ContestsService implements OnModuleInit {
  constructor(
    private readonly db: PrismaService,
    @Inject(POLICY) private readonly policy: Policy,
    @Inject(PEOPLE) private readonly people: People,
    @Inject(TOPICS) private readonly topics: Topics,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  onModuleInit(): void {
    this.events.subscribe('UserDeleted', ({ payload }) => this.erase(payload.userId))
  }

  // ── Writing contests (platform admins) ───────────────────────────────────────────────────────────────────────

  private async admin(viewerId: string): Promise<void> {
    const actor = await this.policy.actor(viewerId)
    if (actor?.globalRole !== 'PLATFORM_ADMIN') throw Errors.forbidden('Only platform admins write contests.')
  }

  async adminList(viewerId: string) {
    await this.admin(viewerId)
    const rows = await this.db.contest.findMany({ orderBy: [{ opensAt: 'desc' }], take: 100, include: { questions: { orderBy: { position: 'asc' } }, _count: { select: { attempts: true } } } })
    return rows.map((c) => ({ ...c, attempts: c._count.attempts, questions: c.questions.map((q) => ({ ...q, choices: q.choices as Choice[] })) }))
  }

  async create(viewerId: string, input: ContestInput): Promise<string> {
    await this.admin(viewerId)
    const data = await this.fields(input)
    const id = newId()
    await this.db.contest.create({ data: { id, ...data.contest, createdById: viewerId, questions: { create: data.questions } } })
    return id
  }

  async update(viewerId: string, id: string, input: ContestInput): Promise<void> {
    await this.admin(viewerId)
    const row = await this.db.contest.findUnique({ where: { id } })
    if (!row) throw Errors.notFound('That contest is not there any more.')
    if (row.status !== 'DRAFT') throw Errors.validation('A published contest cannot be changed.')
    const data = await this.fields(input)
    await this.db.$transaction([this.db.contestQuestion.deleteMany({ where: { contestId: id } }), this.db.contest.update({ where: { id }, data: { ...data.contest, questions: { create: data.questions } } })])
  }

  async publish(viewerId: string, id: string, now = new Date()): Promise<void> {
    await this.admin(viewerId)
    const row = await this.db.contest.findUnique({ where: { id }, include: { _count: { select: { questions: true } } } })
    if (!row) throw Errors.notFound('That contest is not there any more.')
    if (row.status !== 'DRAFT') return
    if (row.closesAt <= now) throw Errors.validation('Its window has already closed: change it first.')
    if (row._count.questions < row.questionCount) throw Errors.validation(`Write at least ${row.questionCount} questions first.`)
    await this.db.contest.update({ where: { id }, data: { status: 'PUBLISHED', publishedAt: now } })
  }

  async remove(viewerId: string, id: string): Promise<void> {
    await this.admin(viewerId)
    const row = await this.db.contest.findUnique({ where: { id } })
    if (row && row.status !== 'DRAFT') throw Errors.validation('A published contest stays: people took it.')
    await this.db.contest.deleteMany({ where: { id, status: 'DRAFT' } })
  }

  private async fields(input: ContestInput) {
    const L = CONTEST_LIMITS
    const title = input.title.trim()
    if (!title || title.length > L.title) throw Errors.validation(`Give it a title of at most ${L.title} characters.`, ['input', 'title'])
    if (!(input.opensAt < input.closesAt)) throw Errors.validation('It must close after it opens.', ['input', 'closesAt'])
    if (input.closesAt.getTime() - input.opensAt.getTime() > L.windowDays * 86_400_000) throw Errors.validation(`Keep the window to ${L.windowDays} days at most.`, ['input', 'closesAt'])
    if (!Number.isInteger(input.minutes) || input.minutes < L.minutes.min || input.minutes > L.minutes.max) throw Errors.validation(`Choose ${L.minutes.min} to ${L.minutes.max} minutes.`, ['input', 'minutes'])
    if (!Number.isInteger(input.questionCount) || input.questionCount < L.questions.min || input.questionCount > L.questions.max) throw Errors.validation(`Ask ${L.questions.min} to ${L.questions.max} questions.`, ['input', 'questionCount'])
    if (input.questions.length > L.pool) throw Errors.validation(`A contest holds at most ${L.pool} questions.`, ['input', 'questions'])
    const subject = input.subjectId ? await this.topics.subject(input.subjectId) : null
    if (input.subjectId && !subject) throw Errors.validation('That subject is not there.', ['input', 'subjectId'])
    const questions = input.questions.map((q, i) => {
      const where = (field: string) => ['input', 'questions', String(i), field]
      const prompt = q.prompt.trim()
      const choices = q.choices.map((c) => c.trim())
      if (!prompt || prompt.length > L.prompt) throw Errors.validation(`Question ${i + 1} needs a prompt of at most ${L.prompt} characters.`, where('prompt'))
      if (choices.length < L.choices.min || choices.length > L.choices.max || choices.some((c) => !c || c.length > L.choice))
        throw Errors.validation(`Question ${i + 1} needs ${L.choices.min} to ${L.choices.max} choices of at most ${L.choice} characters.`, where('choices'))
      if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct >= choices.length) throw Errors.validation(`Mark question ${i + 1}'s right choice.`, where('correct'))
      const explanation = q.explanation.trim()
      if (!explanation || explanation.length > L.explanation) throw Errors.validation(`Question ${i + 1} needs an explanation of at most ${L.explanation} characters.`, where('explanation'))
      return { id: newId(), prompt, choices: choices.map((text, c) => ({ id: `c${c + 1}`, text })), correctChoiceId: `c${q.correct + 1}`, explanation, position: i }
    })
    return { contest: { title, subjectId: subject?.id ?? null, subjectTitle: subject?.title ?? null, opensAt: input.opensAt, closesAt: input.closesAt, minutes: input.minutes, questionCount: input.questionCount }, questions }
  }

  // ── Taking part ──────────────────────────────────────────────────────────────────────────────────────────────

  /** Published contests: open ones first, then upcoming, then those closed in the last four weeks, newest first. */
  async list(viewerId: string | null, now = new Date()): Promise<ContestView[]> {
    const rows = await this.db.contest.findMany({ where: { status: 'PUBLISHED', closesAt: { gt: new Date(now.getTime() - LISTED_DAYS * 86_400_000) } }, orderBy: { opensAt: 'desc' }, take: 50 })
    const order: Record<ContestStateName, number> = { OPEN: 0, UPCOMING: 1, CLOSED: 2 }
    const views = await Promise.all(rows.map((r) => this.view(viewerId, r, now)))
    return views.sort((a, b) => order[a.state] - order[b.state] || (a.state === 'UPCOMING' ? a.opensAt.getTime() - b.opensAt.getTime() : b.opensAt.getTime() - a.opensAt.getTime()))
  }

  async one(viewerId: string | null, id: string, now = new Date()): Promise<ContestView | null> {
    const row = await this.db.contest.findFirst({ where: { id, status: 'PUBLISHED' } })
    return row ? this.view(viewerId, row, now) : null
  }

  private async view(viewerId: string | null, c: ContestRow, now: Date): Promise<ContestView> {
    const [count, attempt] = await Promise.all([
      this.db.contestAttempt.count({ where: { contestId: c.id } }),
      viewerId ? this.db.contestAttempt.findUnique({ where: { contestId_userId: { contestId: c.id, userId: viewerId } }, include: { answers: true } }) : null,
    ])
    return {
      id: c.id,
      title: c.title,
      subjectTitle: c.subjectTitle,
      opensAt: c.opensAt,
      closesAt: c.closesAt,
      minutes: c.minutes,
      questionCount: c.questionCount,
      state: stateOf(c, now),
      participantsMilestone: milestoneFor(count),
      viewerAttempt: attempt && viewerId ? await this.attemptView(viewerId, c, attempt, now) : null,
    }
  }

  async start(viewerId: string, contestId: string, now = new Date()): Promise<ContestView> {
    const c = await this.db.contest.findFirst({ where: { id: contestId, status: 'PUBLISHED' }, include: { questions: true } })
    if (!c) throw Errors.notFound('That contest is not there any more.')
    if (stateOf(c, now) !== 'OPEN') throw Errors.validation(stateOf(c, now) === 'UPCOMING' ? 'It has not opened yet.' : 'It has closed.')
    const drawn = shuffle(c.questions).slice(0, c.questionCount)
    const choiceOrder = Object.fromEntries(drawn.map((q) => [q.id, shuffle((q.choices as Choice[]).map((x) => x.id))]))
    const deadline = new Date(Math.min(now.getTime() + c.minutes * 60_000, c.closesAt.getTime()))
    try {
      await this.db.contestAttempt.create({ data: { id: newId(), contestId, userId: viewerId, startedAt: now, deadline, questionIds: drawn.map((q) => q.id), choiceOrder, total: drawn.length } })
    } catch (err) {
      // Started already (two taps, two devices): the one attempt stands.
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err
    }
    return (await this.one(viewerId, contestId, now))!
  }

  private async mine(viewerId: string, attemptId: string) {
    const a = await this.db.contestAttempt.findFirst({ where: { id: attemptId, userId: viewerId }, include: { answers: true, contest: true } })
    if (!a) throw Errors.notFound('That attempt is not there any more.')
    return a
  }

  async answer(viewerId: string, input: { attemptId: string; questionId: string; choiceId: string }, now = new Date()): Promise<ContestView> {
    const a = await this.mine(viewerId, input.attemptId)
    if (a.submittedAt || now >= a.deadline) throw Errors.validation('Your time is up: the attempt is marked as it stands.')
    const order = (a.choiceOrder as Record<string, string[]>)[input.questionId]
    if (!order) throw Errors.validation('That question is not in your attempt.')
    if (!order.includes(input.choiceId)) throw Errors.validation('That is not one of its choices.')
    await this.db.contestAnswer.upsert({
      where: { attemptId_questionId: { attemptId: a.id, questionId: input.questionId } },
      create: { attemptId: a.id, questionId: input.questionId, choiceId: input.choiceId, answeredAt: now },
      update: { choiceId: input.choiceId, answeredAt: now },
    })
    return (await this.one(viewerId, a.contestId, now))!
  }

  async submit(viewerId: string, attemptId: string, now = new Date()): Promise<ContestView> {
    const a = await this.mine(viewerId, attemptId)
    if (!a.submittedAt) await this.mark(a, now < a.deadline ? now : a.deadline)
    return (await this.one(viewerId, a.contestId, now))!
  }

  /** Marks an attempt as it stands: each answer against its question's right choice. */
  private async mark(a: AttemptRow, at: Date): Promise<AttemptRow> {
    const questions = await this.db.contestQuestion.findMany({ where: { id: { in: a.questionIds } }, select: { id: true, correctChoiceId: true } })
    const right = new Map(questions.map((q) => [q.id, q.correctChoiceId]))
    const score = a.answers.filter((x) => right.get(x.questionId) === x.choiceId).length
    await this.db.contestAttempt.updateMany({ where: { id: a.id, submittedAt: null }, data: { submittedAt: at, score } })
    return { ...a, submittedAt: at, score }
  }

  private async attemptView(viewerId: string, c: ContestRow, row: AttemptRow, now: Date): Promise<AttemptView> {
    const a = !row.submittedAt && now >= row.deadline ? await this.mark(row, row.deadline) : row
    const finished = !!a.submittedAt
    const questions = await this.db.contestQuestion.findMany({ where: { id: { in: a.questionIds } } })
    const byId = new Map(questions.map((q) => [q.id, q]))
    const order = a.choiceOrder as Record<string, string[]>
    const chosen = new Map(a.answers.map((x) => [x.questionId, x.choiceId]))
    return {
      id: a.id,
      startedAt: a.startedAt,
      deadline: a.deadline,
      submittedAt: a.submittedAt,
      finished,
      score: finished ? a.score : null,
      total: a.total,
      questions: a.questionIds.flatMap((id) => {
        const q = byId.get(id)
        if (!q) return []
        const choices = new Map((q.choices as Choice[]).map((x) => [x.id, x]))
        return [
          {
            id: q.id,
            prompt: q.prompt,
            choices: (order[q.id] ?? []).flatMap((cid) => (choices.get(cid) ? [choices.get(cid)!] : [])),
            myChoiceId: chosen.get(q.id) ?? null,
            // The answer key only once the attempt is over (ADR-0082).
            correctChoiceId: finished ? q.correctChoiceId : null,
            explanation: finished ? q.explanation : null,
          },
        ]
      }),
      personalBest: finished ? await this.personalBest(viewerId, c.subjectId) : null,
      band: finished ? await this.band(viewerId, c, a, now) : null,
    }
  }

  private async personalBest(userId: string, subjectId: string | null): Promise<number | null> {
    const rows = await this.db.contestAttempt.findMany({ where: { userId, submittedAt: { not: null }, total: { gt: 0 }, ...(subjectId ? { contest: { subjectId } } : {}) }, select: { score: true, total: true } })
    return rows.length ? Math.max(...rows.map((r) => Math.round(((r.score ?? 0) / r.total) * 100))) : null
  }

  /**
   * The person's band among the contest's finished adult attempts, once the window has closed and only for an adult
   * who asked. Under-18s are left out of the population and never get one, whatever any setting says.
   */
  private async band(userId: string, c: ContestRow, a: { score: number | null; startedAt: Date; submittedAt: Date | null }, now: Date): Promise<ContestBandName | null> {
    if (stateOf(c, now) !== 'CLOSED' || a.score === null || !a.submittedAt) return null
    if (!(await this.bandsOn(userId, now))) return null
    const all = await this.db.contestAttempt.findMany({ where: { contestId: c.id, submittedAt: { not: null } }, select: { userId: true, score: true, startedAt: true, submittedAt: true } })
    const adults = new Set((await this.people.searchProfiles(all.map((x) => x.userId))).filter((p) => p.adultFrom.getTime() <= now.getTime()).map((p) => p.id))
    const seconds = (x: { startedAt: Date; submittedAt: Date | null }) => ((x.submittedAt ?? now).getTime() - x.startedAt.getTime()) / 1000
    return bandOf(
      { score: a.score, seconds: seconds(a) },
      all.filter((x) => adults.has(x.userId)).map((x) => ({ score: x.score ?? 0, seconds: seconds(x) })),
    )
  }

  private async adult(userId: string, now = new Date()): Promise<boolean> {
    const [p] = await this.people.searchProfiles([userId])
    return !!p && p.adultFrom.getTime() <= now.getTime()
  }

  private async bandsOn(userId: string, now: Date): Promise<boolean> {
    const s = await this.db.learnerSettings.findUnique({ where: { userId }, select: { contestBands: true } })
    return s?.contestBands === true && (await this.adult(userId, now))
  }

  async settings(userId: string): Promise<{ showBands: boolean; canShowBands: boolean }> {
    const adult = await this.adult(userId)
    const s = await this.db.learnerSettings.findUnique({ where: { userId }, select: { contestBands: true } })
    return { showBands: adult && s?.contestBands === true, canShowBands: adult }
  }

  async setBands(userId: string, show: boolean) {
    if (show && !(await this.adult(userId))) throw Errors.validation('Comparisons stay off until you are 18.', ['input', 'show'])
    await this.db.learnerSettings.upsert({ where: { userId }, create: { userId, contestBands: show }, update: { contestBands: show } })
    return this.settings(userId)
  }

  async exportFor(userId: string) {
    const rows = await this.db.contestAttempt.findMany({ where: { userId }, orderBy: { startedAt: 'asc' }, include: { contest: { select: { title: true } }, answers: true } })
    return rows.map((a) => ({
      contest: a.contest.title,
      startedAt: a.startedAt,
      submittedAt: a.submittedAt,
      score: a.score,
      total: a.total,
      answers: a.answers.map((x) => ({ questionId: x.questionId, choiceId: x.choiceId, answeredAt: x.answeredAt })),
    }))
  }

  async erase(userId: string): Promise<void> {
    await this.db.contestAttempt.deleteMany({ where: { userId } })
  }
}
