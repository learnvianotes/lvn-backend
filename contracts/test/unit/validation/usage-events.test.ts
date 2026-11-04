import { isUsageEventName, QUIZ_START_KINDS, USAGE_EVENT_LIMITS, USAGE_EVENT_NAMES, USAGE_FEATURES, USAGE_SEARCH_SCOPES } from '../../../src/domain/usage-events'
import { isUsageSessionId, normalizeAppVersion, sanitizeUsageProps } from '../../../src/validation/usage-events'

describe('usage event names (ADR-0107)', () => {
  it('keeps the six B9 names and adds feature_use, search_no_results and quiz_start', () => {
    expect([...USAGE_EVENT_NAMES].sort()).toEqual(['download', 'feature_use', 'note_open', 'note_upload', 'page_view', 'quiz_start', 'search', 'search_no_results', 'sign_in'])
    expect(isUsageEventName('quiz_start')).toBe(true)
    expect(isUsageEventName('click')).toBe(false)
  })

  it('uses lower-case snake ids for every enum, so the GraphQL enums are their upper case', () => {
    for (const id of [...USAGE_FEATURES, ...USAGE_SEARCH_SCOPES, ...QUIZ_START_KINDS]) expect(id).toMatch(/^[a-z][a-z_]*$/)
    expect(new Set(USAGE_FEATURES).size).toBe(USAGE_FEATURES.length)
  })
})

describe('sanitizeUsageProps', () => {
  it('keeps a known feature and drops every other key', () => {
    expect(sanitizeUsageProps('feature_use', { feature: 'pdf_viewer', noteTitle: 'My diary', extra: 1 })).toEqual({ ok: true, props: { feature: 'pdf_viewer' } })
  })

  it.each([
    ['an unknown feature', 'feature_use', { feature: 'mind_reader' }, 'props.feature'],
    ['a missing feature', 'feature_use', {}, 'props.feature'],
    ['free text as a feature', 'feature_use', { feature: 'what I typed' }, 'props.feature'],
    ['an unknown quiz kind', 'quiz_start', { kind: 'pop' }, 'props.kind'],
    ['a zero-result search without a scope', 'search_no_results', { wordCount: 2 }, 'props.scope'],
    ['a zero-result search with the query as its scope', 'search_no_results', { scope: 'calculus', wordCount: 1 }, 'props.scope'],
    ['a zero-result search without a word count', 'search_no_results', { scope: 'notes' }, 'props.wordCount'],
    ['a fractional word count', 'search_no_results', { scope: 'notes', wordCount: 1.5 }, 'props.wordCount'],
    ['a negative word count', 'search_no_results', { scope: 'notes', wordCount: -1 }, 'props.wordCount'],
    ['props that are a list', 'page_view', ['a'], 'props'],
    ['props that are a string', 'page_view', 'hello', 'props'],
  ] as const)('refuses %s', (_, name, props, path) => {
    expect(sanitizeUsageProps(name, props)).toMatchObject({ ok: false, path })
  })

  it('refuses props over 1024 characters or 16 keys', () => {
    expect(sanitizeUsageProps('page_view', { kind: 'x'.repeat(USAGE_EVENT_LIMITS.propsChars) })).toMatchObject({ ok: false, path: 'props' })
    const many = Object.fromEntries(Array.from({ length: USAGE_EVENT_LIMITS.propsKeys + 1 }, (_, i) => [`k${i}`, i]))
    expect(sanitizeUsageProps('page_view', many)).toMatchObject({ ok: false, path: 'props' })
  })

  it('keeps a zero-result search as scope and a capped word count, never the words', () => {
    expect(sanitizeUsageProps('search_no_results', { scope: 'notes', wordCount: 3, query: 'integration by parts' })).toEqual({ ok: true, props: { scope: 'notes', wordCount: 3 } })
    expect(sanitizeUsageProps('search_no_results', { scope: 'all', wordCount: 400 })).toEqual({ ok: true, props: { scope: 'all', wordCount: USAGE_EVENT_LIMITS.wordCountCap } })
  })

  it('keeps a quiz kind', () => {
    expect(sanitizeUsageProps('quiz_start', { kind: 'shared', quizId: '01920000-0000-7000-8000-000000000001' })).toEqual({ ok: true, props: { kind: 'shared' } })
  })

  it('reads a search from older clients: words become wordCount, a bad scope or a query is dropped', () => {
    expect(sanitizeUsageProps('search', { words: 2 })).toEqual({ ok: true, props: { wordCount: 2 } })
    expect(sanitizeUsageProps('search', { scope: 'people', wordCount: 1 })).toEqual({ ok: true, props: { scope: 'people', wordCount: 1 } })
    expect(sanitizeUsageProps('search', { scope: 'calculus', q: 'calculus', words: 'two' })).toEqual({ ok: true, props: null })
  })

  it('keeps short tokens, numbers and booleans in the older events and drops free text, ids and personal keys', () => {
    const r = sanitizeUsageProps('page_view', {
      feature: 'notes',
      kind: 'data_export',
      count: 3,
      dark: true,
      sentence: 'my exam is on monday',
      email: 'ada@college.edu',
      displayName: 'Ada',
      handle: 'ada',
      noteId: '01920000-0000-7000-8000-000000000001',
      at: 'ada@college.edu',
      route: '/notes/abc',
      nested: { feature: 'x' },
      list: ['a'],
      huge: 1e12,
      nan: Number.NaN,
      'bad key': 'x',
    })
    expect(r).toEqual({ ok: true, props: { feature: 'notes', kind: 'data_export', count: 3, dark: true } })
  })

  it.each(['feature_use', 'search_no_results', 'quiz_start'] as const)('refuses %s without props', (name) => {
    expect(sanitizeUsageProps(name, null)).toMatchObject({ ok: false })
    expect(sanitizeUsageProps(name, undefined)).toMatchObject({ ok: false })
  })

  it('stores no props rather than an empty object', () => {
    expect(sanitizeUsageProps('sign_in', null)).toEqual({ ok: true, props: null })
    expect(sanitizeUsageProps('sign_in', { message: 'hello there' })).toEqual({ ok: true, props: null })
  })
})

describe('normalizeAppVersion', () => {
  it.each([
    ['1.0.0', '1.0.0'],
    ['v2.3', '2.3'],
    [' 2026.11.4 ', '2026.11.4'],
    ['1.4.0-beta.2', '1.4.0-beta.2'],
    ['1.4.0-rc.1+8708f5e', '1.4.0-rc.1+8708f5e'],
    ['1.2.3.4', '1.2.3.4'],
  ])('keeps %j as %j', (input, out) => {
    expect(normalizeAppVersion(input)).toBe(out)
  })

  it.each([null, undefined, '', '42', 'latest', '1.0 beta', '1.0.0; DROP TABLE', 'Mozilla/5.0 (Linux)', `1.0.0-${'a'.repeat(30)}`, '1.2.3.4.5'])('drops %j', (input) => {
    expect(normalizeAppVersion(input)).toBeNull()
  })
})

describe('isUsageSessionId', () => {
  it('takes a UUID or a short token and nothing else', () => {
    expect(isUsageSessionId('01920000-0000-7000-8000-000000000001')).toBe(true)
    expect(isUsageSessionId('tab_3')).toBe(true)
    expect(isUsageSessionId('my session')).toBe(false)
    expect(isUsageSessionId('x'.repeat(65))).toBe(false)
    expect(isUsageSessionId(null)).toBe(false)
  })
})
