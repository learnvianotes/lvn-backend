import { Inject, Injectable } from '@nestjs/common'
import { PEOPLE, TOPICS, type People, type Topics } from '@lvn-backend/facades'
import { Errors } from '@lvn-backend/errors'
import { PrismaService } from '@lvn-backend/prisma-base'
import { WEAK_ACCURACY } from '../domain/exams'
import { classGoalTarget, pooled, shareCap } from '../domain/tasks'
import { ClassroomsService } from './classrooms.service'
import { RhythmService } from './rhythm.service'

/** Students a class's ring and performance read at most */
const STUDENTS = 300
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name

/**
 * A class's Rhythm ring and its performance (ADR-0072). The ring is for members: this week's totals, and the names
 * and counted days of the students who chose to share (a child account by first name only). Performance is for staff:
 * each student's first score on each quiz, and the topics the class finds hard.
 */
@Injectable()
export class ClassInsightsService {
  constructor(
    private readonly db: PrismaService,
    private readonly classes: ClassroomsService,
    private readonly rhythm: RhythmService,
    @Inject(PEOPLE) private readonly people: People,
    @Inject(TOPICS) private readonly topics: Topics,
  ) {}

  private students(classroomId: string) {
    return this.db.classroomMember.findMany({ where: { classroomId, role: 'STUDENT' }, orderBy: { joinedAt: 'asc' }, take: STUDENTS, select: { userId: true } })
  }

  /** Members only; null for anyone else. */
  async ring(viewerId: string, classroomId: string, now = new Date()) {
    const view = await this.classes.view(viewerId, classroomId)
    if (!view?.role) return null
    const ids = (await this.students(classroomId)).map((s) => s.userId)
    const weeks = new Map<string, { countedDays: number; target: number; met: boolean }>()
    for (const id of ids) weeks.set(id, await this.rhythm.weekSummary(id, now))
    const sharing = new Set((await this.db.learnerSettings.findMany({ where: { userId: { in: ids }, shareRhythm: true }, select: { userId: true } })).map((s) => s.userId))
    const shared = ids.filter((id) => sharing.has(id))
    const names = await this.people.namesOf(shared)
    const people = []
    for (const id of shared) {
      if (!names[id]) continue
      const contact = await this.people.contactOf(id)
      const w = weeks.get(id)!
      people.push({ userId: id, name: contact?.restrictedMinor ? firstName(names[id]) : names[id], ...w })
    }
    const all = [...weeks.values()]
    const targetDays = all.reduce((s, w) => s + w.target, 0)
    return {
      students: ids.length,
      metCount: all.filter((w) => w.met).length,
      countedDays: all.reduce((s, w) => s + w.countedDays, 0),
      targetDays,
      people: people.sort((a, b) => b.countedDays - a.countedDays || a.name.localeCompare(b.name)),
      goal: await this.goal(classroomId, ids, weeks, targetDays, view.role === 'TEACHER' || view.role === 'TA', now),
    }
  }

  /**
   * The class's pooled goal this week (ADR-0081), when staff turned it on: counted days across the class against a
   * target, each student counting up to their share. Each student's part is for staff only.
   */
  private async goal(classroomId: string, ids: string[], weeks: Map<string, { countedDays: number }>, plannedDays: number, staff: boolean, now: Date) {
    const row = await this.db.classGoal.findUnique({ where: { classroomId } })
    if (!row) return null
    const recent = ids.length
      ? await this.db.rhythmWeek.groupBy({ by: ['weekStart'], where: { userId: { in: ids }, weekStart: { lt: new Date(now.getTime() - 6 * 86_400_000) } }, _sum: { countedDays: true }, orderBy: { weekStart: 'desc' }, take: 4 })
      : []
    const target = classGoalTarget({ students: ids.length, recentTotals: recent.map((r) => r._sum.countedDays ?? 0), plannedDays, set: row.target })
    const cap = shareCap(target, ids.length)
    const progress = pooled(ids.map((id) => weeks.get(id)?.countedDays ?? 0), cap)
    return {
      target,
      progress,
      sharePerStudent: cap,
      automatic: row.target === null,
      reached: progress >= target,
      parts: staff ? ids.map((id) => ({ userId: id, countedDays: Math.min(weeks.get(id)?.countedDays ?? 0, cap) })) : null,
    }
  }

  /** Staff turn the class goal on (with a target, or sized from the class's weeks) or off. */
  async setGoal(viewerId: string, classroomId: string, on: boolean, target: number | null): Promise<void> {
    const view = await this.classes.view(viewerId, classroomId)
    if (!view?.role) throw Errors.notFound('Class not found.')
    if (view.role !== 'TEACHER' && view.role !== 'TA') throw Errors.forbidden('Only the class’s teachers set its goal.')
    if (!on) {
      await this.db.classGoal.deleteMany({ where: { classroomId } })
      return
    }
    if (target !== null && (!Number.isInteger(target) || target < 1 || target > 10_000)) throw Errors.validation('Choose a target from 1 to 10,000 days.', ['input', 'target'])
    await this.db.classGoal.upsert({ where: { classroomId }, create: { classroomId, target, setById: viewerId }, update: { target, setById: viewerId } })
  }

  /** Staff only; null for anyone else. */
  async performance(viewerId: string, classroomId: string) {
    const view = await this.classes.view(viewerId, classroomId)
    // Staff who may admit students (ADR-0073: a class's teacher once verified, and TAs).
    if (!view?.can.review) return null
    const [quizzes, members] = await Promise.all([
      this.db.classQuiz.findMany({ where: { classroomId, deletedAt: null }, orderBy: { publishedAt: 'asc' }, select: { id: true, title: true, sourceNoteId: true } }),
      this.students(classroomId),
    ])
    const ids = members.map((m) => m.userId)
    const attempts = await this.db.quizAttempt.findMany({ where: { quizId: { in: quizzes.map((q) => q.id) }, userId: { in: ids } }, orderBy: { submittedAt: 'asc' }, select: { id: true, quizId: true, userId: true, score: true, total: true, submittedAt: true } })
    // A person's first attempt is their score (ADR-0064); later ones are practice.
    const first = new Map<string, (typeof attempts)[number]>()
    for (const a of attempts) if (!first.has(`${a.quizId}:${a.userId}`)) first.set(`${a.quizId}:${a.userId}`, a)
    const names = await this.people.namesOf(ids)
    const titles = new Map(quizzes.map((q) => [q.id, q.title]))
    const students = ids
      .filter((id) => names[id])
      .map((id) => {
        const scores = quizzes.flatMap((q) => {
          const a = first.get(`${q.id}:${id}`)
          return a ? [{ quizId: q.id, quizTitle: titles.get(q.id)!, score: a.score, total: a.total, submittedAt: a.submittedAt }] : []
        })
        const total = scores.reduce((s, x) => s + x.total, 0)
        return { userId: id, name: names[id]!, scores, submitted: scores.length, average: total ? scores.reduce((s, x) => s + x.score, 0) / total : null }
      })
    // Hard topics: right answers over answers in first attempts, by the quiz's source-note topics.
    const answers = await this.db.quizAnswer.findMany({ where: { attemptId: { in: [...first.values()].map((a) => a.id) } }, select: { attemptId: true, correct: true } })
    const quizOf = new Map([...first.values()].map((a) => [a.id, a.quizId]))
    const topicsOfNote = await this.topics.ofNotes(quizzes.flatMap((q) => (q.sourceNoteId ? [q.sourceNoteId] : [])))
    const quizTopics = new Map(quizzes.map((q) => [q.id, q.sourceNoteId ? (topicsOfNote.get(q.sourceNoteId) ?? []) : []]))
    const tally = new Map<string, { right: number; answers: number }>()
    for (const a of answers) {
      for (const t of quizTopics.get(quizOf.get(a.attemptId)!) ?? []) {
        const x = tally.get(t) ?? { right: 0, answers: 0 }
        tally.set(t, { right: x.right + (a.correct ? 1 : 0), answers: x.answers + 1 })
      }
    }
    const refs = new Map((await this.topics.usable(viewerId, [...tally.keys()])).map((t) => [t.id, t]))
    const topics = [...tally.entries()]
      .filter(([id]) => refs.has(id))
      .map(([id, x]) => ({ key: `topic:${id}`, topicId: id, title: refs.get(id)!.title, accuracy: x.right / x.answers, answers: x.answers, hard: x.right / x.answers < WEAK_ACCURACY }))
      .sort((a, b) => a.accuracy - b.accuracy)
    return { quizzes: quizzes.length, students, topics }
  }
}
