import { randomUUID } from 'node:crypto'
import { RhythmService } from '@lvn-backend/core'
import { PrismaService } from '@lvn-backend/prisma-base'
import { createTestApp, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'

/**
 * Rhythm through the API (ADR-0030, ADR-0069): the week by learning day in the learner's zone, from the events they
 * send; the plan (3–6 weekdays); a comeback the day after a miss; pauses (14 days a term, never over each other) that
 * take paused planned days off the target; closed weeks keep the target they had and count towards the term; a late
 * event reopens its week.
 */
describe('Rhythm', () => {
  let app: TestApp
  let db: PrismaService
  const RHYTHM = '{ rhythm { timeZone plannedDays target countedDays met weeksThisTerm weeksAllTime countedDaysAllTime pauseDaysLeft week { day weekday planned counted status } today { day counted comeback cameBack reviews learningSeconds items { kind done total } } pauses { id from to reason active } } }'
  type Rhythm = { rhythm: { timeZone: string; plannedDays: number[]; target: number; countedDays: number; met: boolean; weeksThisTerm: number; weeksAllTime: number; countedDaysAllTime: number; pauseDaysLeft: number; week: { day: string; weekday: number; planned: boolean; counted: boolean; status: string }[]; today: { day: string; counted: boolean; comeback: boolean; cameBack: boolean }; pauses: { id: string; from: string; to: string; active: boolean }[] } }
  const person = async () => {
    const u = await seedUser(app.app, { verified: true, handle: `rh${Date.now()}${Math.floor(Math.random() * 1e6)}` })
    return { id: u.id, token: tokenFor(app.config, u.id) }
  }
  const rhythm = async (token: string) => (await app.gql<Rhythm>(RHYTHM, {}, token)).data!.rhythm
  /** Eleven focus minutes at a moment: a counted day. */
  const studyAt = (token: string, at: Date, timeZone = 'UTC') =>
    app.gql('mutation ($input: TrackEventsInput!) { trackEvents(input: $input) { accepted } }', { input: { timeZone, events: [{ id: randomUUID(), type: 'TIME_SPENT', durationMs: 660_000, metadata: { activity: 'FOCUS' }, clientTs: at.toISOString(), platform: 'WEB' }] } }, token)
  const ok = (name: string) => `mutation ($input: ${name}Input!) { ${name[0]!.toLowerCase() + name.slice(1)}(input: $input) { ok userErrors { message code } } }`
  const todayUtc = () => new Date(Date.now() - 4 * 3_600_000).toISOString().slice(0, 10) // learning day in UTC (04:00 rollover)
  const at = (day: string, hour = 12) => new Date(`${day}T${String(hour).padStart(2, '0')}:00:00Z`)
  const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)

  beforeAll(async () => {
    app = await createTestApp()
    db = app.app.get(PrismaService)
  })

  afterAll(async () => {
    await app?.close()
  })

  it('shows this week from Monday to Sunday with the default plan; today counts at 10 learning minutes', async () => {
    const me = await person()
    const r0 = await rhythm(me.token)
    expect(r0).toMatchObject({ timeZone: 'UTC', plannedDays: [1, 2, 4, 6], target: 4, countedDays: 0, met: false, pauseDaysLeft: 14 })
    expect(r0.week).toHaveLength(7)
    expect(r0.week[0]!.weekday).toBe(1)
    expect(r0.week.find((d) => d.day === r0.today.day)!.status).toBe('TODAY')
    await studyAt(me.token, new Date())
    const r1 = await rhythm(me.token)
    expect(r1.today.counted).toBe(true)
    expect(r1.week.find((d) => d.day === r1.today.day)!.status).toBe('COUNTED')
    expect(r1).toMatchObject({ countedDays: 1, countedDaysAllTime: 1 })
    expect((await app.gql(RHYTHM)).errors?.[0]?.extensions.code).toBe('UNAUTHENTICATED')
  })

  it('sets a plan of 3 to 6 weekdays, refusing others', async () => {
    const me = await person()
    expect((await app.gql<{ setRhythmPlan: { userErrors: { code: string }[] } }>(ok('SetRhythmPlan'), { input: { plannedDays: [1, 2] } }, me.token)).data!.setRhythmPlan.userErrors[0]!.code).toBe('VALIDATION')
    expect((await app.gql<{ setRhythmPlan: { ok: boolean } }>(ok('SetRhythmPlan'), { input: { plannedDays: [5, 1, 3] } }, me.token)).data!.setRhythmPlan.ok).toBe(true)
    expect(await rhythm(me.token)).toMatchObject({ plannedDays: [1, 3, 5], target: 3 })
  })

  it('offers a comeback the day after a missed planned day, until a day counts', async () => {
    const me = await person()
    // Plan every day but Sunday: whatever today is, the last planned day before it was missed (looking past Sunday).
    await app.gql(ok('SetRhythmPlan'), { input: { plannedDays: [1, 2, 3, 4, 5, 6] } }, me.token)
    expect((await rhythm(me.token)).today).toMatchObject({ comeback: true, cameBack: false })
    await studyAt(me.token, new Date())
    expect((await rhythm(me.token)).today).toMatchObject({ comeback: false, cameBack: true })
  })

  it('pauses: from today on, 14 days a term, not over another pause; paused planned days leave the target', async () => {
    const me = await person()
    const today = todayUtc()
    const pause = (from: string, to: string) => app.gql<{ pauseRhythm: { ok: boolean; userErrors: { code: string; message: string }[] } }>(ok('PauseRhythm'), { input: { from, to, reason: 'EXAMS' } }, me.token)
    expect((await pause(addDays(today, -1), today)).data!.pauseRhythm.userErrors[0]!.code).toBe('VALIDATION')
    expect((await pause(today, addDays(today, 20))).data!.pauseRhythm.userErrors[0]!.message).toMatch(/14 days a term/)
    expect((await pause(today, addDays(today, 2))).data!.pauseRhythm.ok).toBe(true)
    expect((await pause(addDays(today, 1), addDays(today, 3))).data!.pauseRhythm.userErrors[0]!.code).toBe('CONFLICT')
    const r = await rhythm(me.token)
    expect(r.pauses).toEqual([expect.objectContaining({ from: today, to: addDays(today, 2), active: true })])
    expect(r.pauseDaysLeft).toBeLessThanOrEqual(11)
    const pausedPlanned = r.week.filter((d) => d.planned && d.day >= today && d.day <= addDays(today, 2)).length
    expect(r.target).toBe(Math.max(4 - pausedPlanned, 1))
    // Ended early: a pause that started today goes, and its days come back.
    const ended = await app.gql<{ endRhythmPause: { ok: boolean } }>('mutation ($input: RhythmPauseIdInput!) { endRhythmPause(input: $input) { ok userErrors { message } } }', { input: { id: r.pauses[0]!.id } }, me.token)
    expect(ended.data!.endRhythmPause.ok).toBe(true)
    expect(await rhythm(me.token)).toMatchObject({ pauses: [], pauseDaysLeft: 14 })
  })

  it('closes a week with the target it had; a met week counts this term; a late event reopens it', async () => {
    const me = await person()
    const lastMonday = addDays(addDays(todayUtc(), -((new Date(`${todayUtc()}T00:00:00Z`).getUTCDay() + 6) % 7)), -7)
    // Three of last week's four planned days (Monday, Tuesday, Thursday): not met.
    for (const d of [0, 1, 3]) await studyAt(me.token, at(addDays(lastMonday, d)))
    const service = app.app.get(RhythmService)
    await service.closeWeek(me.id, lastMonday)
    expect(await db.rhythmWeek.findUnique({ where: { userId_weekStart: { userId: me.id, weekStart: new Date(`${lastMonday}T00:00:00Z`) } } })).toMatchObject({ targetDays: 4, countedDays: 3, met: false })
    // A change of plan applies from now on: the closed week keeps its target.
    await app.gql(ok('SetRhythmPlan'), { input: { plannedDays: [1, 2, 3] } }, me.token)
    // The phone that was offline sends Saturday's session now: the week is closed again, and met.
    await studyAt(me.token, at(addDays(lastMonday, 5)))
    const reopened = async () => db.rhythmWeek.findUnique({ where: { userId_weekStart: { userId: me.id, weekStart: new Date(`${lastMonday}T00:00:00Z`) } } })
    for (let i = 0; i < 50 && !(await reopened())?.met; i++) await new Promise((r) => setTimeout(r, 100))
    expect(await reopened()).toMatchObject({ targetDays: 4, countedDays: 4, met: true })
    const r = await rhythm(me.token)
    expect(r.weeksAllTime).toBeGreaterThanOrEqual(1)
    expect(r.countedDaysAllTime).toBe(4)
  })

  it('closes last week hourly for whoever learned lately, once', async () => {
    const me = await person()
    const lastMonday = addDays(addDays(todayUtc(), -((new Date(`${todayUtc()}T00:00:00Z`).getUTCDay() + 6) % 7)), -7)
    await studyAt(me.token, at(addDays(lastMonday, 1)))
    const service = app.app.get(RhythmService)
    const week = () => db.rhythmWeek.findUnique({ where: { userId_weekStart: { userId: me.id, weekStart: new Date(`${lastMonday}T00:00:00Z`) } } })
    expect(await week()).toBeNull()
    await service.closeLastWeeks()
    expect(await week()).toMatchObject({ targetDays: 4, countedDays: 1, met: false })
    const closedAt = (await week())!.closedAt
    await service.closeLastWeeks()
    expect((await week())!.closedAt).toEqual(closedAt)
  })
})
