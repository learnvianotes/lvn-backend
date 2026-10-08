import type { LegacyIndex, LegacyUserSnapshot } from '@lvn-backend/legacy'
import { snapshotOldSite, type LegacySink, type LegacySource } from '../../src/application/legacy-snapshot.job'

const source = (accounts: { uid: string; user: unknown }[]): LegacySource => ({
  async *accounts() {
    for (const a of accounts) yield { uid: a.uid, email: `${a.uid}@example.com`, emailVerified: true, providers: ['google.com'] }
  },
  userDoc: async (uid) => accounts.find((a) => a.uid === uid)!.user,
  days: async () => ({ '2026-01-01': { topics: { 'python/variables': { title: 'V', subject: 'Python', sec: 60, visits: 1, last: 1 } }, focus: 0, updatedAt: 1 } }),
  notes: async () => [{ key: 'python/variables', text: 'hi', updatedAt: 1 }],
  eventBatches: async () => [{ events: [{ t: 1, type: 'topic_view' }] }, { events: [{ t: 2, type: 'search', l: 'loops' }] }],
})

const sink = () => {
  const out = { users: [] as LegacyUserSnapshot[], events: new Map<string, string[]>(), index: null as LegacyIndex | null, order: [] as string[] }
  const s: LegacySink = {
    writeUser: async (u) => { out.users.push(u); out.order.push(`user:${u.uid}`) },
    writeEvents: async (uid, lines) => { out.events.set(uid, lines); out.order.push(`events:${uid}`) },
    writeIndex: async (i) => { out.index = i; out.order.push('index') },
  }
  return { s, out }
}

describe('snapshotOldSite (ADR-0023)', () => {
  it('writes one snapshot and event archive per account, then the index last', async () => {
    const { s, out } = sink()
    const progress = { problems: { 'lc-20': 'solved' }, topics: { 'python/variables': true }, revisitTopics: {}, studied: {} }
    const report = await snapshotOldSite(source([{ uid: 'a', user: { progress, schema: 1, updatedAt: 1 } }, { uid: 'b', user: null }]), s, new Date('2026-10-08T00:00:00Z'))
    expect(report).toEqual({ accounts: 2, written: 2, invalid: [] })
    expect(out.users.map((u) => u.uid)).toEqual(['a', 'b'])
    expect(out.users[0]!.user!.progress.problems).toEqual({ 'lc-20': 'solved' })
    expect(out.events.get('a')).toEqual(['{"t":1,"type":"topic_view"}', '{"t":2,"type":"search","l":"loops"}'])
    expect(out.order.at(-1)).toBe('index')
    expect(out.index).toMatchObject({ generatedAt: '2026-10-08T00:00:00.000Z', users: [{ uid: 'a' }, { uid: 'b' }] })
  })

  it('skips accounts whose data does not match the old schema and reports them', async () => {
    const { s, out } = sink()
    const report = await snapshotOldSite(source([{ uid: 'bad', user: { progress: { problems: { x: 'done' } } } }]), s)
    expect(report.written).toBe(0)
    expect(report.invalid[0]).toMatchObject({ uid: 'bad', reason: expect.stringContaining('problems') })
    expect(out.index!.users).toEqual([])
  })
})
