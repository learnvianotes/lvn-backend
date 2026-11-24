import { QUIZ_START_KINDS, USAGE_FEATURES, USAGE_SEARCH_SCOPES } from '@lvn/contracts/domain'
import type { MetricRow, MetricRows } from './daily-metrics'
import { K_ANONYMITY_THRESHOLD } from './terms'

/**
 * Admin metrics from the ADR-0107 usage events: feature use, quiz starts, search quality and app version adoption.
 * Names of their rows in users.daily_metrics, and the pure arithmetic from rows (stored or live) to results, with the
 * small-group rule. Counts only: no account id, no free text (every dimension is a fixed id, a scope, a platform, or an
 * app version that matched APP_VERSION_PATTERN).
 */

/** Daily rollup metrics (ADR-0106's table). `*_users` are distinct people that day in the dimension's group. */
export const USAGE_DAILY_METRICS = {
  /** `feature_use` events, by feature id. */
  featureEvents: 'feature_use_events',
  featureUsers: 'feature_use_users',
  /** `quiz_start` events, by kind. */
  quizStarts: 'quiz_starts',
  quizStartUsers: 'quiz_start_users',
  /** `search` events, by scope ('' when the client sent none). */
  searches: 'searches',
  /** `search_no_results` events, by scope. */
  searchesNoResults: 'searches_no_results',
  /** People who searched (or found nothing) in a scope. */
  searchUsers: 'search_users',
  /** Every usage event, by `PLATFORM|appVersion` (appVersion '' when none was sent or it was not a version). */
  versionEvents: 'app_version_events',
  versionUsers: 'app_version_users',
  /** People who sent any usage event, by platform. */
  platformUsers: 'platform_users',
} as const

/** How the usage-event query groups events: one kind per breakdown. `search_any` is a search or a zero-result search. */
export type UsageGroupKind = 'feature' | 'quiz' | 'search' | 'no_results' | 'search_any' | 'version' | 'platform'

/** One group of usage events on a day ('' for the whole window): how many and how many distinct people. */
export interface UsageGroup {
  day: string
  kind: UsageGroupKind
  dimension: string
  events: number
  users: number
}

const M = USAGE_DAILY_METRICS
/** Which rollup metric holds a kind's events and its people. A kind without one is not stored. */
const GROUP_METRICS: Record<UsageGroupKind, { events?: string; users?: string }> = {
  feature: { events: M.featureEvents, users: M.featureUsers },
  quiz: { events: M.quizStarts, users: M.quizStartUsers },
  search: { events: M.searches },
  no_results: { events: M.searchesNoResults },
  search_any: { users: M.searchUsers },
  version: { events: M.versionEvents, users: M.versionUsers },
  platform: { users: M.platformUsers },
}

/** Per-day groups as rollup rows. Zeros are left out. */
export function usageRows(groups: readonly UsageGroup[]): MetricRow[] {
  const out: MetricRow[] = []
  for (const g of groups) {
    const metrics = GROUP_METRICS[g.kind]
    if (metrics.events && g.events > 0) out.push({ day: g.day, metric: metrics.events, dimension: g.dimension, value: g.events })
    if (metrics.users && g.users > 0) out.push({ day: g.day, metric: metrics.users, dimension: g.dimension, value: g.users })
  }
  return out
}

/** Distinct people per group over a whole window, counted now from the events: `kind|dimension` → people. */
export type WindowUsers = ReadonlyMap<string, number>

export const windowKey = (kind: UsageGroupKind, dimension: string): string => `${kind}|${dimension}`

/** Whole-window groups as WindowUsers. */
export function windowUsersOf(groups: readonly UsageGroup[]): Map<string, number> {
  return new Map(groups.map((g) => [windowKey(g.kind, g.dimension), g.users]))
}

/**
 * Distinct people in a group over the window. Events are kept 180 days, so for a window reaching further back the
 * count from the events alone misses people; the busiest stored day of the group is a second lower bound. The larger
 * of the two is used: exact when every day of the window still has its events, never more than the true number, so
 * the small-group rule only ever hides more.
 */
export function peopleIn(kind: UsageGroupKind, dimension: string, live: WindowUsers, rows: MetricRows): number {
  const metric = GROUP_METRICS[kind].users
  const busiestDay = metric ? (rows.maxPerDay(metric).get(dimension) ?? 0) : 0
  return Math.max(live.get(windowKey(kind, dimension)) ?? 0, busiestDay)
}

/** The share a / b, 0 to 1 with three decimals, or null when b is 0. */
export function share(a: number, b: number): number | null {
  if (!b) return null
  return Math.round(Math.min(1, a / b) * 1000) / 1000
}

/** The dimensions a group has events or people in, known values only, sorted. */
function dimensionsOf(kind: UsageGroupKind, live: WindowUsers, rows: MetricRows, known?: ReadonlySet<string>): string[] {
  const metrics = GROUP_METRICS[kind]
  const out = new Set<string>()
  for (const metric of [metrics.events, metrics.users]) if (metric) for (const dimension of rows.byDimension(metric).keys()) out.add(dimension)
  const prefix = `${kind}|`
  for (const key of live.keys()) if (key.startsWith(prefix)) out.add(key.slice(prefix.length))
  return [...out].filter((d) => !known || known.has(d)).sort()
}

const FEATURES: ReadonlySet<string> = new Set(USAGE_FEATURES)
const KINDS: ReadonlySet<string> = new Set(QUIZ_START_KINDS)
const SCOPES: ReadonlySet<string> = new Set(['', ...USAGE_SEARCH_SCOPES])
const PLATFORMS: ReadonlySet<string> = new Set(['WEB', 'MOBILE'])

/** A GraphQL enum value: the contracts id in upper case. */
const upper = <T extends string>(id: string): T => id.toUpperCase() as T

export interface FeatureUsageResult<F extends string, K extends string> {
  events: number
  features: { feature: F; users: number; events: number }[]
  hiddenSmallGroups: number
  quizStarts: { starts: number; byKind: { kind: K; users: number; starts: number }[]; hiddenSmallGroups: number }
}

/**
 * Feature use and quiz starts over a window: per feature (and per quiz kind) the distinct people and the events, most
 * people first. A group with fewer than `threshold` people is left out and counted; totals include it.
 */
export function summarizeFeatureUsage<F extends string, K extends string>(rows: MetricRows, live: WindowUsers, threshold: number = K_ANONYMITY_THRESHOLD): FeatureUsageResult<F, K> {
  const features = dimensionsOf('feature', live, rows, FEATURES).map((id) => ({ feature: upper<F>(id), users: peopleIn('feature', id, live, rows), events: rows.byDimension(M.featureEvents).get(id) ?? 0 }))
  const kinds = dimensionsOf('quiz', live, rows, KINDS).map((id) => ({ kind: upper<K>(id), users: peopleIn('quiz', id, live, rows), starts: rows.byDimension(M.quizStarts).get(id) ?? 0 }))
  const shownFeatures = features.filter((f) => f.users >= threshold).sort((a, b) => b.users - a.users || b.events - a.events || a.feature.localeCompare(b.feature))
  const shownKinds = kinds.filter((k) => k.users >= threshold).sort((a, b) => b.users - a.users || b.starts - a.starts || a.kind.localeCompare(b.kind))
  return {
    events: rows.total(M.featureEvents),
    features: shownFeatures,
    hiddenSmallGroups: features.length - shownFeatures.length,
    quizStarts: { starts: rows.total(M.quizStarts), byKind: shownKinds, hiddenSmallGroups: kinds.length - shownKinds.length },
  }
}

export interface SearchQualityResult<S extends string> {
  searches: number
  zeroResults: number
  zeroResultRate: number | null
  byScope: { scope: S | null; users: number; searches: number; zeroResults: number; zeroResultRate: number | null }[]
  hiddenSmallGroups: number
}

/**
 * Searches and zero-result searches over a window, in all and per scope (null: the client sent no scope, as clients
 * from before ADR-0107 do). A scope with fewer than `threshold` people searching in it is left out and counted.
 */
export function summarizeSearchQuality<S extends string>(rows: MetricRows, live: WindowUsers, threshold: number = K_ANONYMITY_THRESHOLD): SearchQualityResult<S> {
  const searches = rows.byDimension(M.searches)
  const zero = rows.byDimension(M.searchesNoResults)
  const scopes = [...new Set([...dimensionsOf('search', live, rows, SCOPES), ...dimensionsOf('no_results', live, rows, SCOPES), ...dimensionsOf('search_any', live, rows, SCOPES)])]
  const groups = scopes.map((id) => {
    const s = searches.get(id) ?? 0
    const z = zero.get(id) ?? 0
    return { scope: id ? upper<S>(id) : null, users: peopleIn('search_any', id, live, rows), searches: s, zeroResults: z, zeroResultRate: share(z, s) }
  })
  const shown = groups.filter((g) => g.users >= threshold).sort((a, b) => b.searches - a.searches || b.users - a.users || (a.scope ?? '').localeCompare(b.scope ?? ''))
  const total = rows.total(M.searches)
  const totalZero = rows.total(M.searchesNoResults)
  return { searches: total, zeroResults: totalZero, zeroResultRate: share(totalZero, total), byScope: shown, hiddenSmallGroups: groups.length - shown.length }
}

/**
 * Newest version first: numeric MAJOR.MINOR.PATCH(.BUILD) parts, then a release before its pre-releases, then the
 * text. No version (null) sorts last.
 */
export function compareAppVersions(a: string | null, b: string | null): number {
  if (a === b) return 0
  if (a == null) return 1
  if (b == null) return -1
  const parts = (v: string) => {
    const [core = '', pre = ''] = v.split('+')[0]!.split(/-(.*)/s)
    return { nums: core.split('.').map(Number), pre }
  }
  const x = parts(a)
  const y = parts(b)
  for (let i = 0; i < Math.max(x.nums.length, y.nums.length); i++) {
    const d = (y.nums[i] ?? 0) - (x.nums[i] ?? 0)
    if (d) return d
  }
  if (!x.pre !== !y.pre) return x.pre ? 1 : -1
  return b.localeCompare(a)
}

export interface VersionAdoptionResult<P extends string> {
  platforms: { platform: P; users: number; events: number; versions: { appVersion: string | null; users: number; events: number; share: number }[] }[]
  hiddenSmallGroups: number
}

/**
 * Which app versions people used in a window, per platform: distinct people and events per version, and the share of
 * the platform's people on it (someone on two versions counts in both). A platform or version with fewer than
 * `threshold` people is left out and counted; a hidden platform's versions are counted as hidden too.
 */
export function summarizeVersionAdoption<P extends string>(rows: MetricRows, live: WindowUsers, threshold: number = K_ANONYMITY_THRESHOLD): VersionAdoptionResult<P> {
  const events = rows.byDimension(M.versionEvents)
  const versions = new Map<string, string[]>()
  for (const dimension of dimensionsOf('version', live, rows)) {
    const at = dimension.indexOf('|')
    const platform = dimension.slice(0, at)
    if (at < 0 || !PLATFORMS.has(platform)) continue
    versions.set(platform, [...(versions.get(platform) ?? []), dimension.slice(at + 1)])
  }
  let hidden = 0
  const platforms: VersionAdoptionResult<P>['platforms'] = []
  for (const platform of [...new Set([...dimensionsOf('platform', live, rows, PLATFORMS), ...versions.keys()])].sort()) {
    const users = peopleIn('platform', platform, live, rows)
    const own = versions.get(platform) ?? []
    if (users < threshold) {
      hidden += 1 + own.length
      continue
    }
    const all = own.map((version) => {
      const key = `${platform}|${version}`
      const people = peopleIn('version', key, live, rows)
      return { appVersion: version || null, users: people, events: events.get(key) ?? 0, share: share(people, users) ?? 0 }
    })
    const shown = all.filter((v) => v.users >= threshold).sort((a, b) => compareAppVersions(a.appVersion, b.appVersion))
    hidden += all.length - shown.length
    platforms.push({ platform: platform as P, users, events: all.reduce((sum, v) => sum + v.events, 0), versions: shown })
  }
  return { platforms, hiddenSmallGroups: hidden }
}
