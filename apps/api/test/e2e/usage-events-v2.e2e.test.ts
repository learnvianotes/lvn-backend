import { PrismaService } from '@lvn-backend/prisma-base'
import { UsersMaintenance } from '@lvn-backend/users'
import { createTestApp, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'

/**
 * First-party usage events v2 (ADR-0107): feature_use, search_no_results and quiz_start, a checked appVersion, and the
 * admin queries adminFeatureUsage, adminSearchQuality and adminVersionAdoption. Counts only; a group with fewer than 5
 * distinct people is hidden and counted. Past days are read from the nightly rollup (ADR-0106). Days are IST.
 */

const IST_MS = 330 * 60_000
const DAY_MS = 86_400_000
const istDay = (at: Date) => new Date(at.getTime() + IST_MS).toISOString().slice(0, 10)
const shift = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10)
const at = (day: string, hhmm = '12:00') => new Date(`${day}T${hhmm}:00+05:30`)
const dateOnly = (day: string) => new Date(`${day}T00:00:00Z`)

const INGEST = `mutation ($input: IngestAnalyticsInput!) { ingestAnalytics(input: $input) { ok userErrors { code message field } } }`
const RANGE = 'range { firstDay lastDay timeZone }'
const FEATURES = `query ($from: DateTime, $to: DateTime) { adminFeatureUsage(from: $from, to: $to) {
  ${RANGE} events features { feature users events } hiddenSmallGroups quizStarts { starts byKind { kind users starts } hiddenSmallGroups } } }`
const SEARCH = `query ($from: DateTime, $to: DateTime) { adminSearchQuality(from: $from, to: $to) {
  ${RANGE} searches zeroResults zeroResultRate byScope { scope users searches zeroResults zeroResultRate } hiddenSmallGroups } }`
const VERSIONS = `query ($from: DateTime, $to: DateTime) { adminVersionAdoption(from: $from, to: $to) {
  ${RANGE} platforms { platform users events versions { appVersion users events share } } hiddenSmallGroups } }`

type Event = { name: string; platform: 'WEB' | 'MOBILE'; props?: Record<string, unknown>; appVersion?: string; occurredAt?: string }
type Ingest = { ingestAnalytics: { ok: boolean; userErrors: { code: string; message: string; field: string[] | null }[] } }

describe('usage events v2 (ADR-0107)', () => {
  let t: TestApp
  let db: PrismaService
  let adminToken: string
  let studentToken: string
  const today = istDay(new Date())
  const D = shift(today, -2)
  const when = at(D, '15:00').toISOString()
  const window = { from: at(shift(today, -9), '00:00').toISOString(), to: new Date().toISOString() }

  const person = async () => {
    const user = await seedUser(t.app)
    return { id: user.id, token: tokenFor(t.config, user.id) }
  }
  const send = (token: string, events: Event[]) => t.gql<Ingest>(INGEST, { input: { events: events.map((e) => ({ occurredAt: when, ...e })) } }, token)
  const ok = async (token: string, events: Event[]) => {
    const res = await send(token, events)
    expect(res.errors).toBeUndefined()
    expect(res.data!.ingestAnalytics).toEqual({ ok: true, userErrors: [] })
  }
  const web = (name: string, props?: Record<string, unknown>, appVersion = '1.4.0'): Event => ({ name, platform: 'WEB', props, appVersion })

  beforeAll(async () => {
    t = await createTestApp()
    db = t.app.get(PrismaService)
    const admin = await seedUser(t.app, { globalRole: 'PLATFORM_ADMIN', verified: true })
    adminToken = tokenFor(t.config, admin.id, undefined, ['PLATFORM_ADMIN'])
    studentToken = tokenFor(t.config, (await seedUser(t.app)).id)

    // Six web people on 1.4.0 use the PDF viewer; five of them start a shared quiz and search notes twice, and four
    // of those find nothing once.
    for (let i = 0; i < 6; i++) {
      const p = await person()
      const events = [web('feature_use', { feature: 'pdf_viewer' })]
      if (i < 5) events.push(web('quiz_start', { kind: 'shared' }), web('search', { scope: 'notes', wordCount: 3 }), web('search', { scope: 'notes', wordCount: 1 }))
      if (i < 4) events.push(web('search_no_results', { scope: 'notes', wordCount: 3 }))
      await ok(p.token, events)
    }
    // Three web people on 1.3.0 review flashcards (a small group); one also starts a class quiz and searches people.
    for (let i = 0; i < 3; i++) {
      const p = await person()
      const events = [web('feature_use', { feature: 'flashcards_review' }, 'v1.3.0')]
      if (i === 0) events.push(web('quiz_start', { kind: 'class' }, 'v1.3.0'), web('search', { scope: 'people', wordCount: 2 }, 'v1.3.0'))
      await ok(p.token, events)
    }
    // Two mobile people (a small platform) use the PDF viewer; one starts a class quiz.
    for (let i = 0; i < 2; i++) {
      const p = await person()
      const events: Event[] = [{ name: 'feature_use', platform: 'MOBILE', props: { feature: 'pdf_viewer' }, appVersion: '2.0.0+41' }]
      if (i === 0) events.push({ name: 'quiz_start', platform: 'MOBILE', props: { kind: 'class' }, appVersion: '2.0.0+41' })
      await ok(p.token, events)
    }
    // Opted out: accepted, nothing stored, nothing counted.
    const out = await person()
    await db.user.update({ where: { id: out.id }, data: { analyticsOptOut: true } })
    await ok(out.token, [web('feature_use', { feature: 'pdf_viewer' }), web('quiz_start', { kind: 'shared' })])
    expect(await db.usageEvent.count({ where: { userId: out.id } })).toBe(0)
  })

  afterAll(() => t.close())

  const expectedFeatures = {
    events: 11,
    features: [{ feature: 'PDF_VIEWER', users: 8, events: 8 }],
    hiddenSmallGroups: 1,
    quizStarts: { starts: 7, byKind: [{ kind: 'SHARED', users: 5, starts: 5 }], hiddenSmallGroups: 1 },
  }
  const expectedSearch = {
    searches: 11,
    zeroResults: 4,
    zeroResultRate: 0.364,
    byScope: [{ scope: 'NOTES', users: 5, searches: 10, zeroResults: 4, zeroResultRate: 0.4 }],
    hiddenSmallGroups: 1,
  }
  const expectedVersions = {
    // MOBILE has 2 people: hidden with its one version. WEB 1.3.0 has 3 people: hidden.
    platforms: [{ platform: 'WEB', users: 9, events: 30, versions: [{ appVersion: '1.4.0', users: 6, events: 25, share: 0.667 }] }],
    hiddenSmallGroups: 3,
  }

  it('counts feature use, quiz starts, search quality and app versions, hiding groups under 5 people', async () => {
    const features = await t.gql<{ adminFeatureUsage: typeof expectedFeatures & { range: { timeZone: string } } }>(FEATURES, window, adminToken)
    expect(features.errors).toBeUndefined()
    expect(features.data!.adminFeatureUsage).toMatchObject(expectedFeatures)
    expect(features.data!.adminFeatureUsage.range.timeZone).toBe('Asia/Kolkata')

    const search = await t.gql<{ adminSearchQuality: typeof expectedSearch }>(SEARCH, window, adminToken)
    expect(search.errors).toBeUndefined()
    expect(search.data!.adminSearchQuality).toMatchObject(expectedSearch)

    const versions = await t.gql<{ adminVersionAdoption: typeof expectedVersions }>(VERSIONS, window, adminToken)
    expect(versions.errors).toBeUndefined()
    expect(versions.data!.adminVersionAdoption).toMatchObject(expectedVersions)
  })

  it('is platform-admin only', async () => {
    for (const query of [FEATURES, SEARCH, VERSIONS]) {
      expect((await t.gql(query, window)).errors?.[0]?.extensions.code).toBe('UNAUTHENTICATED')
      expect((await t.gql(query, window, studentToken)).errors?.[0]?.extensions.code).toBe('FORBIDDEN')
    }
  })

  it('rolls the new metrics up nightly and reads past days from the rollup', async () => {
    await t.app.get(UsersMaintenance).rollUpMetrics(3)
    const rows = await db.dailyMetric.findMany({ where: { day: dateOnly(D) } })
    const value = (metric: string, dimension: string) => rows.find((r) => r.metric === metric && r.dimension === dimension)?.value
    expect(value('_rollup', 'day:usage')).toBe(1n)
    expect(value('feature_use_users', 'pdf_viewer')).toBe(8n)
    expect(value('feature_use_events', 'flashcards_review')).toBe(3n)
    expect(value('quiz_starts', 'shared')).toBe(5n)
    expect(value('searches', 'notes')).toBe(10n)
    expect(value('searches_no_results', 'notes')).toBe(4n)
    expect(value('app_version_users', 'WEB|1.4.0')).toBe(6n)
    expect(value('platform_users', 'MOBILE')).toBe(2n)
    // Counts only: no account id, email or free text in any row.
    for (const row of rows) {
      expect(row.dimension).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/)
      expect(row.dimension).not.toContain('@')
    }

    // A fresh API process (nothing cached) gives the same numbers from the rollup as from the events.
    const rolled = await createTestApp({}, { resetDatabase: false })
    try {
      const read = async <T,>(query: string, name: string) => {
        const res = await rolled.gql<Record<string, T>>(query, window, adminToken)
        expect(res.errors).toBeUndefined()
        return res.data![name]
      }
      expect(await read(FEATURES, 'adminFeatureUsage')).toMatchObject(expectedFeatures)
      expect(await read(SEARCH, 'adminSearchQuality')).toMatchObject(expectedSearch)
      expect(await read(VERSIONS, 'adminVersionAdoption')).toMatchObject(expectedVersions)
    } finally {
      await rolled.close()
    }

    // Past days' events come from the rollup: a stored count changed by hand shows.
    await db.dailyMetric.update({ where: { day_metric_dimension: { day: dateOnly(D), metric: 'feature_use_events', dimension: 'pdf_viewer' } }, data: { value: 108n } })
    const tampered = await createTestApp({}, { resetDatabase: false })
    try {
      const res = await tampered.gql<{ adminFeatureUsage: typeof expectedFeatures }>(FEATURES, window, adminToken)
      expect(res.data!.adminFeatureUsage.features[0]).toEqual({ feature: 'PDF_VIEWER', users: 8, events: 108 })
    } finally {
      await tampered.close()
    }
  })

  it('refuses unknown events and values, and stores no free text, ids or bad versions', async () => {
    const p = await person()
    const refused = async (events: Event[], path?: string) => {
      const res = await send(p.token, events)
      expect(res.errors).toBeUndefined()
      const error = res.data!.ingestAnalytics.userErrors[0]!
      expect(error.code).toBe('VALIDATION')
      if (path) expect(error.field?.join('.')).toBe(path)
    }
    await refused([web('click')])
    await refused([web('page_view'), web('feature_use', { feature: 'secret_lab' })], 'input.events.1.props.feature')
    await refused([web('feature_use')], 'input.events.0.props.feature')
    await refused([web('quiz_start', { kind: 'exam' })], 'input.events.0.props.kind')
    await refused([web('search_no_results', { scope: 'notes' })], 'input.events.0.props.wordCount')
    await refused([web('search_no_results', { scope: 'everything', wordCount: 2 })], 'input.events.0.props.scope')
    await refused([web('page_view', { blob: 'x'.repeat(1100) })], 'input.events.0.props')
    await refused([web('page_view', Object.fromEntries(Array.from({ length: 17 }, (_, i) => [`k${i}`, i])))], 'input.events.0.props')
    // A refused batch stores nothing, not even its good events.
    expect(await db.usageEvent.count({ where: { userId: p.id } })).toBe(0)

    await ok(p.token, [
      web('search_no_results', { scope: 'notes', wordCount: 57, query: 'organic chemistry notes', text: 'x' }),
      web('feature_use', { feature: 'notes_editor', extra: 'hello world', noteId: '1f0e9c2a-77aa-4d5e-9c1b-0a1b2c3d4e5f' }),
      web('quiz_start', { kind: 'note', title: 'My quiz' }),
      web('search', { words: 4, q: 'ada lovelace' }),
      web('page_view', { route: 'notes', email: 'ada@college.edu', comment: 'free text here', ref: '9f8e7d6c5b4a', count: 3, dark: true }),
      { name: 'page_view', platform: 'WEB', appVersion: 'v1.5.0-beta.2' },
      { name: 'page_view', platform: 'WEB', appVersion: 'build from my laptop' },
      { name: 'page_view', platform: 'MOBILE', appVersion: '1.2.3.4.5.6' },
    ])
    const stored = await db.usageEvent.findMany({ where: { userId: p.id }, orderBy: { id: 'asc' } })
    const byName = (name: string) => stored.filter((e) => e.name === name)
    expect(byName('search_no_results')[0]!.props).toEqual({ scope: 'notes', wordCount: 20 })
    expect(byName('feature_use')[0]!.props).toEqual({ feature: 'notes_editor' })
    expect(byName('quiz_start')[0]!.props).toEqual({ kind: 'note' })
    expect(byName('search')[0]!.props).toEqual({ wordCount: 4 })
    expect(byName('page_view').map((e) => e.props)).toContainEqual({ route: 'notes', count: 3, dark: true })
    expect(stored.map((e) => e.appVersion).sort()).toEqual(['1.4.0', '1.4.0', '1.4.0', '1.4.0', '1.4.0', '1.5.0-beta.2', null, null])
    const all = JSON.stringify(stored.map((e) => e.props))
    for (const text of ['organic', 'hello', 'ada', 'free text', 'My quiz', '1f0e9c2a', '9f8e7d6c']) expect(all).not.toContain(text)
  })
})
