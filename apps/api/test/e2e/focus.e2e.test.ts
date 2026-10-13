import { randomUUID } from 'node:crypto'
import { FocusService } from '@lvn-backend/core'
import { PrismaService } from '@lvn-backend/prisma-base'
import { createTestApp, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'

/**
 * Focus sessions, Rhythm buddies, the classroom ring and class performance through the API (ADR-0072): the server
 * counts a session's time, at most its plan, as focus time on its topic; buddies by mutual consent see each other
 * studying now; a class's ring names only students who share; staff see first scores and hard topics.
 */
describe('Focus and buddies', () => {
  let app: TestApp
  let db: PrismaService
  let topic: { id: string; title: string }
  type Person = { id: string; token: string; handle: string }
  const person = async (name = 'Learner', globalRole: 'STUDENT' | 'TEACHER' = 'STUDENT'): Promise<Person> => {
    const handle = `fb${Date.now()}${Math.floor(Math.random() * 1e6)}`
    const u = await seedUser(app.app, { verified: true, handle, displayName: name, globalRole })
    await db.user.update({ where: { id: u.id }, data: { createdAt: new Date(Date.now() - 30 * 86_400_000) } })
    return { id: u.id, token: tokenFor(app.config, u.id), handle }
  }
  const ok = (name: string, type = `${name[0]!.toUpperCase()}${name.slice(1)}Input`) => `mutation ($input: ${type}!) { ${name}(input: $input) { ok userErrors { message code } } }`
  type Ok = { ok: boolean; userErrors: { message: string; code: string }[] }
  const run = async (token: string, name: string, input: object, type?: string) => (await app.gql<Record<string, Ok>>(ok(name, type), { input }, token)).data![name]!
  const BUDDIES = '{ rhythmBuddies { buddies { id user { id } studyingNow topicTitle meetUrl countedDays target met } invites { id user { id } } sent { id user { id } } } }'
  type Buddies = { buddies: { id: string; user: { id: string }; studyingNow: boolean; topicTitle: string | null; meetUrl: string | null; countedDays: number; target: number }[]; invites: { id: string; user: { id: string } }[]; sent: { id: string; user: { id: string } }[] }
  const buddies = async (token: string) => (await app.gql<{ rhythmBuddies: Buddies }>(BUDDIES, {}, token)).data!.rhythmBuddies
  const follow = (who: Person, whom: Person) => app.gql('mutation ($input: PersonInput!) { followUser(input: $input) { userErrors { message } } }', { input: { userId: whom.id } }, who.token)

  beforeAll(async () => {
    app = await createTestApp()
    db = app.app.get(PrismaService)
    topic = (await db.topic.findFirst({ where: { origin: 'CURATED', children: { none: {} } }, orderBy: { id: 'desc' } }))!
  })

  afterAll(async () => {
    await app?.close()
  })

  it('starts a focus session, refusing what it cannot be, and counts its time at most the plan as focus on its topic', async () => {
    const me = await person()
    const START = 'mutation ($input: StartFocusSessionInput!) { startFocusSession(input: $input) { session { id plannedMinutes breakMinutes meetUrl topicKey } userErrors { message code } } }'
    type Start = { startFocusSession: { session: { id: string; plannedMinutes: number; breakMinutes: number } | null; userErrors: { message: string; code: string }[] } }
    const start = async (input: object) => (await app.gql<Start>(START, { input }, me.token)).data!.startFocusSession
    expect((await start({ minutes: 3 })).userErrors[0]!.message).toBe('Choose 5 to 90 minutes.')
    expect((await start({ meetUrl: 'https://example.com/call' })).userErrors[0]!.message).toBe('A Meet link looks like https://meet.google.com/abc-defg-hij')
    expect((await start({ noteId: randomUUID() })).userErrors[0]!.code).toBe('NOT_FOUND')
    const started = await start({ topicKey: `topic:${topic.id}` })
    expect(started.session).toMatchObject({ plannedMinutes: 25, breakMinutes: 5 })
    expect((await app.gql<{ focusSession: { id: string } }>('{ focusSession { id } }', {}, me.token)).data!.focusSession.id).toBe(started.session!.id)

    // Forty minutes later: 25 count, as focus time on the topic, and the day counts for Rhythm.
    const service = app.app.get(FocusService)
    const begun = (await db.focusSession.findUniqueOrThrow({ where: { id: started.session!.id } })).startedAt
    const ended = await service.end(me.id, started.session!.id, new Date(begun.getTime() + 40 * 60_000))
    expect(ended.focusedSeconds).toBe(25 * 60)
    const timeOnTopic = async () => (await db.learningDayTopic.aggregate({ where: { userId: me.id, topicKey: `topic:${topic.id}` }, _sum: { seconds: true } }))._sum.seconds ?? 0
    for (let i = 0; i < 50 && (await timeOnTopic()) < 1500; i++) await new Promise((r) => setTimeout(r, 100))
    expect(await timeOnTopic()).toBe(1500)
    expect((await app.gql<{ rhythm: { today: { counted: boolean } } }>('{ rhythm { today { counted } } }', {}, me.token)).data!.rhythm.today.counted).toBe(true)
    expect((await app.gql<{ focusSession: unknown }>('{ focusSession { id } }', {}, me.token)).data!.focusSession).toBeNull()
  })

  it('ends a session left open at its planned length', async () => {
    const me = await person()
    const service = app.app.get(FocusService)
    const s = await service.start(me.id, { minutes: 10, breakMinutes: 0 }, new Date(Date.now() - 60 * 60_000))
    expect(await service.closeAbandoned()).toBeGreaterThanOrEqual(1)
    expect(await db.focusSession.findUniqueOrThrow({ where: { id: s.id } })).toMatchObject({ focusedSeconds: 600, endedAt: new Date(s.startedAt.getTime() + 600_000) })
  })

  it('makes buddies by mutual consent, from people followed; buddies see each other studying now and their week', async () => {
    const asha = await person('Asha Rao')
    const ravi = await person('Ravi Kumar')
    const stranger = await person('Someone Else')
    expect((await run(asha.token, 'inviteRhythmBuddy', { handle: ravi.handle })).userErrors[0]!.message).toBe('Follow someone, or connect with them, before asking them to be your buddy.')
    expect((await run(asha.token, 'inviteRhythmBuddy', { handle: 'nobody-at-all' })).userErrors[0]!.code).toBe('NOT_FOUND')
    expect((await run(asha.token, 'inviteRhythmBuddy', { handle: asha.handle })).userErrors[0]!.code).toBe('NOT_FOUND')
    await follow(asha, ravi)
    expect((await run(asha.token, 'inviteRhythmBuddy', { handle: ravi.handle })).ok).toBe(true)
    expect((await run(asha.token, 'inviteRhythmBuddy', { handle: ravi.handle })).userErrors[0]!.code).toBe('CONFLICT')
    expect((await buddies(asha.token)).sent.map((s) => s.user.id)).toEqual([ravi.id])
    // Ravi is told, and answers.
    const told = async () => db.notification.findMany({ where: { userId: ravi.id, category: 'RHYTHM_BUDDY' } })
    for (let i = 0; i < 50 && !(await told()).length; i++) await new Promise((r) => setTimeout(r, 100))
    expect(await told()).toEqual([expect.objectContaining({ path: '/rhythm', actorId: asha.id })])
    const invite = (await buddies(ravi.token)).invites[0]!
    expect(invite.user.id).toBe(asha.id)
    expect((await run(stranger.token, 'answerRhythmBuddy', { id: invite.id, accept: true })).userErrors[0]!.code).toBe('NOT_FOUND')
    expect((await run(ravi.token, 'answerRhythmBuddy', { id: invite.id, accept: true })).ok).toBe(true)

    // Asha studies with a Meet link: Ravi sees it, and her week; a stranger sees nothing.
    await app.gql('mutation ($input: StartFocusSessionInput!) { startFocusSession(input: $input) { session { id } } }', { input: { topicKey: `topic:${topic.id}`, meetUrl: 'https://meet.google.com/abc-defg-hij' } }, asha.token)
    expect((await buddies(ravi.token)).buddies).toEqual([expect.objectContaining({ user: { id: asha.id }, studyingNow: true, topicTitle: topic.title, meetUrl: 'https://meet.google.com/abc-defg-hij', countedDays: 0, target: expect.any(Number) })])
    expect((await buddies(stranger.token)).buddies).toEqual([])
    expect((await buddies(asha.token)).buddies).toEqual([expect.objectContaining({ user: { id: ravi.id }, studyingNow: false, meetUrl: null })])
    // Either ends it.
    expect((await run(ravi.token, 'removeRhythmBuddy', { id: invite.id }, 'RhythmBuddyIdInput')).ok).toBe(true)
    expect((await buddies(asha.token)).buddies).toEqual([])
  })

  it('keeps to five buddies', async () => {
    const me = await person()
    const others = await Promise.all(Array.from({ length: 6 }, () => person()))
    for (const o of others) await follow(me, o)
    for (const o of others.slice(0, 5)) expect((await run(me.token, 'inviteRhythmBuddy', { handle: o.handle })).ok).toBe(true)
    expect((await run(me.token, 'inviteRhythmBuddy', { handle: others[5]!.handle })).userErrors[0]!.message).toBe('You can have 5 invites waiting.')
  })

  it('shows a class its Rhythm ring, naming only students who share; staff see first scores and hard topics', async () => {
    const teacher = await person('Ms Rao', 'TEACHER')
    const sharer = await person('Kiran Das')
    const quiet = await person('Meena Shah')
    const outsider = await person()
    const classroomId = (await app.gql<{ createClassroom: { classroom: { id: string } } }>('mutation ($input: CreateClassroomInput!) { createClassroom(input: $input) { classroom { id } } }', { input: { name: `Physics ${Date.now()}` } }, teacher.token)).data!.createClassroom.classroom.id
    await db.classroomMember.createMany({ data: [{ classroomId, userId: sharer.id, role: 'STUDENT' }, { classroomId, userId: quiet.id, role: 'STUDENT' }] })
    expect((await run(sharer.token, 'setRhythmSharing', { share: true }, 'SetRhythmSharingInput')).ok).toBe(true)
    await app.gql('mutation ($input: TrackEventsInput!) { trackEvents(input: $input) { accepted } }', { input: { timeZone: 'UTC', events: [{ id: randomUUID(), type: 'TIME_SPENT', durationMs: 660_000, metadata: { activity: 'FOCUS' }, clientTs: new Date().toISOString(), platform: 'WEB' }] } }, sharer.token)
    for (let i = 0; i < 50 && !(await db.learningDay.count({ where: { userId: sharer.id } })); i++) await new Promise((r) => setTimeout(r, 100))

    const RING = 'query ($id: UUID!) { classroom(id: $id) { rhythmRing { students metCount countedDays targetDays people { name countedDays user { id } } } performance { quizzes } } }'
    type Ring = { classroom: { rhythmRing: { students: number; countedDays: number; people: { name: string; countedDays: number; user: { id: string } }[] } | null; performance: unknown } | null }
    const ring = (await app.gql<Ring>(RING, { id: classroomId }, quiet.token)).data!.classroom!
    expect(ring.rhythmRing).toMatchObject({ students: 2, countedDays: 1, people: [{ name: 'Kiran Das', countedDays: 1, user: { id: sharer.id } }] })
    expect(ring.performance).toBeNull()
    expect((await app.gql<Ring>(RING, { id: classroomId }, outsider.token)).data!.classroom?.rhythmRing ?? null).toBeNull()

    // A quiz from a note on a topic: Kiran gets one of two right, Meena none; the class finds the topic hard.
    const noteId = (await app.gql<{ createNote: { note: { id: string } } }>('mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } } }', { input: { title: 'Motion', topicIds: [topic.id] } }, teacher.token)).data!.createNote.note.id
    const doc = (s: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s }] }] })
    const q = (s: string) => ({ question: doc(s), choices: [{ id: 'a', content: [{ type: 'text', text: 'Yes' }] }, { id: 'b', content: [{ type: 'text', text: 'No' }] }], correct: ['a'], multiple: false })
    const quizId = (await app.gql<{ publishClassQuiz: { quiz: { id: string; questions: { id: string }[] } } }>('mutation ($input: PublishClassQuizInput!) { publishClassQuiz(input: $input) { quiz { id questions { id } } } }', { input: { classroomId, title: 'Motion check', questions: [q('One?'), q('Two?')], sourceNoteId: noteId } }, teacher.token)).data!.publishClassQuiz.quiz
    const submit = (who: Person, choices: string[]) => app.gql('mutation ($input: SubmitQuizAttemptInput!) { submitQuizAttempt(input: $input) { attempt { score } } }', { input: { quizId: quizId.id, clientOpId: randomUUID(), answers: quizId.questions.map((x, i) => ({ questionId: x.id, choiceIds: [choices[i]!] })) } }, who.token)
    await submit(sharer, ['a', 'b'])
    await submit(sharer, ['a', 'a']) // practice: the first attempt stands
    await submit(quiet, ['b', 'b'])
    const PERF = 'query ($id: UUID!) { classroom(id: $id) { performance { quizzes students { name submitted average scores { quizTitle score total } user { id } } topics { key title accuracy answers hard topic { id } } } } }'
    type Perf = { classroom: { performance: { quizzes: number; students: { name: string; submitted: number; average: number | null; scores: { quizTitle: string; score: number; total: number }[] }[]; topics: { key: string; title: string; accuracy: number; answers: number; hard: boolean }[] } } }
    const perf = (await app.gql<Perf>(PERF, { id: classroomId }, teacher.token)).data!.classroom.performance
    expect(perf.quizzes).toBe(1)
    expect(perf.students).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Kiran Das', submitted: 1, average: 0.5, scores: [{ quizTitle: 'Motion check', score: 1, total: 2 }] }),
      expect.objectContaining({ name: 'Meena Shah', submitted: 1, average: 0 }),
    ]))
    expect(perf.topics).toEqual([expect.objectContaining({ key: `topic:${topic.id}`, title: topic.title, accuracy: 0.25, answers: 4, hard: true })])
  })
})
