import { randomUUID } from 'node:crypto'
import { ExamsService } from '@lvn-backend/core'
import { PrismaService } from '@lvn-backend/prisma-base'
import { createTestApp, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'

/**
 * Exams through the API (ADR-0070): an exam on notes topics with a plan spread back from its day; quiz results by
 * topic and weak topics (low accuracy, not revisited before an exam); Readiness from FSRS recall and accuracy with its
 * target line; plan tasks done by learning on their topics; today's ring items and Rhythm's suggestion; the evening
 * reminder, once.
 */
describe('Exams', () => {
  let app: TestApp
  let db: PrismaService
  type Topic = { id: string; slug: string; title: string; subject: { slug: string } }
  let topics: Topic[]
  const EXAM = '{ id name date daysLeft past readiness target targetToday topics { key title recall accuracy mastery topic { id title } } tasks { day done today topics { key title } } }'
  type Exam = { id: string; name: string; date: string; daysLeft: number; readiness: number; target: number; targetToday: number; topics: { key: string; title: string; recall: number | null; accuracy: number | null; mastery: number; topic: { id: string; title: string } | null }[]; tasks: { day: string; done: boolean; today: boolean; topics: { key: string }[] }[] }
  const person = async () => {
    const u = await seedUser(app.app, { verified: true, handle: `ex${Date.now()}${Math.floor(Math.random() * 1e6)}` })
    return { id: u.id, token: tokenFor(app.config, u.id) }
  }
  const today = () => new Date(Date.now() - 4 * 3_600_000).toISOString().slice(0, 10) // learning day in UTC (04:00 rollover)
  const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
  const create = (token: string, input: { name: string; date: string; topicIds: string[] }) =>
    app.gql<{ createExam: { exam: Exam | null; userErrors: { message: string; code: string }[] } }>(`mutation ($input: CreateExamInput!) { createExam(input: $input) { exam ${EXAM} userErrors { message code } } }`, { input }, token)
  const exams = async (token: string) => (await app.gql<{ exams: Exam[] }>(`{ exams ${EXAM} }`, {}, token)).data!.exams
  const weak = async (token: string) => (await app.gql<{ weakTopics: { key: string; title: string | null; reason: string; accuracy: number | null; examName: string | null }[] }>('{ weakTopics { key title reason accuracy examName } }', {}, token)).data!.weakTopics
  const track = (token: string, events: object[]) =>
    app.gql('mutation ($input: TrackEventsInput!) { trackEvents(input: $input) { accepted } }', { input: { timeZone: 'UTC', events: events.map((e) => ({ id: randomUUID(), clientTs: new Date().toISOString(), platform: 'WEB', ...e })) } }, token)
  const eventually = async (check: () => Promise<boolean>) => {
    for (let i = 0; i < 50 && !(await check()); i++) await new Promise((r) => setTimeout(r, 100))
  }

  beforeAll(async () => {
    app = await createTestApp()
    db = app.app.get(PrismaService)
    // Curated topics with no children: /core pages, whose time counts for the topic too.
    topics = await db.topic.findMany({ where: { origin: 'CURATED', children: { none: {} } }, include: { subject: true }, orderBy: { id: 'asc' }, take: 3 })
  })

  afterAll(async () => {
    await app?.close()
  })

  it('makes an exam on topics with a plan back from its day, refusing what it cannot be', async () => {
    const me = await person()
    const [a, b] = topics
    const refusal = async (input: { name: string; date: string; topicIds: string[] }) => (await create(me.token, input)).data!.createExam.userErrors[0]?.message
    expect(await refusal({ name: 'OS', date: addDays(today(), -1), topicIds: [a!.id] })).toBe('The exam is today or later.')
    expect(await refusal({ name: 'OS', date: addDays(today(), 10), topicIds: [] })).toBe('Pick at least one topic.')
    expect(await refusal({ name: 'OS', date: addDays(today(), 10), topicIds: [randomUUID()] })).toBe('One of these topics does not exist.')
    expect(await refusal({ name: ' ', date: addDays(today(), 10), topicIds: [a!.id] })).toBe('Give the exam a name')

    // A month away, so no topic is weak yet for want of a visit (that starts 14 days before).
    const made = (await create(me.token, { name: 'Operating Systems', date: addDays(today(), 30), topicIds: [a!.id, b!.id] })).data!.createExam.exam!
    expect(made).toMatchObject({ name: 'Operating Systems', daysLeft: 30, readiness: 0, target: 80, targetToday: 0 })
    expect(made.topics.map((t) => t.key)).toEqual([`topic:${a!.id}`, `topic:${b!.id}`])
    expect(made.topics[0]).toMatchObject({ title: a!.title, recall: null, accuracy: null, mastery: 0, topic: { id: a!.id } })
    // Two topics over thirty days: the 15th and the 30th, the day before the exam.
    expect(made.tasks.map((t) => [t.day, t.topics.map((x) => x.key)])).toEqual([
      [addDays(today(), 14), [`topic:${a!.id}`]],
      [addDays(today(), 29), [`topic:${b!.id}`]],
    ])
    expect(await db.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM learning."LearningEvent" WHERE "userId" = ${me.id}::uuid AND type = 'EXAM_CREATED'`).toEqual([{ n: 1n }])

    // New topics plan the days again; another person cannot see or change the exam.
    const updated = await app.gql<{ updateExam: { exam: Exam } }>(`mutation ($input: UpdateExamInput!) { updateExam(input: $input) { exam ${EXAM} } }`, { input: { id: made.id, topicIds: [b!.id] } }, me.token)
    expect(updated.data!.updateExam.exam.tasks).toEqual([expect.objectContaining({ day: addDays(today(), 29), topics: [expect.objectContaining({ key: `topic:${b!.id}` })] })])
    const other = await person()
    expect(await exams(other.token)).toEqual([])
    expect((await app.gql<{ deleteExam: { userErrors: { code: string }[] } }>('mutation ($input: ExamIdInput!) { deleteExam(input: $input) { userErrors { code } } }', { input: { id: made.id } }, other.token)).data!.deleteExam.userErrors[0]!.code).toBe('NOT_FOUND')
    expect((await app.gql<{ deleteExam: { ok: boolean } }>('mutation ($input: ExamIdInput!) { deleteExam(input: $input) { ok } }', { input: { id: made.id } }, me.token)).data!.deleteExam.ok).toBe(true)
    expect(await exams(me.token)).toEqual([])
    expect((await app.gql(`{ exams { id } }`)).errors?.[0]?.extensions.code).toBe('UNAUTHENTICATED')
  })

  it('finds topics to set an exam on', async () => {
    const me = await person()
    const word = topics[0]!.title.split(/\s+/)[0]!
    const found = (await app.gql<{ examTopicOptions: { id: string; key: string; title: string; subjectTitle: string }[] }>('query ($q: String!) { examTopicOptions(query: $q) { id key title subjectTitle } }', { q: word }, me.token)).data!.examTopicOptions
    expect(found.some((t) => t.id === topics[0]!.id && t.key === `topic:${topics[0]!.id}`)).toBe(true)
  })

  it('keeps quiz results by topic: low accuracy makes a topic weak, and Readiness counts it with recall', async () => {
    const me = await person()
    const [a, b] = topics
    // One in five right on topic A, from a quiz card checked in a note.
    await track(me.token, [{ type: 'QUIZ_COMPLETED', entityType: 'NOTE_CARD', entityId: randomUUID(), topicKeys: [`topic:${a!.id}`], metadata: { answered: 5, correct: 1 } }])
    await eventually(async () => (await db.topicQuizResult.count({ where: { userId: me.id } })) > 0)
    expect(await weak(me.token)).toEqual([{ key: `topic:${a!.id}`, title: a!.title, reason: 'LOW_ACCURACY', accuracy: 0.2, examName: null }])

    // A flashcard in a note on topic A, graded Easy: recall is near 1.
    const cardId = randomUUID()
    const doc = (text: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] })
    await app.gql('mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } } }', { input: { title: 'Paging', topicIds: [a!.id], cards: [{ id: cardId, type: 'flashcard', position: 'a0', content: { front: doc('What is a page?'), back: doc('A fixed-size block') } }] } }, me.token)
    await app.gql('mutation ($input: ReviewCardInput!) { reviewCard(input: $input) { review { state } } }', { input: { cardId, rating: 'EASY', clientOpId: randomUUID() } }, me.token)

    const exam = (await create(me.token, { name: 'Midterm', date: addDays(today(), 30), topicIds: [a!.id, b!.id] })).data!.createExam.exam!
    const ta = exam.topics.find((t) => t.key === `topic:${a!.id}`)!
    expect(ta.accuracy).toBeCloseTo(0.2)
    expect(ta.recall!).toBeGreaterThan(0.95)
    expect(ta.mastery).toBeCloseTo(0.6 * ta.recall! + 0.4 * 0.2)
    // B has neither: 0. Readiness is the mean.
    expect(exam.topics.find((t) => t.key === `topic:${b!.id}`)!.mastery).toBe(0)
    expect(exam.readiness).toBe(Math.round(((0.6 * ta.recall! + 0.08) / 2) * 100))
    // A weak topic gets two sessions, and comes first.
    expect(exam.tasks.map((t) => t.topics[0]!.key)).toEqual([`topic:${a!.id}`, `topic:${b!.id}`, `topic:${a!.id}`])
  })

  it('calls an exam topic not revisited in the 14 days before it weak, until time is spent on it', async () => {
    const me = await person()
    const c = topics[2]!
    await create(me.token, { name: 'Networks', date: addDays(today(), 5), topicIds: [c.id] })
    expect(await weak(me.token)).toEqual([expect.objectContaining({ key: `topic:${c.id}`, reason: 'NOT_REVISITED', examName: 'Networks' })])
    // Reading its /core page counts for the topic.
    await track(me.token, [{ type: 'TIME_SPENT', durationMs: 120_000, topicKeys: [`core:${c.subject.slug}/${c.slug}`], metadata: { activity: 'READING' } }])
    await eventually(async () => !(await weak(me.token)).length)
    expect(await weak(me.token)).toEqual([])
  })

  it('does today’s task by 10 minutes on its topics; the ring shows it, with a weak topic and a suggestion', async () => {
    const me = await person()
    const [a] = topics
    // An exam tomorrow: one session, today.
    await create(me.token, { name: 'Quiz day', date: addDays(today(), 1), topicIds: [a!.id] })
    const RHYTHM = '{ rhythm { plannedDays today { items { kind done total title topicKey } } suggestion { plannedDays examName daysLeft } } }'
    type R = { rhythm: { today: { items: { kind: string; done: number; total: number; title: string | null; topicKey: string | null }[] }; suggestion: { plannedDays: number; examName: string; daysLeft: number } | null } }
    const before = (await app.gql<R>(RHYTHM, {}, me.token)).data!.rhythm
    expect(before.today.items).toEqual(expect.arrayContaining([{ kind: 'PLAN_TASK', done: 0, total: 1, title: 'Quiz day', topicKey: null }, { kind: 'WEAK_TOPIC', done: 0, total: 1, title: a!.title, topicKey: `topic:${a!.id}` }]))
    expect(before.suggestion).toEqual({ plannedDays: 5, examName: 'Quiz day', daysLeft: 1 })
    await track(me.token, [{ type: 'TIME_SPENT', durationMs: 660_000, topicKeys: [`topic:${a!.id}`], metadata: { activity: 'FOCUS' } }])
    await eventually(async () => (await exams(me.token))[0]!.tasks[0]!.done)
    expect((await exams(me.token))[0]!.tasks[0]).toMatchObject({ today: true, done: true })
    const after = (await app.gql<R>(RHYTHM, {}, me.token)).data!.rhythm
    expect(after.today.items.find((i) => i.kind === 'PLAN_TASK')).toMatchObject({ done: 1, total: 1 })
    // The topic was visited: no longer weak, so no weak-topic item.
    expect(after.today.items.find((i) => i.kind === 'WEAK_TOPIC')).toBeUndefined()
  })

  it('reminds once in the evening of a task left today, and not of one done', async () => {
    const me = await person()
    const [a] = topics
    const exam = (await create(me.token, { name: 'Finals', date: addDays(today(), 1), topicIds: [a!.id] })).data!.createExam.exam!
    const service = app.app.get(ExamsService)
    const afternoon = new Date(`${today()}T15:00:00Z`)
    const evening = new Date(`${today()}T19:00:00Z`)
    await service.remind(afternoon)
    expect(await db.examPlanTask.count({ where: { examId: exam.id, remindedAt: { not: null } } })).toBe(0)
    await service.remind(evening)
    await service.remind(evening)
    const reminders = () => db.notification.findMany({ where: { userId: me.id, category: 'REVISION_REMINDER' } })
    await eventually(async () => (await reminders()).length > 0)
    expect(await reminders()).toEqual([expect.objectContaining({ path: `/exams/${exam.id}` })])
  })
})
