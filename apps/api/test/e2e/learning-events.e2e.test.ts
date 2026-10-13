import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { CoreExport, LearningEventsService } from '@lvn-backend/core'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { createTestApp, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'

/**
 * Learning events through the API (§14.1, ADR-0067): `trackEvents` stores each event once however often a batch is
 * sent, refuses bad events one by one, believes the device's clock only so far, and adds each event to its day in the
 * person's time zone; the server records what it knows (notes created, published and forked, class quizzes); events
 * are exported and erased with the account; the nightly job keeps the monthly partitions.
 */
describe('learning events', () => {
  let app: TestApp
  let db: PrismaService
  let me: { id: string; token: string }
  const TRACK = 'mutation ($input: TrackEventsInput!) { trackEvents(input: $input) { accepted duplicates rejected { index message } userErrors { message code } } }'
  type Tracked = { trackEvents: { accepted: number; duplicates: number; rejected: { index: number; message: string }[]; userErrors: { message: string; code: string }[] } }
  const track = async (token: string, events: object[], timeZone?: string) => (await app.gql<Tracked>(TRACK, { input: { events, timeZone } }, token)).data!.trackEvents
  const event = (over: Record<string, unknown> = {}) => ({ id: randomUUID(), type: 'TIME_SPENT', durationMs: 60_000, metadata: { activity: 'READING' }, clientTs: new Date().toISOString(), platform: 'WEB', ...over })
  const stored = (userId: string) => db.$queryRaw<{ id: string; type: string; clientTs: Date; source: string; entityId: string | null; metadata: Record<string, unknown> }[]>`
    SELECT "id", "type", "clientTs", "source", "entityId", "metadata" FROM "learning"."LearningEvent" WHERE "userId" = ${userId}::uuid ORDER BY "serverTs", "clientTs"`
  /** Domain events are handled after the request answers: wait for what they write. */
  const eventually = async <T>(read: () => Promise<T>, check: (v: T) => boolean, ms = 5_000): Promise<T> => {
    const until = Date.now() + ms
    for (;;) {
      const value = await read()
      if (check(value) || Date.now() > until) return value
      await new Promise((r) => setTimeout(r, 100))
    }
  }
  const person = async () => {
    const u = await seedUser(app.app, { verified: true, handle: `learner${Date.now()}${Math.floor(Math.random() * 1e6)}` })
    return { id: u.id, token: tokenFor(app.config, u.id) }
  }

  beforeAll(async () => {
    app = await createTestApp()
    db = app.app.get(PrismaService)
    me = await person()
  })

  afterAll(async () => {
    await app?.close()
  })

  it('needs a signed-in person', async () => {
    expect((await app.gql(TRACK, { input: { events: [event()] } })).errors?.[0]?.extensions.code).toBe('UNAUTHENTICATED')
  })

  it('stores each event once, however often its batch is sent', async () => {
    const batch = [event(), event({ type: 'NOTE_OPENED', durationMs: null, metadata: null, entityType: 'NOTE', entityId: newId() })]
    expect(await track(me.token, batch)).toMatchObject({ accepted: 2, duplicates: 0, rejected: [] })
    // The answer was lost and the app sends the same batch again, with one new event, which it also repeats.
    const extra = event()
    expect(await track(me.token, [...batch, extra, extra])).toMatchObject({ accepted: 1, duplicates: 3 })
    expect(await stored(me.id)).toHaveLength(3)
  })

  it('refuses bad events one by one and keeps the rest; a batch past 100 is refused whole', async () => {
    const res = await track(me.token, [
      event(),
      event({ type: 'NOTE_CREATED' }),
      event({ metadata: { blob: 'x'.repeat(3_000) } }),
      event({ topicKeys: ['not a topic'] }),
      event({ durationMs: 5 * 3_600_000 }),
    ])
    expect(res.accepted).toBe(1)
    expect(res.rejected.map((r) => r.index)).toEqual([1, 2, 3, 4])
    expect(res.rejected[0]!.message).toMatch(/recorded by the server/)
    const tooMany = await track(me.token, Array.from({ length: 101 }, () => event()))
    expect(tooMany.userErrors[0]).toMatchObject({ code: 'VALIDATION' })
  })

  it('believes the device clock back at most 30 days, and never into the future', async () => {
    const someone = await person()
    const old = event({ clientTs: new Date(Date.now() - 90 * 86_400_000).toISOString() })
    const future = event({ clientTs: new Date(Date.now() + 86_400_000).toISOString() })
    await track(someone.token, [old, future])
    const rows = await stored(someone.id)
    const byId = new Map(rows.map((r) => [r.id, r.clientTs.getTime()]))
    expect(Date.now() - byId.get(old.id)!).toBeGreaterThan(29.9 * 86_400_000)
    expect(Date.now() - byId.get(old.id)!).toBeLessThan(30.1 * 86_400_000)
    expect(byId.get(future.id)!).toBeLessThanOrEqual(Date.now())
  })

  it('adds each event to its day in the person’s time zone, rolling over at 04:00', async () => {
    const someone = await person()
    // Two days ago at 21:00 UTC: 02:30 the next morning in Kolkata, so the learning day is two days ago's date there.
    const base = new Date(Date.now() - 2 * 86_400_000)
    const at = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), 21, 0))
    const day = at.toISOString().slice(0, 10)
    const topic = 'core:dsa-basics/arrays'
    await track(someone.token, [
      event({ clientTs: at.toISOString(), durationMs: 600_000, metadata: { activity: 'FOCUS' }, topicKeys: [topic] }),
      event({ clientTs: at.toISOString(), durationMs: 300_000, metadata: { activity: 'READING' }, topicKeys: [topic] }),
      event({ clientTs: at.toISOString(), type: 'FLASHCARD_REVIEWED', durationMs: 6_000, metadata: null }),
      event({ clientTs: at.toISOString(), type: 'QUIZ_COMPLETED', durationMs: 60_000, metadata: { answered: 5 } }),
    ], 'Asia/Kolkata')
    expect(await db.learnerSettings.findUnique({ where: { userId: someone.id } })).toMatchObject({ timeZone: 'Asia/Kolkata' })
    const days = await db.learningDay.findMany({ where: { userId: someone.id } })
    expect(days.map((d) => d.day.toISOString().slice(0, 10))).toEqual([day])
    expect(days[0]).toMatchObject({ learningSeconds: 600 + 6 + 60, readingSeconds: 300, reviews: 1, quizAnswers: 5, events: 4 })
    expect(await db.learningDayTopic.findMany({ where: { userId: someone.id } })).toEqual([expect.objectContaining({ topicKey: topic, seconds: 900, events: 2 })])
    // An unknown time zone is ignored; the person's stays.
    await track(someone.token, [event()], 'Mars/Olympus_Mons')
    expect((await db.learnerSettings.findUnique({ where: { userId: someone.id } }))!.timeZone).toBe('Asia/Kolkata')
  })

  it('records what the server knows: a note created, published, and forked by someone else', async () => {
    const author = await person()
    const reader = await person()
    const created = await app.gql<{ createNote: { note: { id: string } } }>('mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } } }', { input: { title: 'Heaps', cards: [{ id: newId(), type: 'text', position: 'a0', content: { doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A heap.' }] }] } } }] } }, author.token)
    const noteId = created.data!.createNote.note.id
    await app.gql('mutation ($input: NoteIdInput!) { publishNote(input: $input) { note { id } } }', { input: { noteId } }, author.token)
    await app.gql('mutation ($input: ChangeNoteVisibilityInput!) { changeNoteVisibility(input: $input) { note { id } } }', { input: { noteId, visibility: 'PUBLIC' } }, author.token)
    await app.gql('mutation ($input: NoteIdInput!) { publishNote(input: $input) { note { id } } }', { input: { noteId } }, author.token)
    const fork = await app.gql<{ forkNote: { note: { id: string } | null; userErrors: { message: string }[] } }>('mutation ($input: NoteIdInput!) { forkNote(input: $input) { note { id } userErrors { message } } }', { input: { noteId } }, reader.token)
    const forkId = fork.data!.forkNote.note!.id
    const authors = await eventually(async () => (await stored(author.id)).map((e) => [e.type, e.source, e.entityId]), (v) => v.length >= 3)
    expect(authors).toEqual(expect.arrayContaining([['NOTE_CREATED', 'SERVER', noteId], ['NOTE_PUBLISHED', 'SERVER', noteId]]))
    const readers = await eventually(async () => (await stored(reader.id)).map((e) => [e.type, e.entityId]), (v) => v.some(([t]) => t === 'NOTE_FORKED'))
    expect(readers).toEqual(expect.arrayContaining([['NOTE_FORKED', forkId]]))
  })

  it('goes into the data export, and goes with the account', async () => {
    const files = await app.app.get(CoreExport).exportFor(me.id)
    const events = JSON.parse(new TextDecoder().decode(files.files.find((f) => f.path === 'data/learning/events.json')!.bytes)) as unknown[]
    expect(events).toHaveLength(4)
    expect(files.files.map((f) => f.path)).toContain('data/learning/days.json')
    await app.app.get(LearningEventsService).erase(me.id)
    expect(await stored(me.id)).toEqual([])
    expect(await db.learningDay.count({ where: { userId: me.id } })).toBe(0)
  })

  it('sends PostHog a pseudonymous copy when it is configured, and nothing otherwise', async () => {
    const received: { api_key: string; batch: { event: string; distinct_id: string; properties: Record<string, unknown> }[] }[] = []
    const posthog = createServer((req, res) => {
      let body = ''
      req.on('data', (c: Buffer) => (body += c.toString()))
      req.on('end', () => {
        received.push(JSON.parse(body) as (typeof received)[number])
        res.writeHead(200, { 'content-type': 'application/json' }).end('{"status":1}')
      })
    })
    await new Promise<void>((r) => posthog.listen(0, '127.0.0.1', r))
    const analytics = await createTestApp({ POSTHOG_HOST: `http://127.0.0.1:${(posthog.address() as AddressInfo).port}`, POSTHOG_API_KEY: 'phc_test' }, { resetDatabase: false })
    try {
      const someone = await person()
      await track(someone.token, [event({ entityType: 'NOTE', entityId: newId(), metadata: { activity: 'FOCUS', secret: 'my private words' } })])
      const ids = (await stored(someone.id)).map((e) => e.id)
      // Off in the app without PostHog; on in the one with it.
      expect(await app.app.get(LearningEventsService).copyToAnalytics(someone.id, ids)).toBe(0)
      expect(await analytics.app.get(LearningEventsService).copyToAnalytics(someone.id, ids)).toBe(1)
      const [sent] = received
      expect(sent!.api_key).toBe('phc_test')
      expect(sent!.batch[0]).toMatchObject({ event: 'TIME_SPENT', properties: { platform: 'WEB', entityType: 'NOTE', durationMs: 60_000 } })
      expect(sent!.batch[0]!.distinct_id).toMatch(/^[0-9a-f]{32}$/)
      expect(JSON.stringify(sent)).not.toContain(someone.id)
      expect(JSON.stringify(sent)).not.toContain('private words')
    } finally {
      await analytics.close()
      posthog.close()
    }
  })

  it('keeps the monthly partitions: three months ahead, none past 24 months', async () => {
    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "learning"."LearningEvent_2023_01" PARTITION OF "learning"."LearningEvent" FOR VALUES FROM ('2023-01-01 00:00:00+00') TO ('2023-02-01 00:00:00+00')`)
    const done = await app.app.get(LearningEventsService).maintain()
    expect(done.dropped).toContain('LearningEvent_2023_01')
    const names = (await db.$queryRaw<{ name: string }[]>`
      SELECT c.relname AS "name" FROM pg_inherits i JOIN pg_class c ON c.oid = i.inhrelid WHERE i.inhparent = '"learning"."LearningEvent"'::regclass`).map((r) => r.name)
    const ahead = new Date()
    ahead.setUTCMonth(ahead.getUTCMonth() + 3, 1)
    expect(names).toContain(`LearningEvent_${ahead.getUTCFullYear()}_${String(ahead.getUTCMonth() + 1).padStart(2, '0')}`)
    expect(names).not.toContain('LearningEvent_2023_01')
    // Nothing lands in the default partition while partitions are made ahead.
    expect(await db.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS "n" FROM "learning"."LearningEvent_default"`)).toEqual([{ n: 0n }])
  })
})
