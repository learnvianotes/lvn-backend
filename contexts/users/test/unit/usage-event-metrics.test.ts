import { readFileSync } from 'node:fs'
import path from 'node:path'
import { parse, type EnumTypeDefinitionNode } from 'graphql'
import { QUIZ_START_KINDS, USAGE_FEATURES, USAGE_SEARCH_SCOPES } from '@lvn/contracts/domain'
import { MetricRows, type MetricRow } from '../../src/domain/daily-metrics'
import {
  compareAppVersions,
  peopleIn,
  share,
  summarizeFeatureUsage,
  summarizeSearchQuality,
  summarizeVersionAdoption,
  USAGE_DAILY_METRICS as M,
  usageRows,
  windowKey,
  windowUsersOf,
  type UsageGroup,
} from '../../src/domain/usage-event-metrics'

/** ADR-0107: admin metrics from the new usage events, with the small-group rule (fewer than 5 people are hidden). */

const row = (day: string, metric: string, value: number, dimension = ''): MetricRow => ({ day, metric, dimension, value })
const group = (kind: UsageGroup['kind'], dimension: string, users: number, events = users): UsageGroup => ({ day: '', kind, dimension, events, users })
const live = (...groups: UsageGroup[]) => windowUsersOf(groups)

describe('the GraphQL enums', () => {
  const sdl = readFileSync(path.join(__dirname, '../../src/graphql/admin-usage-metrics.graphql'), 'utf8')
  const values = (name: string) =>
    (parse(sdl).definitions.find((d) => d.kind === 'EnumTypeDefinition' && d.name.value === name) as EnumTypeDefinitionNode | undefined)?.values?.map((v) => v.name.value) ?? []

  it.each([
    ['UsageFeature', USAGE_FEATURES],
    ['UsageSearchScope', USAGE_SEARCH_SCOPES],
    ['QuizStartKind', QUIZ_START_KINDS],
  ] as const)('%s is the contracts ids in upper case, in the same order', (name, ids) => {
    expect(values(name)).toEqual(ids.map((id) => id.toUpperCase()))
  })
})

describe('rollup rows', () => {
  it('stores each kind under its metrics and leaves zeros and unstored halves out', () => {
    const rows = usageRows([
      { day: '2026-11-01', kind: 'feature', dimension: 'pdf_viewer', events: 7, users: 3 },
      { day: '2026-11-01', kind: 'search', dimension: 'notes', events: 4, users: 2 },
      { day: '2026-11-01', kind: 'search_any', dimension: 'notes', events: 5, users: 2 },
      { day: '2026-11-01', kind: 'platform', dimension: 'WEB', events: 20, users: 6 },
      { day: '2026-11-01', kind: 'version', dimension: 'MOBILE|1.4.0', events: 0, users: 0 },
    ])
    expect(rows).toEqual([
      row('2026-11-01', M.featureEvents, 7, 'pdf_viewer'),
      row('2026-11-01', M.featureUsers, 3, 'pdf_viewer'),
      row('2026-11-01', M.searches, 4, 'notes'),
      row('2026-11-01', M.searchUsers, 2, 'notes'),
      row('2026-11-01', M.platformUsers, 6, 'WEB'),
    ])
  })
})

describe('people in a group over a window', () => {
  it('uses the live count, or the busiest stored day when the events of older days are gone', () => {
    const rows = new MetricRows([row('2026-05-01', M.featureUsers, 6, 'groups'), row('2026-05-02', M.featureUsers, 2, 'groups'), row('2026-11-01', M.versionUsers, 4, 'WEB|1.0.0')])
    expect(peopleIn('feature', 'groups', live(group('feature', 'groups', 3)), rows)).toBe(6)
    expect(peopleIn('feature', 'groups', live(group('feature', 'groups', 9)), rows)).toBe(9)
    expect(peopleIn('version', 'WEB|1.0.0', live(), rows)).toBe(4)
    expect(peopleIn('feature', 'doubts', live(), rows)).toBe(0)
    expect(windowKey('version', 'WEB|1.0.0')).toBe('version|WEB|1.0.0')
  })

  it('reads the busiest day per dimension, even when the dimension holds a |', () => {
    const rows = new MetricRows([row('2026-11-01', M.versionUsers, 3, 'WEB|1.0.0'), row('2026-11-02', M.versionUsers, 5, 'WEB|1.0.0'), row('2026-11-02', M.versionUsers, 1, 'MOBILE|')])
    expect(rows.maxPerDay(M.versionUsers)).toEqual(new Map([['WEB|1.0.0', 5], ['MOBILE|', 1]]))
    expect(rows.maxPerDay(M.searches)).toEqual(new Map())
  })

  it('gives a share with three decimals, never past 1, and null over nothing', () => {
    expect(share(1, 3)).toBe(0.333)
    expect(share(7, 5)).toBe(1)
    expect(share(2, 0)).toBeNull()
  })
})

describe('feature usage', () => {
  it('lists features and quiz kinds with 5 or more people, most people first, and counts the hidden ones', () => {
    const rows = new MetricRows([
      row('2026-11-01', M.featureEvents, 30, 'pdf_viewer'),
      row('2026-11-02', M.featureEvents, 10, 'pdf_viewer'),
      row('2026-11-01', M.featureEvents, 12, 'groups'),
      row('2026-11-01', M.featureEvents, 9, 'doubts'),
      row('2026-11-01', M.quizStarts, 8, 'shared'),
      row('2026-11-01', M.quizStarts, 2, 'class'),
      // A value no client may send any more is never shown.
      row('2026-11-01', M.featureEvents, 50, 'retired_feature'),
    ])
    const users = live(group('feature', 'pdf_viewer', 6), group('feature', 'groups', 8), group('feature', 'doubts', 4), group('feature', 'retired_feature', 40), group('quiz', 'shared', 5), group('quiz', 'class', 2))
    expect(summarizeFeatureUsage(rows, users)).toEqual({
      events: 111,
      features: [
        { feature: 'GROUPS', users: 8, events: 12 },
        { feature: 'PDF_VIEWER', users: 6, events: 40 },
      ],
      hiddenSmallGroups: 1,
      quizStarts: { starts: 10, byKind: [{ kind: 'SHARED', users: 5, starts: 8 }], hiddenSmallGroups: 1 },
    })
  })

  it('shows nothing and hides nothing for a window without events', () => {
    expect(summarizeFeatureUsage(new MetricRows([]), live())).toEqual({ events: 0, features: [], hiddenSmallGroups: 0, quizStarts: { starts: 0, byKind: [], hiddenSmallGroups: 0 } })
  })
})

describe('search quality', () => {
  it('gives totals over every search and the rate per scope, hiding scopes under 5 people', () => {
    const rows = new MetricRows([
      row('2026-11-01', M.searches, 40, 'notes'),
      row('2026-11-01', M.searchesNoResults, 10, 'notes'),
      row('2026-11-01', M.searches, 6, 'people'),
      row('2026-11-01', M.searchesNoResults, 6, 'people'),
      row('2026-11-01', M.searches, 20, ''),
    ])
    const users = live(group('search_any', 'notes', 9), group('search_any', 'people', 3), group('search_any', '', 5))
    expect(summarizeSearchQuality(rows, users)).toEqual({
      searches: 66,
      zeroResults: 16,
      zeroResultRate: 0.242,
      byScope: [
        { scope: 'NOTES', users: 9, searches: 40, zeroResults: 10, zeroResultRate: 0.25 },
        { scope: null, users: 5, searches: 20, zeroResults: 0, zeroResultRate: 0 },
      ],
      hiddenSmallGroups: 1,
    })
  })

  it('has no rate without searches', () => {
    expect(summarizeSearchQuality(new MetricRows([]), live())).toMatchObject({ searches: 0, zeroResultRate: null, byScope: [] })
  })
})

describe('version adoption', () => {
  it('sorts versions newest first, a release before its pre-releases, no version last', () => {
    const versions = ['1.2.0', null, '1.10.0', '1.2.0-beta.1', '1.2', '2026.11.4', '1.2.0-rc.1', '1.9.9']
    expect([...versions].sort(compareAppVersions)).toEqual(['2026.11.4', '1.10.0', '1.9.9', '1.2.0', '1.2', '1.2.0-rc.1', '1.2.0-beta.1', null])
  })

  it('lists platforms and versions with 5 or more people, with each version share of its platform', () => {
    const rows = new MetricRows([
      row('2026-11-01', M.versionEvents, 100, 'WEB|'),
      row('2026-11-01', M.versionEvents, 30, 'MOBILE|1.4.0'),
      row('2026-11-01', M.versionEvents, 12, 'MOBILE|1.5.0'),
      row('2026-11-01', M.versionEvents, 3, 'MOBILE|1.3.0'),
    ])
    const users = live(
      group('platform', 'WEB', 4),
      group('version', 'WEB|', 4),
      group('platform', 'MOBILE', 10),
      group('version', 'MOBILE|1.4.0', 7),
      group('version', 'MOBILE|1.5.0', 5),
      group('version', 'MOBILE|1.3.0', 1),
    )
    expect(summarizeVersionAdoption(rows, users)).toEqual({
      platforms: [
        {
          platform: 'MOBILE',
          users: 10,
          events: 45,
          versions: [
            { appVersion: '1.5.0', users: 5, events: 12, share: 0.5 },
            { appVersion: '1.4.0', users: 7, events: 30, share: 0.7 },
          ],
        },
      ],
      // WEB under 5 people (with its one version), and MOBILE 1.3.0.
      hiddenSmallGroups: 3,
    })
  })

  it('shows a platform without a version as one version null', () => {
    const rows = new MetricRows([row('2026-11-01', M.versionEvents, 9, 'WEB|')])
    expect(summarizeVersionAdoption(rows, live(group('platform', 'WEB', 6), group('version', 'WEB|', 6)))).toEqual({
      platforms: [{ platform: 'WEB', users: 6, events: 9, versions: [{ appVersion: null, users: 6, events: 9, share: 1 }] }],
      hiddenSmallGroups: 0,
    })
  })
})
