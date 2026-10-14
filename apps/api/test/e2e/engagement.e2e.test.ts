import { AchievementsService } from '@lvn-backend/core'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { createTestApp, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'

/**
 * Points, contributor levels and achievements (ADR-0080): points only from other people's actions on public work,
 * counted once, capped, from trusted accounts, and taken back with the work; achievements awarded once and told in the
 * app; all of it private unless an adult shows it.
 */
describe('engagement: points and achievements', () => {
  let t: TestApp
  let db: PrismaService
  let topicId: string
  type Person = { id: string; token: string; handle: string }
  const DAY = 86_400_000

  beforeAll(async () => {
    t = await createTestApp()
    db = t.app.get(PrismaService)
    topicId = (await db.topic.findFirstOrThrow({ where: { origin: 'CURATED', children: { none: {} } }, select: { id: true } })).id
  })
  afterAll(() => t?.close())

  /** A verified person whose account is `ageDays` old (a week and more counts as an actor). */
  const person = async (opts: { ageDays?: number; verified?: boolean; dob?: string; role?: 'STUDENT' | 'PLATFORM_ADMIN' } = {}): Promise<Person> => {
    const u = await seedUser(t.app, { verified: opts.verified ?? true, ...(opts.role ? { globalRole: opts.role } : {}) })
    await db.user.update({ where: { id: u.id }, data: { createdAt: new Date(Date.now() - (opts.ageDays ?? 30) * DAY), ...(opts.dob ? { dateOfBirth: new Date(opts.dob) } : {}) } })
    return { id: u.id, handle: u.handle, token: tokenFor(t.config, u.id, undefined, [opts.role ?? 'STUDENT']) }
  }
  const gql = async <T>(query: string, variables: object, who: Person | null) => t.gql<T>(query, variables as Record<string, unknown>, who?.token)
  const doc = (s: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s }] }] })
  const publicNote = async (who: Person, title: string) => {
    const id = (
      await gql<{ createNote: { note: { id: string } } }>(
        'mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } } }',
        { input: { title, topicIds: [topicId], cards: [{ id: newId(), type: 'text', position: 'a0', content: { doc: doc(title) } }] } },
        who,
      )
    ).data!.createNote.note.id
    await gql('mutation ($input: NoteIdInput!) { publishNote(input: $input) { note { id } } }', { input: { noteId: id } }, who)
    await gql('mutation ($input: ChangeNoteVisibilityInput!) { changeNoteVisibility(input: $input) { note { id } } }', { input: { noteId: id, visibility: 'PUBLIC' } }, who)
    return id
  }
  const react = (who: Person, noteId: string, kind: string | null = 'HELPFUL') => gql('mutation ($input: ReactInput!) { react(input: $input) { userErrors { message } } }', { input: { kind, target: { type: 'NOTE', id: noteId } } }, who)
  const points = async (who: Person) => (await gql<{ myPoints: { edges: { node: { delta: number; rule: string } }[] } }>('{ myPoints(first: 50) { edges { node { delta rule } } } }', {}, who)).data!.myPoints.edges.map((e) => e.node)
  const total = async (who: Person) => (await points(who)).reduce((s, e) => s + e.delta, 0)
  const profile = async (handle: string, viewer: Person | null) =>
    (
      await gql<{ userByHandle: { achievements: { kind: string; tier: number; title: string }[] | null; contribution: { points: number; level: string; nextLevelAt: number | null } | null } | null }>(
        'query ($h: String!) { userByHandle(handle: $h) { achievements { kind tier title } contribution { points level nextLevelAt } } }',
        { h: handle },
        viewer,
      )
    ).data!.userByHandle!
  /** Event handlers run after the request: wait for what they write. */
  const until = async (check: () => Promise<boolean>) => {
    for (let i = 0; i < 50 && !(await check()); i++) await new Promise((r) => setTimeout(r, 100))
  }

  it('earns points only from trusted others, once per action, and loses them with the reaction or the note', async () => {
    const author = await person()
    const fan = await person()
    const note = await publicNote(author, 'Heaps, kept short')
    const before = await total(author)

    // Not counted: oneself, an account under a week old, an unverified one.
    await react(author, note)
    await react(await person({ ageDays: 2 }), note)
    await react(await person({ verified: false }), note)
    expect(await total(author)).toBe(before)

    // A trusted reader's reaction counts once, whatever kind or how often it is changed.
    await react(fan, note)
    await react(fan, note, 'CELEBRATE')
    expect(await total(author)).toBe(before + 1)
    // Taken back with the reaction; earned again when given again, never twice.
    await react(fan, note, null)
    expect(await total(author)).toBe(before)
    await react(fan, note)
    expect(await total(author)).toBe(before + 1)

    // A fork is worth five.
    await gql('mutation ($input: NoteIdInput!) { forkNote(input: $input) { note { id } } }', { input: { noteId: note } }, fan)
    await until(async () => (await total(author)) === before + 6)
    expect(await total(author)).toBe(before + 6)

    // The note made private takes everything it earned back; the history says what happened, never who.
    await gql('mutation ($input: ChangeNoteVisibilityInput!) { changeNoteVisibility(input: $input) { note { id } } }', { input: { noteId: note, visibility: 'PRIVATE' } }, author)
    await until(async () => (await total(author)) === before)
    expect(await total(author)).toBe(before)
    expect((await points(author)).map((e) => `${e.rule} ${e.delta}`)).toEqual(expect.arrayContaining(['REACTION 1', 'REACTION -1', 'FORK 5', 'FORK -5']))
  })

  it('caps one person’s reactions towards another at five a week', async () => {
    const author = await person()
    const fan = await person()
    const notes = []
    for (let i = 0; i < 7; i++) notes.push(await publicNote(author, `Note ${i}`))
    for (const n of notes) await react(fan, n)
    expect(await total(author)).toBe(5)
    // Someone else's reactions still count.
    await react(await person(), notes[6]!)
    expect(await total(author)).toBe(6)
  })

  it('an approved resource earns ten and levels follow points; a trusted contributor may add more a day', async () => {
    const admin = await person({ role: 'PLATFORM_ADMIN' })
    const me = await person()
    const id = (
      await gql<{ submitResource: { resource: { id: string } } }>(
        'mutation ($input: SubmitResourceInput!) { submitResource(input: $input) { resource { id } } }',
        { input: { type: 'BOOK', title: 'Operating Systems: Three Easy Pieces', url: `https://example.org/ostep/${newId()}`, topicIds: [topicId] } },
        me,
      )
    ).data!.submitResource.resource.id
    await gql('mutation ($input: ModerateContentInput!) { moderateContent(input: $input) { ok } }', { input: { entityType: 'RESOURCE', entityId: id, action: 'APPROVE' } }, admin)
    await until(async () => (await total(me)) === 10)
    expect((await profile(me.handle, me)).contribution).toEqual({ points: 10, level: 'NEWCOMER', nextLevelAt: 50 })

    // 250 points make a trusted contributor, who may add 20 resources a day instead of 10.
    await db.pointsEntry.create({ data: { id: newId(), userId: me.id, delta: 240, rule: 'RESOURCE_APPROVED', sourceType: 'RESOURCE', sourceId: newId(), awardKey: `test:${newId()}` } })
    expect((await profile(me.handle, me)).contribution).toEqual({ points: 250, level: 'TRUSTED', nextLevelAt: null })
    for (let i = 0; i < 11; i++) {
      const res = await gql<{ submitResource: { userErrors: { message: string }[] } }>(
        'mutation ($input: SubmitResourceInput!) { submitResource(input: $input) { userErrors { message } } }',
        { input: { type: 'BOOK', title: `Book ${i}`, url: `https://example.org/b/${newId()}`, topicIds: [topicId] } },
        me,
      )
      expect([i, res.errors?.[0]?.message ?? res.data?.submitResource.userErrors[0]?.message ?? null]).toEqual([i, null])
    }
  })

  it('awards each achievement tier once, tells the person in the app, and keeps it theirs unless an adult shows it', async () => {
    const me = await person({ dob: '1999-01-01' })
    const other = await person()
    // Thirty quiz answers on a topic, all right, and four Rhythm weeks met.
    await db.topicQuizResult.create({ data: { userId: me.id, topicKey: `topic:${topicId}`, eventId: newId(), at: new Date(), answered: 30, correct: 30 } })
    for (let w = 1; w <= 4; w++) await db.rhythmWeek.create({ data: { userId: me.id, weekStart: new Date(Date.UTC(2026, 8, w * 7 - 6)), targetDays: 4, countedDays: 4, comebacks: 0, pausedDays: 0, met: true } })
    const achievements = t.app.get(AchievementsService)
    expect((await achievements.evaluate(me.id)).map((a) => a.key).sort()).toEqual(['QUIZ_MASTER:1', 'RHYTHM_WEEKS:4', 'TOPICS_MASTERED:1'])
    expect(await achievements.evaluate(me.id)).toEqual([])
    await until(async () => (await db.notification.count({ where: { userId: me.id, category: 'ACHIEVEMENT' } })) === 3)
    expect(await db.notification.count({ where: { userId: me.id, category: 'ACHIEVEMENT' } })).toBe(3)

    // Private by default: the person sees them, nobody else does.
    expect((await profile(me.handle, me)).achievements?.map((a) => a.title).sort()).toEqual(['4 Rhythm weeks', 'First topic mastered', 'Quiz master'])
    expect(await profile(me.handle, other)).toEqual({ achievements: null, contribution: null })
    expect(await profile(me.handle, null)).toEqual({ achievements: null, contribution: null })
    // An adult may show them.
    const shown = await gql<{ setAchievementsShown: { settings: { showAchievements: boolean; canShow: boolean } } }>('mutation { setAchievementsShown(input: { show: true }) { settings { showAchievements canShow } } }', {}, me)
    expect(shown.data!.setAchievementsShown.settings).toEqual({ showAchievements: true, canShow: true })
    expect((await profile(me.handle, other)).achievements).toHaveLength(3)
  })

  it('never shows a minor’s, whatever was set', async () => {
    const minor = await person({ dob: `${new Date().getUTCFullYear() - 15}-01-01` })
    const res = await gql<{ setAchievementsShown: { settings: unknown; userErrors: { message: string }[] } }>('mutation { setAchievementsShown(input: { show: true }) { settings { showAchievements } userErrors { message } } }', {}, minor)
    expect(res.data!.setAchievementsShown.userErrors[0]?.message).toBe('Achievements stay private until you are 18.')
    // Even a setting written before (or by mistake) shows nothing: strangers cannot find a minor, and the rule holds
    // wherever the person is reached from.
    await db.learnerSettings.upsert({ where: { userId: minor.id }, create: { userId: minor.id, showAchievements: true }, update: { showAchievements: true } })
    const other = await person()
    expect((await gql<{ userByHandle: unknown }>('query ($h: String!) { userByHandle(handle: $h) { id } }', { h: minor.handle }, other)).data!.userByHandle).toBeNull()
    const achievements = t.app.get(AchievementsService)
    expect([await achievements.of(other.id, minor.id), await achievements.contributionOf(other.id, minor.id)]).toEqual([null, null])
    expect((await gql<{ achievementSettings: { showAchievements: boolean; canShow: boolean } }>('{ achievementSettings { showAchievements canShow } }', {}, minor)).data!.achievementSettings).toEqual({
      showAchievements: false,
      canShow: false,
    })
  })
})
