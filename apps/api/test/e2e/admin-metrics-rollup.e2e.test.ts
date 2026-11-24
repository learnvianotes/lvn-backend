import { randomBytes } from 'node:crypto'
import { ErrorCode, type AppError } from '@lvn-backend/errors'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { UsersMaintenance } from '@lvn-backend/users'
import { createTestApp, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'

/**
 * The daily rollup of the admin usage metrics (ADR-0106): the nightly job, its idempotency, the backfill, the purge,
 * and weekly retention cohorts with small cohorts hidden. Days are IST.
 */

const IST_MS = 330 * 60_000
const DAY_MS = 86_400_000
const istDay = (at: Date) => new Date(at.getTime() + IST_MS).toISOString().slice(0, 10)
const shift = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10)
const mondayOf = (day: string) => shift(day, -((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7))
/** A wall-clock time in India on a day. */
const at = (day: string, hhmm = '12:00') => new Date(`${day}T${hhmm}:00+05:30`)
const dateOnly = (day: string) => new Date(`${day}T00:00:00Z`)

const refusal = async (promise: Promise<unknown>): Promise<AppError> => {
  try {
    await promise
  } catch (e) {
    return e as AppError
  }
  throw new Error('expected a refusal')
}

describe('daily metrics rollup', () => {
  let t: TestApp
  let db: PrismaService
  let maintenance: UsersMaintenance
  const today = istDay(new Date())
  const yesterday = shift(today, -1)
  const twoDaysAgo = shift(today, -2)
  let late: string

  const person = async (createdAt: Date) => {
    const id = newId()
    await db.user.create({ data: { id, email: `rollup-${id.slice(-12)}@example.com`, handle: `rollup${id.slice(-12)}`, displayName: 'Rollup Person', createdAt } })
    return id
  }
  const session = (userId: string, createdAt: Date) =>
    db.session.create({ data: { id: newId(), userId, familyId: newId(), refreshTokenHash: randomBytes(32), createdAt, expiresAt: new Date(Date.now() + 30 * DAY_MS) } })
  /** Every stored row, without when it was computed, in a stable order. */
  const stored = async () =>
    (await db.dailyMetric.findMany({ orderBy: [{ day: 'asc' }, { metric: 'asc' }, { dimension: 'asc' }] })).map((r) => ({ day: r.day.toISOString().slice(0, 10), metric: r.metric, dimension: r.dimension, value: r.value }))

  beforeAll(async () => {
    t = await createTestApp()
    db = t.app.get(PrismaService)
    maintenance = t.app.get(UsersMaintenance)
    for (let i = 0; i < 3; i++) await session(await person(at(twoDaysAgo, '10:00')), at(twoDaysAgo, '11:00'))
    late = await person(at(yesterday, '23:00'))
    await session(late, at(yesterday, '23:30'))
    // Today is never rolled up.
    await session(await person(new Date()), new Date())
  })

  afterAll(() => t.close())

  it('rolls up the days before today, never today, and writes the same rows when run again', async () => {
    const first = await maintenance.rollUpMetrics(3)
    expect(first).toMatchObject({ fromDay: shift(today, -3), toDay: yesterday, days: 3 })
    const rows = await stored()
    expect(rows.filter((r) => r.metric === '_rollup' && r.dimension === 'day').map((r) => r.day)).toEqual([shift(today, -3), twoDaysAgo, yesterday])
    expect(rows.some((r) => r.day >= today)).toBe(false)
    expect(rows).toEqual(
      expect.arrayContaining([
        { day: twoDaysAgo, metric: 'sign_ups', dimension: '', value: 3n },
        { day: twoDaysAgo, metric: 'sign_up_method', dimension: 'EMAIL', value: 3n },
        { day: twoDaysAgo, metric: 'active_users', dimension: '', value: 3n },
        { day: yesterday, metric: 'sign_ups', dimension: '', value: 1n },
        { day: yesterday, metric: 'active_users', dimension: '', value: 1n },
        { day: yesterday, metric: 'active_users_7d', dimension: '', value: 4n },
      ]),
    )
    // Zeros are not stored.
    expect(rows.find((r) => r.day === shift(today, -3) && r.metric === 'sign_ups')).toBeUndefined()

    const computed = (await db.dailyMetric.findFirstOrThrow({ where: { metric: '_rollup' } })).computedAt
    await maintenance.rollUpMetrics(3)
    expect(await stored()).toEqual(rows)
    expect((await db.dailyMetric.findFirstOrThrow({ where: { metric: '_rollup' } })).computedAt.getTime()).toBeGreaterThanOrEqual(computed.getTime())
  })

  it('drops what a recomputation no longer finds', async () => {
    await maintenance.rollUpMetrics(3)
    expect((await stored()).find((r) => r.day === yesterday && r.metric === 'sign_ups')?.value).toBe(1n)
    // The only sign-up of yesterday deletes the account: the day has no sign-up and nobody active any more.
    await db.user.update({ where: { id: late }, data: { deletedAt: new Date() } })
    await maintenance.rollUpMetrics(3)
    const rows = await stored()
    expect(rows.find((r) => r.day === yesterday && (r.metric === 'sign_ups' || r.metric === 'active_users'))).toBeUndefined()
    expect(rows.find((r) => r.day === yesterday && r.metric === '_rollup')).toMatchObject({ dimension: 'day', value: 1n })
    expect(rows.find((r) => r.day === twoDaysAgo && r.metric === 'sign_ups')?.value).toBe(3n)
  })

  it('backfills a range a month at a time, and refuses today, the future and days past retention', async () => {
    const pieces: string[] = []
    const report = await maintenance.backfillMetrics(shift(today, -45), yesterday, (chunk) => pieces.push(`${chunk.fromDay}..${chunk.toDay}`))
    expect(report).toMatchObject({ fromDay: shift(today, -45), toDay: yesterday, days: 45 })
    expect(pieces).toEqual([`${shift(today, -45)}..${shift(today, -15)}`, `${shift(today, -14)}..${yesterday}`])
    expect(await db.dailyMetric.count({ where: { metric: '_rollup', dimension: 'day' } })).toBe(45)
    // Every complete week whose Sunday is in the range has its cohorts.
    const weeks = await db.dailyMetric.findMany({ where: { metric: '_rollup', dimension: 'week' } })
    expect(weeks.length).toBeGreaterThanOrEqual(6)
    for (const w of weeks) expect(new Date(w.day).getUTCDay()).toBe(1)
    const before = await stored()
    await maintenance.backfillMetrics(shift(today, -45), yesterday)
    expect(await stored()).toEqual(before)

    for (const [from, to] of [
      [today, today],
      [yesterday, shift(today, 3)],
      [yesterday, twoDaysAgo],
      [shift(today, -800), yesterday],
      ['2026-02-30', yesterday],
    ] as const) {
      expect((await refusal(maintenance.backfillMetrics(from, to))).code).toBe(ErrorCode.VALIDATION)
    }
    for (const days of [0, 32, 1.5]) expect((await refusal(maintenance.rollUpMetrics(days))).code).toBe(ErrorCode.VALIDATION)
  })

  it('purges rows older than 730 days with the analytics purge', async () => {
    const old = shift(today, -731)
    const kept = shift(today, -729)
    await db.dailyMetric.createMany({
      data: [
        { day: dateOnly(old), metric: 'sign_ups', dimension: '', value: 5n },
        { day: dateOnly(kept), metric: 'sign_ups', dimension: '', value: 5n },
      ],
    })
    const purged = await maintenance.purgeAnalytics()
    expect(purged.metrics).toBe(1)
    expect(await db.dailyMetric.count({ where: { day: dateOnly(old) } })).toBe(0)
    expect(await db.dailyMetric.count({ where: { day: dateOnly(kept) } })).toBe(1)
  })
})

const RETENTION = `query ($weeks: Int, $cohortInterval: CohortInterval) { adminRetention(weeks: $weeks, cohortInterval: $cohortInterval) {
  cohortInterval timeZone firstWeek lastWeek generatedAt cohorts { start size returned } hiddenSmallGroups } }`
type Retention = { cohortInterval: string; timeZone: string; firstWeek: string; lastWeek: string; generatedAt: string; cohorts: { start: string; size: number; returned: number[] }[]; hiddenSmallGroups: number }

describe('adminRetention', () => {
  let t: TestApp
  let db: PrismaService
  let adminToken: string
  let studentToken: string
  const today = istDay(new Date())
  const current = mondayOf(today)
  const w1 = shift(current, -7)
  const w2 = shift(current, -14)
  const w3 = shift(current, -21)
  const w2People: string[] = []

  const person = async (createdAt: Date, data: { analyticsOptOut?: boolean; deletedAt?: Date } = {}) => {
    const id = newId()
    await db.user.create({ data: { id, email: `cohort-${id.slice(-12)}@example.com`, handle: `cohort${id.slice(-12)}`, displayName: 'Cohort Person', createdAt, ...data } })
    return id
  }
  const session = (userId: string, createdAt: Date) =>
    db.session.create({ data: { id: newId(), userId, familyId: newId(), refreshTokenHash: randomBytes(32), createdAt, expiresAt: new Date(Date.now() + 30 * DAY_MS) } })

  beforeAll(async () => {
    t = await createTestApp()
    db = t.app.get(PrismaService)
    // The admin and the student sign up this week: a cohort of 2, hidden.
    const admin = await seedUser(t.app, { globalRole: 'PLATFORM_ADMIN', verified: true })
    adminToken = tokenFor(t.config, admin.id, undefined, ['PLATFORM_ADMIN'])
    studentToken = tokenFor(t.config, (await seedUser(t.app)).id)

    // Two weeks ago: six people, all back in their sign-up week, three the week after, two this week (one learning,
    // one by a usage event). An opted-out and a deleted account sign up too and are in no cohort.
    for (let i = 0; i < 6; i++) {
      const id = await person(at(shift(w2, 1), '10:00'))
      await session(id, at(shift(w2, 1), '11:00'))
      if (i < 3) await session(id, at(shift(w1, 2)))
      w2People.push(id)
    }
    await db.learningDay.create({ data: { userId: w2People[0]!, day: dateOnly(today), learningSeconds: 60, events: 1 } })
    await db.usageEvent.create({ data: { id: newId(), occurredAt: new Date(), userId: w2People[1]!, name: 'page_view', platform: 'WEB' } })
    for (const data of [{ analyticsOptOut: true }, { deletedAt: new Date() }]) {
      const id = await person(at(shift(w2, 1), '10:00'), data)
      await session(id, at(shift(w2, 1), '11:00'))
      await session(id, at(shift(w1, 2)))
    }
    // Last week: three people, hidden.
    for (let i = 0; i < 3; i++) await session(await person(at(shift(w1, 2), '10:00')), at(shift(w1, 2), '11:00'))
    // Three weeks ago nobody signed up.
  })

  afterAll(() => t.close())

  it("gives each sign-up week's share active in each week since, and hides cohorts under 5 people", async () => {
    const res = await t.gql<{ adminRetention: Retention }>(RETENTION, { weeks: 4 }, adminToken)
    expect(res.errors).toBeUndefined()
    expect(res.data!.adminRetention).toMatchObject({
      cohortInterval: 'WEEK',
      timeZone: 'Asia/Kolkata',
      firstWeek: w3,
      lastWeek: current,
      cohorts: [{ start: w2, size: 6, returned: [1, 0.5, 0.333] }],
      // Last week's three and this week's two; nobody signed up three weeks ago, which is not a group.
      hiddenSmallGroups: 2,
    })
    const fallback = (await t.gql<{ adminRetention: Retention }>(RETENTION, {}, adminToken)).data!.adminRetention
    expect(fallback.firstWeek).toBe(shift(current, -77))
    expect(fallback.cohorts).toEqual([{ start: w2, size: 6, returned: [1, 0.5, 0.333] }])
  })

  it('reads complete weeks from the rollup and counts this week live', async () => {
    const live = (await t.gql<{ adminRetention: Retention }>(RETENTION, { weeks: 4 }, adminToken)).data!.adminRetention
    await t.app.get(UsersMaintenance).backfillMetrics(w3, shift(today, -1))
    for (const week of [w3, w2, w1]) expect(await db.dailyMetric.count({ where: { day: dateOnly(week), metric: '_rollup', dimension: 'week' } })).toBe(1)
    expect(await db.dailyMetric.count({ where: { day: dateOnly(current), metric: '_rollup', dimension: 'week' } })).toBe(0)

    // A second API on the same database: nothing cached.
    const rolled = await createTestApp({}, { resetDatabase: false })
    try {
      const fromRollup = (await rolled.gql<{ adminRetention: Retention }>(RETENTION, { weeks: 4 }, adminToken)).data!.adminRetention
      expect({ ...fromRollup, generatedAt: null }).toEqual({ ...live, generatedAt: null })

      // Late activity in a stored week does not show; this week's does.
      await session(w2People[4]!, at(shift(w1, 3)))
      await session(w2People[5]!, new Date())
      const after = (await rolled.gql<{ adminRetention: Retention }>(RETENTION, { weeks: 3 }, adminToken)).data!.adminRetention
      expect(after.cohorts).toEqual([{ start: w2, size: 6, returned: [1, 0.5, 0.5] }])
    } finally {
      await rolled.close()
    }
  })

  it('takes 1 to 52 weekly cohorts and is platform-admin only', async () => {
    for (const weeks of [0, 53]) expect((await t.gql(RETENTION, { weeks }, adminToken)).errors?.[0]?.extensions).toMatchObject({ code: 'VALIDATION', field: ['weeks'] })
    expect((await t.gql(RETENTION, { cohortInterval: 'MONTH' }, adminToken)).errors).toBeDefined()
    expect((await t.gql(RETENTION, {})).errors?.[0]?.extensions.code).toBe('UNAUTHENTICATED')
    expect((await t.gql(RETENTION, {}, studentToken)).errors?.[0]?.extensions.code).toBe('FORBIDDEN')
  })
})
