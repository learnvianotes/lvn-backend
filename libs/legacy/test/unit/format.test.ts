import { countsOf, isEmpty, legacyUserSnapshot } from '../../src/format'

const snapshot = legacyUserSnapshot.parse({
  version: 1,
  uid: 'abc',
  email: 'asha@example.com',
  emailVerified: true,
  providers: ['google.com'],
  user: {
    progress: {
      problems: { 'lc-20': 'solved', 'lc-155': 'revisit' },
      topics: { 'python/variables': true, 'python/loops': true, 'dbms/normalisation': true },
      revisitTopics: { 'dbms/normalisation': true },
      studied: { '2026-01-02': 3, '2026-01-05': 1 },
    },
  },
  days: {
    '2026-01-02': { topics: { 'python/variables': { title: 'Variables', subject: 'Python', sec: 600, visits: 2, last: 1 } }, focus: 1500 },
    '2026-01-03': { topics: { 'python/loops': { title: 'Loops', subject: 'Python', sec: 300, visits: 1, last: 2 } }, focus: 0 },
  },
  notes: [{ key: 'python/variables', text: 'x = 1', updatedAt: 1 }, { key: 'python/loops', text: '   ', updatedAt: 2 }],
})

describe('old-site snapshots (ADR-0023)', () => {
  it('counts what a returning learner would bring over', () => {
    expect(countsOf(snapshot)).toEqual({ notes: 1, completedTopics: 3, markedProblems: 2, studyDays: 3, studyMinutes: 40 })
    expect(isEmpty(countsOf(snapshot))).toBe(false)
  })

  it('treats a user with no data as empty', () => {
    const empty = legacyUserSnapshot.parse({ version: 1, uid: 'x', email: null, emailVerified: false, providers: [], user: null, days: {}, notes: [] })
    expect(isEmpty(countsOf(empty))).toBe(true)
  })

  it('refuses malformed data instead of importing it', () => {
    expect(legacyUserSnapshot.safeParse({ ...snapshot, days: { yesterday: { topics: {}, focus: 0 } } }).success).toBe(false)
    expect(legacyUserSnapshot.safeParse({ ...snapshot, user: { progress: { problems: { x: 'done' } } } }).success).toBe(false)
  })
})
