import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { createTestApp, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'

/**
 * Weekly tasks and cooperative goals (ADR-0081): up to three tasks a week with progress read from learning and
 * suggestions from exams, weak topics and cards due; a class's pooled goal, its total for everyone and each part for
 * teachers only; a buddy pair's week together.
 */
describe('weekly tasks and cooperative goals', () => {
  let t: TestApp
  let db: PrismaService
  let topic: { id: string; title: string }
  type Person = { id: string; token: string; handle: string }
  /** Today's learning day in UTC (new accounts count days in UTC until they say otherwise). */
  const today = () => {
    const d = new Date(Date.now() - 4 * 3_600_000)
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  }

  beforeAll(async () => {
    t = await createTestApp()
    db = t.app.get(PrismaService)
    topic = await db.topic.findFirstOrThrow({ where: { origin: 'CURATED', children: { none: {} } }, select: { id: true, title: true } })
  })
  afterAll(() => t?.close())

  const person = async (role: 'STUDENT' | 'TEACHER' = 'STUDENT'): Promise<Person> => {
    const u = await seedUser(t.app, { verified: true, globalRole: role })
    return { id: u.id, handle: u.handle, token: tokenFor(t.config, u.id, undefined, [role]) }
  }
  const gql = async <T>(query: string, variables: object, who: Person) => t.gql<T>(query, variables as Record<string, unknown>, who.token)
  type Task = { kind: string; target: number; topicTitle: string | null; plan: string | null; progress: number; done: boolean }
  const tasks = async (who: Person) => (await gql<{ weeklyTasks: { tasks: (Task & { id: string })[]; max: number } }>('{ weeklyTasks { max tasks { id kind target topicTitle plan progress done } } }', {}, who)).data!.weeklyTasks
  const add = async (who: Person, input: object) => {
    const res = await gql<{ addWeeklyTask: { task: Task | null; userErrors: { message: string }[] } }>(
      'mutation ($input: AddWeeklyTaskInput!) { addWeeklyTask(input: $input) { task { kind target topicTitle plan progress done } userErrors { message } } }',
      { input },
      who,
    )
    return res.data!.addWeeklyTask
  }
  const counted = (userId: string) => db.learningDay.create({ data: { userId, day: today(), learningSeconds: 660, readingSeconds: 0, reviews: 12, quizAnswers: 0, events: 1 } })

  it('keeps up to three tasks a week, each with its progress from learning this week', async () => {
    const me = await person()
    expect((await add(me, { kind: 'REVIEWS', target: 10, plan: '  After lunch,   in the library  ' })).task).toMatchObject({ kind: 'REVIEWS', target: 10, plan: 'After lunch, in the library', progress: 0, done: false })
    expect((await add(me, { kind: 'TOPIC_MINUTES', target: 30 })).userErrors[0]?.message).toBe('Choose the topic.')
    expect((await add(me, { kind: 'QUIZ_ANSWERS', target: 2 })).userErrors[0]?.message).toBe('Choose a target from 5 to 300.')
    expect((await add(me, { kind: 'REVIEWS', target: 20, plan: 'x'.repeat(141) })).userErrors[0]?.message).toBe('Keep the plan to 140 characters.')
    expect((await add(me, { kind: 'TOPIC_MINUTES', target: 15, topicId: topic.id })).task).toMatchObject({ topicTitle: topic.title, progress: 0 })
    expect((await add(me, { kind: 'QUIZ_ANSWERS', target: 5, topicId: topic.id })).task?.done).toBe(false)
    expect((await add(me, { kind: 'REVIEWS', target: 5 })).userErrors[0]?.message).toBe('You have 3 tasks this week. Finish or remove one first.')

    // Learning this week moves them: 12 reviews, 16 minutes on the topic, 6 answers on it.
    await counted(me.id)
    await db.learningDayTopic.create({ data: { userId: me.id, day: today(), topicKey: `topic:${topic.id}`, seconds: 16 * 60, events: 3 } })
    await db.topicQuizResult.create({ data: { userId: me.id, topicKey: `topic:${topic.id}`, eventId: newId(), at: new Date(), answered: 6, correct: 4 } })
    const now = await tasks(me)
    expect(now.max).toBe(3)
    expect(now.tasks.map((x) => [x.kind, x.progress, x.done])).toEqual([
      ['REVIEWS', 12, true],
      ['TOPIC_MINUTES', 16, true],
      ['QUIZ_ANSWERS', 6, true],
    ])

    // Changed and removed by their owner only.
    const id = now.tasks[0]!.id
    const other = await person()
    expect(
      (await gql<{ updateWeeklyTask: { userErrors: { message: string }[] } }>('mutation ($input: UpdateWeeklyTaskInput!) { updateWeeklyTask(input: $input) { userErrors { message } } }', { input: { id, target: 50 } }, other)).data!
        .updateWeeklyTask.userErrors[0]?.message,
    ).toBe('That task is not there any more.')
    expect(
      (await gql<{ updateWeeklyTask: { task: Task } }>('mutation ($input: UpdateWeeklyTaskInput!) { updateWeeklyTask(input: $input) { task { target plan done } } }', { input: { id, target: 50, plan: '' } }, me)).data!.updateWeeklyTask.task,
    ).toEqual({ target: 50, plan: null, done: false })
    await gql('mutation ($input: WeeklyTaskIdInput!) { removeWeeklyTask(input: $input) { ok } }', { input: { id } }, me)
    expect((await tasks(me)).tasks).toHaveLength(2)
  })

  it('suggests the next exam’s weakest topic, a weak topic and the cards due, never one already set', async () => {
    const me = await person()
    const [weakTopic] = await db.topic.findMany({ where: { origin: 'CURATED', children: { none: {} }, id: { not: topic.id } }, take: 1, select: { id: true, title: true } })
    const date = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10)
    await gql('mutation ($input: CreateExamInput!) { createExam(input: $input) { userErrors { message } } }', { input: { name: 'Midterm', date, topicIds: [topic.id] } }, me)
    await db.topicQuizResult.create({ data: { userId: me.id, topicKey: `topic:${weakTopic!.id}`, eventId: newId(), at: new Date(), answered: 10, correct: 3 } })
    for (let i = 0; i < 6; i++)
      await db.cardReview.create({ data: { userId: me.id, cardId: newId(), noteId: newId(), due: new Date(), stability: 1, difficulty: 5, scheduledDays: 1, reps: 1, lapses: 0, state: 2, lastReview: new Date(), firstReviewAt: new Date() } })
    const suggest = async () => {
      const res = await gql<{ taskSuggestions: { kind: string; target: number; topicId: string | null; why: string }[] }>('{ taskSuggestions { kind target topicId why } }', {}, me)
      expect(res.errors).toBeUndefined()
      return res.data!.taskSuggestions
    }
    const first = await suggest()
    expect(first.map((s) => [s.kind, s.target, s.topicId])).toEqual([
      ['TOPIC_MINUTES', 60, topic.id],
      ['QUIZ_ANSWERS', 20, weakTopic!.id],
      ['REVIEWS', 6, null],
    ])
    expect(first[0]!.why).toBe(`Midterm is in 10 days, and ${topic.title} is its weakest topic.`)
    await add(me, { kind: 'TOPIC_MINUTES', target: 60, topicId: topic.id })
    expect((await suggest()).map((s) => s.kind)).toEqual(['QUIZ_ANSWERS', 'REVIEWS'])
  })

  it('a class goal pools counted days, each student up to a share; everyone sees the total, teachers each part', async () => {
    const teacher = await person('TEACHER')
    const [a, b] = [await person(), await person()]
    const classroomId = (
      await gql<{ createClassroom: { classroom: { id: string } } }>('mutation ($input: CreateClassroomInput!) { createClassroom(input: $input) { classroom { id } } }', { input: { name: `Physics ${Date.now()}` } }, teacher)
    ).data!.createClassroom.classroom.id
    await db.classroomMember.createMany({
      data: [
        { classroomId, userId: a.id, role: 'STUDENT' },
        { classroomId, userId: b.id, role: 'STUDENT' },
      ],
    })
    type Goal = { target: number; progress: number; sharePerStudent: number; automatic: boolean; reached: boolean; parts: { countedDays: number; user: { id: string } }[] | null } | null
    const goal = async (who: Person) =>
      (
        await gql<{ classroom: { rhythmRing: { goal: Goal } } }>(
          'query ($id: UUID!) { classroom(id: $id) { rhythmRing { goal { target progress sharePerStudent automatic reached parts { countedDays user { id } } } } } }',
          { id: classroomId },
          who,
        )
      ).data!.classroom.rhythmRing.goal
    const set = async (who: Person, input: object) => await gql<{ setClassGoal: { ok: boolean } }>('mutation ($input: SetClassGoalInput!) { setClassGoal(input: $input) { ok } }', { input: { classroomId, ...input } }, who)

    expect(await goal(a)).toBeNull()
    expect((await set(a, { on: true, target: 2 })).errors?.[0]?.message).toBe('Only the class’s teachers set its goal.')
    expect((await set(teacher, { on: true, target: 2 })).data!.setClassGoal.ok).toBe(true)
    await counted(a.id)
    await counted(b.id)
    expect(await goal(a)).toEqual({ target: 2, progress: 2, sharePerStudent: 2, automatic: false, reached: true, parts: null })
    expect((await goal(teacher))!.parts!.map((p) => p.countedDays)).toEqual([1, 1])

    // Sized from the class when no target is set: no history yet, so six tenths of the students' planned days, never
    // under a day a student.
    await set(teacher, { on: true })
    const planned = (await gql<{ classroom: { rhythmRing: { targetDays: number } } }>('query ($id: UUID!) { classroom(id: $id) { rhythmRing { targetDays } } }', { id: classroomId }, b)).data!.classroom.rhythmRing.targetDays
    const auto = Math.max(2, Math.round(planned * 0.6))
    expect(await goal(b)).toMatchObject({ target: auto, progress: Math.min(2, auto * 2), automatic: true, reached: 2 >= auto })
    await set(teacher, { on: false })
    expect(await goal(b)).toBeNull()
  })

  it('a buddy pair sees its week together', async () => {
    const [me, buddy] = [await person(), await person()]
    await db.rhythmBuddy.create({ data: { id: newId(), requesterId: me.id, addresseeId: buddy.id, status: 'ACCEPTED', acceptedAt: new Date() } })
    await counted(me.id)
    await counted(buddy.id)
    const mine = (
      await gql<{ rhythmBuddies: { buddies: { countedDays: number; target: number; together: { countedDays: number; target: number } }[] } }>('{ rhythmBuddies { buddies { countedDays target together { countedDays target } } } }', {}, me)
    ).data!.rhythmBuddies.buddies
    // A new account's target counts its planned days from its first day, so the two targets are the same here.
    expect(mine).toHaveLength(1)
    expect(mine[0]!.countedDays).toBe(1)
    expect(mine[0]!.together).toEqual({ countedDays: 2, target: 2 * mine[0]!.target })
  })
})
