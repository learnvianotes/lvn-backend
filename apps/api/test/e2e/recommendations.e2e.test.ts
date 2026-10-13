import { randomUUID } from 'node:crypto'
import { RecommendationsService } from '@lvn-backend/core'
import { PrismaService } from '@lvn-backend/prisma-base'
import { createTestApp, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'

/**
 * Recommendations through the API (ADR-0071): an upcoming exam's topics, weak topics, a note to continue, a quiz on a
 * topic read this week and a popular note on an interest, each with its reason and in its score band; one row per
 * thing; dismissing hides an item; a new account is computed when it asks; only the person's own.
 */
describe('Recommendations', () => {
  let app: TestApp
  let db: PrismaService
  let topics: { id: string; title: string }[]
  type Rec = { kind: string; reason: string; score: number; note: { id: string } | null; noteTitle: string | null; topicKey: string | null; topicTitle: string | null }
  const RECS = '{ recommendations(limit: 20) { kind reason score note { id } noteTitle topicKey topicTitle } }'
  const person = async (verified = true) => {
    const u = await seedUser(app.app, { verified, handle: `rc${Date.now()}${Math.floor(Math.random() * 1e6)}` })
    return { id: u.id, token: tokenFor(app.config, u.id) }
  }
  const recs = async (token: string) => (await app.gql<{ recommendations: Rec[] }>(RECS, {}, token)).data!.recommendations
  const today = () => new Date(Date.now() - 4 * 3_600_000).toISOString().slice(0, 10)
  const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
  const track = (token: string, events: object[]) =>
    app.gql('mutation ($input: TrackEventsInput!) { trackEvents(input: $input) { accepted } }', { input: { timeZone: 'UTC', events: events.map((e) => ({ id: randomUUID(), clientTs: new Date().toISOString(), platform: 'WEB', ...e })) } }, token)
  const quiz = { question: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Which?' }] }] }, choices: [{ id: 'a', content: [{ type: 'text', text: 'This' }] }, { id: 'b', content: [{ type: 'text', text: 'That' }] }], correct: ['a'], multiple: false }
  /** A public note by `owner` on `topicId`, with a quiz card when asked. */
  const publicNote = async (owner: { token: string }, title: string, topicId: string, withQuiz: boolean) => {
    const cards = withQuiz ? [{ id: randomUUID(), type: 'quiz', position: 'a0', content: quiz }] : [{ id: randomUUID(), type: 'text', position: 'a0', content: { doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: title }] }] } } }]
    const id = (await app.gql<{ createNote: { note: { id: string } } }>('mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } } }', { input: { title, topicIds: [topicId], cards } }, owner.token)).data!.createNote.note.id
    await app.gql('mutation ($input: NoteIdInput!) { publishNote(input: $input) { note { id } } }', { input: { noteId: id } }, owner.token)
    await app.gql('mutation ($input: ChangeNoteVisibilityInput!) { changeNoteVisibility(input: $input) { note { id } } }', { input: { noteId: id, visibility: 'PUBLIC' } }, owner.token)
    return id
  }
  const eventually = async (check: () => Promise<boolean>) => {
    for (let i = 0; i < 50 && !(await check()); i++) await new Promise((r) => setTimeout(r, 100))
  }

  beforeAll(async () => {
    app = await createTestApp()
    db = app.app.get(PrismaService)
    topics = await db.topic.findMany({ where: { origin: 'CURATED', children: { none: {} } }, orderBy: { id: 'asc' }, skip: 5, take: 4 })
  })

  afterAll(async () => {
    await app?.close()
  })

  it('recommends an upcoming exam’s topics and weak topics, each with why, in their bands', async () => {
    const me = await person()
    const [a, b, c] = topics
    await app.gql('mutation ($input: CreateExamInput!) { createExam(input: $input) { exam { id } } }', { input: { name: 'Networks', date: addDays(today(), 5), topicIds: [a!.id, b!.id] } }, me.token)
    // A wrong answer on C, not an exam topic: weak by accuracy.
    await track(me.token, [{ type: 'QUIZ_COMPLETED', entityType: 'NOTE_CARD', entityId: randomUUID(), topicKeys: [`topic:${c!.id}`], metadata: { answered: 2, correct: 0 } }])
    await eventually(async () => (await db.topicQuizResult.count({ where: { userId: me.id } })) > 0)
    const list = await recs(me.token)
    const exam = list.filter((r) => r.kind === 'EXAM_TOPIC')
    expect(exam.map((r) => r.topicKey).sort()).toEqual([`topic:${a!.id}`, `topic:${b!.id}`].sort())
    expect(exam[0]).toMatchObject({ reason: 'On your plan for Networks, in 5 days', topicTitle: expect.any(String) })
    expect(exam.every((r) => r.score >= 80 && r.score <= 100)).toBe(true)
    // An exam topic is not recommended twice, though it is weak too (not revisited).
    expect(list.filter((r) => r.topicKey === `topic:${a!.id}`)).toHaveLength(1)
    const weak = list.find((r) => r.kind === 'REVISE_TOPIC')!
    expect(weak).toMatchObject({ topicKey: `topic:${c!.id}`, reason: 'Under 60% right in your last quizzes', topicTitle: c!.title })
    expect(weak.score).toBeGreaterThanOrEqual(60)
    expect(weak.score).toBeLessThanOrEqual(80)
    // Best first.
    expect(list.map((r) => r.score)).toEqual([...list.map((r) => r.score)].sort((x, y) => y - x))
    expect((await app.gql(RECS)).errors?.[0]?.extensions.code).toBe('UNAUTHENTICATED')
  })

  it('recommends a note to continue, a quiz on a topic read this week and a popular note on an interest; never one’s own', async () => {
    const author = await person()
    const [, , , d] = topics
    const quizNote = await publicNote(author, 'Sorting quiz', d!.id, true)
    const popular = await publicNote(author, 'Sorting explained', d!.id, false)
    // Three readers opened the popular note this month.
    for (let i = 0; i < 3; i++) await track((await person()).token, [{ type: 'NOTE_OPENED', entityType: 'NOTE', entityId: popular }])
    const me = await person()
    await db.studentProfile.upsert({ where: { userId: me.id }, create: { userId: me.id, interestTopicIds: [d!.id] }, update: { interestTopicIds: [d!.id] } })
    const mine = (await app.gql<{ createNote: { note: { id: string } } }>('mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } } }', { input: { title: 'Mine', topicIds: [d!.id] } }, me.token)).data!.createNote.note.id
    // Read the popular note three days ago, my own note too, and time on the topic today.
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString()
    await track(me.token, [
      { type: 'NOTE_OPENED', entityType: 'NOTE', entityId: popular, clientTs: threeDaysAgo },
      { type: 'NOTE_OPENED', entityType: 'NOTE', entityId: mine, clientTs: threeDaysAgo },
      { type: 'NOTE_OPENED', entityType: 'NOTE', entityId: 'not-a-note', clientTs: threeDaysAgo },
      { type: 'TIME_SPENT', durationMs: 120_000, topicKeys: [`topic:${d!.id}`], metadata: { activity: 'READING' } },
    ])
    await eventually(async () => (await db.learningDayTopic.count({ where: { userId: me.id } })) > 0)
    const list = await recs(me.token)
    // The popular note was being read: continue it (the higher band wins), not "popular".
    expect(list.filter((r) => r.note?.id === popular)).toEqual([expect.objectContaining({ kind: 'CONTINUE_NOTE', noteTitle: 'Sorting explained', reason: expect.stringMatching(/^You were reading this on /) })])
    expect(list.find((r) => r.note?.id === quizNote)).toMatchObject({ kind: 'QUIZ_ON_TOPIC', reason: `A quiz on ${d!.title}, which you read this week` })
    expect(list.some((r) => r.note?.id === mine)).toBe(false)

    // Someone who only has the interest: the popular note, by its readers.
    const other = await person()
    await db.studentProfile.upsert({ where: { userId: other.id }, create: { userId: other.id, interestTopicIds: [d!.id] }, update: { interestTopicIds: [d!.id] } })
    const theirs = await recs(other.token)
    const first = theirs.filter((r) => r.kind === 'POPULAR_NOTE')[0]!
    expect(first).toMatchObject({ note: { id: popular }, reason: `Popular in ${d!.title}` })
    expect(first.score).toBeLessThanOrEqual(30)
  })

  it('dismissing hides an item across recomputes; the hourly job covers active people', async () => {
    const me = await person()
    const [a] = topics
    await app.gql('mutation ($input: CreateExamInput!) { createExam(input: $input) { exam { id } } }', { input: { name: 'Soon', date: addDays(today(), 3), topicIds: [a!.id] } }, me.token)
    expect((await recs(me.token)).map((r) => r.topicKey)).toContain(`topic:${a!.id}`)
    const ok = await app.gql<{ dismissRecommendation: { ok: boolean } }>('mutation ($input: DismissRecommendationInput!) { dismissRecommendation(input: $input) { ok } }', { input: { kind: 'EXAM_TOPIC', entityId: `topic:${a!.id}` } }, me.token)
    expect(ok.data!.dismissRecommendation.ok).toBe(true)
    expect((await recs(me.token)).map((r) => r.topicKey)).not.toContain(`topic:${a!.id}`)
    // Active today (a learning day), so the hourly run computes again; the dismissal holds.
    await track(me.token, [{ type: 'TIME_SPENT', durationMs: 60_000, metadata: { activity: 'FOCUS' } }])
    await eventually(async () => (await db.learningDay.count({ where: { userId: me.id } })) > 0)
    expect(await app.app.get(RecommendationsService).computeActive()).toBeGreaterThanOrEqual(1)
    expect((await recs(me.token)).map((r) => r.topicKey)).not.toContain(`topic:${a!.id}`)
  })
})
