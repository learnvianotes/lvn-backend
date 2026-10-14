import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { createTestApp, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'

/**
 * Weekly contests (ADR-0082): admins write and publish them; one attempt each, timed by the server, with its own
 * question and choice order; the answer key only once it is over; scores and personal bests for the person; a band
 * among adults for an adult who asks once the window closes, never for anyone under 18 and never counting them.
 */
describe('weekly contests', () => {
  let t: TestApp
  let db: PrismaService
  type Person = { id: string; token: string }
  const HOUR = 3_600_000

  beforeAll(async () => {
    t = await createTestApp()
    db = t.app.get(PrismaService)
  })
  afterAll(() => t?.close())

  const person = async (opts: { role?: 'STUDENT' | 'PLATFORM_ADMIN'; dob?: string } = {}): Promise<Person> => {
    const u = await seedUser(t.app, { verified: true, ...(opts.role ? { globalRole: opts.role } : {}) })
    if (opts.dob) await db.user.update({ where: { id: u.id }, data: { dateOfBirth: new Date(opts.dob) } })
    return { id: u.id, token: tokenFor(t.config, u.id, undefined, [opts.role ?? 'STUDENT']) }
  }
  const gql = async <T>(query: string, variables: object, who: Person | null) => t.gql<T>(query, variables as Record<string, unknown>, who?.token)
  const question = (n: number) => ({ prompt: `Question ${n}?`, choices: ['Right', 'Wrong', 'Also wrong'], correct: 0, explanation: `Because ${n}.` })
  const SAVE = 'mutation ($input: ContestInput!) { saveContest(input: $input) { contest { id published questions { id } } userErrors { message } } }'
  const save = (who: Person, input: object) => gql<{ saveContest: { contest: { id: string; published: boolean } | null; userErrors: { message: string }[] } }>(SAVE, { input }, who)
  const ATTEMPT = 'id deadline finished score total personalBest band questions { id prompt choices { id text } myChoiceId correctChoiceId explanation }'
  type Attempt = {
    id: string
    finished: boolean
    score: number | null
    total: number
    personalBest: number | null
    band: string | null
    questions: { id: string; prompt: string; choices: { id: string; text: string }[]; myChoiceId: string | null; correctChoiceId: string | null; explanation: string | null }[]
  }
  type ContestView = { state: string; participantsMilestone: number | null; viewerAttempt: Attempt | null }
  const view = async (who: Person, id: string) => (await gql<{ contest: ContestView }>(`query ($id: UUID!) { contest(id: $id) { state participantsMilestone viewerAttempt { ${ATTEMPT} } } }`, { id }, who)).data!.contest
  const start = async (who: Person, contestId: string) =>
    (
      await gql<{ startContest: { contest: ContestView | null; userErrors: { message: string }[] } }>(
        `mutation ($input: StartContestInput!) { startContest(input: $input) { contest { state viewerAttempt { ${ATTEMPT} } } userErrors { message } } }`,
        { input: { contestId } },
        who,
      )
    ).data!.startContest
  const answer = async (who: Person, input: object) =>
    (await gql<{ answerContestQuestion: { userErrors: { message: string }[] } }>('mutation ($input: AnswerContestQuestionInput!) { answerContestQuestion(input: $input) { userErrors { message } } }', { input }, who)).data!
      .answerContestQuestion
  const submit = async (who: Person, attemptId: string) =>
    (await gql<{ submitContest: { contest: ContestView } }>(`mutation ($input: ContestAttemptIdInput!) { submitContest(input: $input) { contest { state viewerAttempt { ${ATTEMPT} } } } }`, { input: { attemptId } }, who)).data!.submitContest
      .contest.viewerAttempt!
  /** An open contest of `count` questions drawn from a pool of `pool`, published. */
  const openContest = async (admin: Person, opts: { count?: number; pool?: number } = {}) => {
    const now = Date.now()
    const made = (
      await save(admin, {
        title: `Heaps ${newId()}`,
        opensAt: new Date(now - HOUR).toISOString(),
        closesAt: new Date(now + 2 * HOUR).toISOString(),
        minutes: 20,
        questionCount: opts.count ?? 3,
        questions: Array.from({ length: opts.pool ?? 4 }, (_, i) => question(i + 1)),
      })
    ).data!.saveContest.contest!
    await gql('mutation ($input: ContestIdInput!) { publishContest(input: $input) { userErrors { message } } }', { input: { id: made.id } }, admin)
    return made.id
  }

  it('only platform admins write contests; a draft needs enough questions to be published', async () => {
    const admin = await person({ role: 'PLATFORM_ADMIN' })
    const student = await person()
    const now = Date.now()
    const input = { title: 'Graphs', opensAt: new Date(now + HOUR).toISOString(), closesAt: new Date(now + 3 * HOUR).toISOString(), minutes: 20, questionCount: 3, questions: [question(1), question(2)] }
    expect((await save(student, input)).errors?.[0]?.message).toBe('Only platform admins write contests.')
    expect((await save(admin, { ...input, minutes: 90 })).data!.saveContest.userErrors[0]?.message).toBe('Choose 5 to 60 minutes.')
    expect((await save(admin, { ...input, questions: [{ ...question(1), correct: 5 }] })).data!.saveContest.userErrors[0]?.message).toBe("Mark question 1's right choice.")
    const draft = (await save(admin, input)).data!.saveContest.contest!
    expect(draft.published).toBe(false)
    const publish = async () =>
      (
        await gql<{ publishContest: { contest: { published: boolean } | null; userErrors: { message: string }[] } }>(
          'mutation ($input: ContestIdInput!) { publishContest(input: $input) { contest { published } userErrors { message } } }',
          { input: { id: draft.id } },
          admin,
        )
      ).data!.publishContest
    expect((await publish()).userErrors[0]?.message).toBe('Write at least 3 questions first.')
    expect((await save(admin, { ...input, id: draft.id, questions: [question(1), question(2), question(3)] })).data!.saveContest.userErrors).toEqual([])
    expect((await publish()).contest?.published).toBe(true)
    // Drafts are not listed; a published one that has not opened is UPCOMING and cannot be started.
    expect((await gql<{ contests: { id: string; state: string }[] }>('{ contests { id state } }', {}, student)).data!.contests.find((c) => c.id === draft.id)?.state).toBe('UPCOMING')
    expect((await start(student, draft.id)).userErrors[0]?.message).toBe('It has not opened yet.')
  })

  it('one attempt, timed by the server, its own order; the answer key only once it is over', async () => {
    const admin = await person({ role: 'PLATFORM_ADMIN' })
    const me = await person()
    const id = await openContest(admin)
    const started = (await start(me, id)).contest!.viewerAttempt!
    expect(started.questions).toHaveLength(3)
    expect(started.finished).toBe(false)
    expect(started.questions.every((q) => q.correctChoiceId === null && q.explanation === null && q.choices.length === 3)).toBe(true)
    // Starting again keeps the one attempt.
    expect((await start(me, id)).contest!.viewerAttempt!.id).toBe(started.id)

    const [q1, q2] = started.questions
    const right = (q: Attempt['questions'][number]) => q.choices.find((c) => c.text === 'Right')!.id
    const wrong = (q: Attempt['questions'][number]) => q.choices.find((c) => c.text === 'Wrong')!.id
    expect((await answer(me, { attemptId: started.id, questionId: q1!.id, choiceId: 'c9' })).userErrors[0]?.message).toBe('That is not one of its choices.')
    expect((await answer(me, { attemptId: started.id, questionId: newId(), choiceId: 'c1' })).userErrors[0]?.message).toBe('That question is not in your attempt.')
    await answer(me, { attemptId: started.id, questionId: q1!.id, choiceId: wrong(q1!) })
    await answer(me, { attemptId: started.id, questionId: q1!.id, choiceId: right(q1!) })
    await answer(me, { attemptId: started.id, questionId: q2!.id, choiceId: wrong(q2!) })
    expect((await answer(await person(), { attemptId: started.id, questionId: q1!.id, choiceId: 'c1' })).userErrors[0]?.message).toBe('That attempt is not there any more.')

    const done = await submit(me, started.id)
    expect(done).toMatchObject({ finished: true, score: 1, total: 3, personalBest: 33, band: null })
    expect(done.questions.map((q) => [q.myChoiceId === q.correctChoiceId, !!q.explanation])).toEqual([
      [true, true],
      [false, true],
      [false, true],
    ])
    expect((await answer(me, { attemptId: started.id, questionId: q2!.id, choiceId: right(q2!) })).userErrors[0]?.message).toBe('Your time is up: the attempt is marked as it stands.')
  })

  it('an attempt past its deadline is marked as it stands', async () => {
    const admin = await person({ role: 'PLATFORM_ADMIN' })
    const me = await person()
    const id = await openContest(admin)
    const a = (await start(me, id)).contest!.viewerAttempt!
    await answer(me, { attemptId: a.id, questionId: a.questions[0]!.id, choiceId: a.questions[0]!.choices.find((c) => c.text === 'Right')!.id })
    await db.contestAttempt.update({ where: { id: a.id }, data: { deadline: new Date(Date.now() - 1000) } })
    expect((await view(me, id)).viewerAttempt).toMatchObject({ finished: true, score: 1 })
  })

  it('bands are for adults who ask, once closed; under-18s get none and are not counted', async () => {
    const admin = await person({ role: 'PLATFORM_ADMIN' })
    const id = await openContest(admin, { count: 3, pool: 3 })
    const adults = [await person(), await person(), await person(), await person()]
    const minor = await person({ dob: `${new Date().getUTCFullYear() - 15}-01-01` })
    const take = async (who: Person, rightCount: number) => {
      const a = (await start(who, id)).contest!.viewerAttempt!
      for (const [i, q] of a.questions.entries()) await answer(who, { attemptId: a.id, questionId: q.id, choiceId: q.choices.find((c) => c.text === (i < rightCount ? 'Right' : 'Wrong'))!.id })
      await submit(who, a.id)
    }
    // The minor scores best and fastest: were they counted, the best adult would only be second of five.
    await take(minor, 3)
    for (const [i, a] of adults.entries()) await take(a, 3 - Math.min(i, 3))
    const bands = (who: Person, show: boolean) =>
      gql<{ setContestBands: { settings: { showBands: boolean } | null; userErrors: { message: string }[] } }>(
        'mutation ($input: SetContestBandsInput!) { setContestBands(input: $input) { settings { showBands } userErrors { message } } }',
        { input: { show } },
        who,
      )
    expect((await bands(minor, true)).data!.setContestBands.userErrors[0]?.message).toBe('Comparisons stay off until you are 18.')
    expect((await bands(adults[0]!, true)).data!.setContestBands.settings).toEqual({ showBands: true })

    // While it is open, nobody has a band.
    expect((await view(adults[0]!, id)).viewerAttempt!.band).toBeNull()
    await db.contest.update({ where: { id }, data: { closesAt: new Date(Date.now() - 1000) } })
    expect((await view(adults[0]!, id)).viewerAttempt!.band).toBe('TOP_25')
    // Not asked for: none; a minor: none, whatever is stored.
    expect((await view(adults[1]!, id)).viewerAttempt!.band).toBeNull()
    await db.learnerSettings.upsert({ where: { userId: minor.id }, create: { userId: minor.id, contestBands: true }, update: { contestBands: true } })
    expect((await view(minor, id)).viewerAttempt).toMatchObject({ score: 3, band: null })
    expect((await view(minor, id)).participantsMilestone).toBeNull()
  })
})
