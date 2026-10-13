import { randomUUID } from 'node:crypto'
import { LearningHistoryService } from '@lvn-backend/core'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { createTestApp, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'

/**
 * Learning history (§14.2, ADR-0067) and /core progress from learning events (ADR-0023): days newest first in the
 * person's time zone, with learning and reading time, what counts for Rhythm, topics named as the viewer may see them,
 * and the notes opened that they can still read; /core topics' time, a topic finished and a problem marked; the old
 * site's study days set once however often a claim is imported, and gone when it is declined.
 */
describe('learning history', () => {
  let app: TestApp
  let db: PrismaService
  const HISTORY = `query ($before: String, $days: Int) { learningHistory(before: $before, days: $days) { timeZone nextBefore days { day learningSeconds readingSeconds reviews counted topics { key seconds topic { id title } } notes { id title } } } }`
  type Day = { day: string; learningSeconds: number; readingSeconds: number; reviews: number; counted: boolean; topics: { key: string; seconds: number; topic: { id: string; title: string } | null }[]; notes: ({ id: string; title: string } | null)[] }
  type History = { learningHistory: { timeZone: string; nextBefore: string | null; days: Day[] } }
  const person = async () => {
    const u = await seedUser(app.app, { verified: true, handle: `h${Date.now()}${Math.floor(Math.random() * 1e6)}` })
    return { id: u.id, token: tokenFor(app.config, u.id) }
  }
  const track = (token: string, events: object[], timeZone = 'Asia/Kolkata') =>
    app.gql('mutation ($input: TrackEventsInput!) { trackEvents(input: $input) { accepted rejected { index message } } }', { input: { events, timeZone } }, token)
  const at = (daysAgo: number, utcHour: number) => {
    const d = new Date(Date.now() - daysAgo * 86_400_000)
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), utcHour)).toISOString()
  }
  const event = (over: Record<string, unknown>) => ({ id: randomUUID(), type: 'TIME_SPENT', clientTs: at(1, 8), platform: 'WEB', ...over })
  const note = async (token: string, title: string) =>
    (await app.gql<{ createNote: { note: { id: string } } }>('mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } } }', { input: { title, cards: [{ id: newId(), type: 'text', position: 'a0', content: { doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: title }] }] } } }] } }, token)).data!.createNote.note.id
  /** Domain events are handled after the request answers: wait for what they write. */
  const eventually = async <T>(read: () => Promise<T>, check: (v: T) => boolean, ms = 5_000): Promise<T> => {
    const until = Date.now() + ms
    for (;;) {
      const value = await read()
      if (check(value) || Date.now() > until) return value
      await new Promise((r) => setTimeout(r, 100))
    }
  }

  beforeAll(async () => {
    app = await createTestApp()
    db = app.app.get(PrismaService)
  })

  afterAll(async () => {
    await app?.close()
  })

  it('shows days newest first with learning and reading time, Rhythm days, named topics and notes still readable', async () => {
    const me = await person()
    const other = await person()
    const topic = (await db.topic.findFirst({ where: { origin: 'CURATED' } }))!
    const mine = await note(me.token, 'My heaps')
    const theirs = await note(other.token, 'Their private plans')
    await track(me.token, [
      event({ durationMs: 11 * 60_000, metadata: { activity: 'FOCUS' }, topicKeys: [`topic:${topic.id}`] }),
      event({ durationMs: 5 * 60_000, metadata: { activity: 'READING' }, topicKeys: ['core:dsa-basics/arrays'] }),
      event({ type: 'NOTE_OPENED', entityType: 'NOTE', entityId: mine, clientTs: at(1, 9) }),
      // A note they could read once, private now: it is not shown.
      event({ type: 'NOTE_OPENED', entityType: 'NOTE', entityId: theirs, clientTs: at(1, 8) }),
      event({ clientTs: at(3, 8), type: 'FLASHCARD_REVIEWED', durationMs: 5_000 }),
    ])
    const res = await app.gql<History>(HISTORY, {}, me.token)
    const { timeZone, days: all } = res.data!.learningHistory
    expect(timeZone).toBe('Asia/Kolkata')
    // Today has the notes made above (NOTE_CREATED, recorded by the server): a day with something in it, no time.
    const today = new Date(Date.now() + 1.5 * 3_600_000).toISOString().slice(0, 10) // Kolkata is +05:30, the day starts at 04:00
    expect(all.map((d) => d.day)).toEqual([today, at(1, 8).slice(0, 10), at(3, 8).slice(0, 10)])
    expect(all[0]).toMatchObject({ learningSeconds: 0, readingSeconds: 0, counted: false })
    const days = all.slice(1)
    expect(days[0]).toMatchObject({ learningSeconds: 660, readingSeconds: 300, counted: true })
    expect(days[0]!.topics).toEqual([
      { key: `topic:${topic.id}`, seconds: 660, topic: { id: topic.id, title: topic.title } },
      { key: 'core:dsa-basics/arrays', seconds: 300, topic: null },
    ])
    expect(days[0]!.notes).toEqual([{ id: mine, title: 'My heaps' }, null])
    expect(days[1]).toMatchObject({ reviews: 1, counted: false })
    // A page at a time.
    const first = (await app.gql<History>(HISTORY, { days: 2 }, me.token)).data!.learningHistory
    expect(first.days).toHaveLength(2)
    const next = (await app.gql<History>(HISTORY, { days: 2, before: first.nextBefore }, me.token)).data!.learningHistory
    expect(next.days.map((d) => d.day)).toEqual([at(3, 8).slice(0, 10)])
    expect(next.nextBefore).toBeNull()
  })

  it('keeps /core progress from /core events: time, a topic finished, a problem marked and cleared', async () => {
    const me = await person()
    const progress = () => app.gql<{ coreProgress: { topics: { topicKey: string; completed: boolean; secondsStudied: number }[]; problems: { problemId: string; mark: string }[] } }>('{ coreProgress(subjectId: "dsa-basics") { topics { topicKey completed secondsStudied } problems { problemId mark } } }', {}, me.token)
    await track(me.token, [
      event({ type: 'TOPIC_VIEWED', entityType: 'CORE_TOPIC', entityId: 'dsa-basics/arrays', topicKeys: ['core:dsa-basics/arrays'] }),
      event({ durationMs: 120_000, metadata: { activity: 'READING' }, topicKeys: ['core:dsa-basics/arrays'] }),
      event({ type: 'TOPIC_COMPLETED', entityType: 'CORE_TOPIC', entityId: 'dsa-basics/arrays', topicKeys: ['core:dsa-basics/arrays'], metadata: { done: true } }),
      event({ type: 'PROBLEM_MARKED', entityType: 'CORE_PROBLEM', entityId: 'two-sum', metadata: { subjectId: 'dsa-basics', mark: 'SOLVED' } }),
    ])
    const done = await eventually(async () => (await progress()).data!.coreProgress, (p) => p.topics.length > 0 && p.problems.length > 0)
    expect(done.topics).toEqual([{ topicKey: 'dsa-basics/arrays', completed: true, secondsStudied: 120 }])
    expect(done.problems).toEqual([{ problemId: 'two-sum', mark: 'SOLVED' }])
    await track(me.token, [event({ type: 'PROBLEM_MARKED', entityType: 'CORE_PROBLEM', entityId: 'two-sum', metadata: { subjectId: 'dsa-basics', mark: 'NONE' } })])
    expect((await eventually(async () => (await progress()).data!.coreProgress, (p) => p.problems.length === 0)).problems).toEqual([])
  })

  it('sets the old site’s study days once, however often a claim is imported, and clears them when declined', async () => {
    const me = await person()
    const history = app.app.get(LearningHistoryService)
    const days = { '2026-03-02': { topics: { 'dsa-basics/arrays': { sec: 600 } }, focus: 900 } }
    await history.importLegacyDays(me.id, days)
    await history.importLegacyDays(me.id, days)
    await track(me.token, [event({ clientTs: at(1, 8), durationMs: 60_000, metadata: { activity: 'FOCUS' } })])
    const shown = (await app.gql<History>(HISTORY, {}, me.token)).data!.learningHistory.days
    expect(shown.find((d) => d.day === '2026-03-02')).toMatchObject({ learningSeconds: 900, readingSeconds: 600, counted: true, topics: [{ key: 'core:dsa-basics/arrays', seconds: 600 }] })
    await history.removeLegacyDays(me.id)
    const after = (await app.gql<History>(HISTORY, {}, me.token)).data!.learningHistory.days
    expect(after.map((d) => d.day)).toEqual([at(1, 8).slice(0, 10)])
  })

  it('sets the time zone by hand, refusing one it does not know', async () => {
    const me = await person()
    const set = (timeZone: string) => app.gql<{ setLearningTimeZone: { ok: boolean; userErrors: { code: string }[] } }>('mutation ($input: SetLearningTimeZoneInput!) { setLearningTimeZone(input: $input) { ok userErrors { code } } }', { input: { timeZone } }, me.token)
    expect((await set('Atlantis/Lost')).data!.setLearningTimeZone.userErrors[0]!.code).toBe('VALIDATION')
    expect((await set('Europe/London')).data!.setLearningTimeZone.ok).toBe(true)
    expect((await app.gql<History>(HISTORY, {}, me.token)).data!.learningHistory.timeZone).toBe('Europe/London')
    expect((await app.gql(HISTORY)).errors?.[0]?.extensions.code).toBe('UNAUTHENTICATED')
  })
})
