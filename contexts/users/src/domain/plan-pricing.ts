import type { GlobalRole, LimitKey } from '@lvn/contracts/domain'

/** Plan prices are configuration. Nothing here charges anyone (ADR-0101). */

export const PLAN_INTERVALS = ['NONE', 'MONTH', 'YEAR'] as const
export type PlanIntervalName = (typeof PLAN_INTERVALS)[number]

const CODE = /^[A-Z][A-Z0-9_]{1,31}$/
const CURRENCY = /^[A-Z]{3}$/
const MAX_PRICE_MINOR = 2_000_000_000
const MAX_FEATURES = 24
const MAX_FEATURE_LENGTH = 160
const MAX_NAME = 80
const MAX_ENTITLEMENTS = 40

export interface PlanEntitlementDraft {
  key: LimitKey
  /** null means unlimited */
  limit: bigint | null
  appliesToRole: GlobalRole | null
}

export interface PlanDraft {
  code: string
  name: string
  priceMinor: number
  currency: string
  interval: PlanIntervalName
  features: string[]
  active: boolean
  entitlements: PlanEntitlementDraft[]
}

export interface PlanEntitlementInput {
  key: LimitKey
  limit?: string | null
  appliesToRole?: GlobalRole | null
}

export interface PlanWriteInput {
  code?: string | null
  name?: string | null
  priceMinor?: number | null
  currency?: string | null
  interval?: PlanIntervalName | null
  features?: string[] | null
  active?: boolean | null
  entitlements?: PlanEntitlementInput[] | null
}

type Parsed<T> = { ok: true; value: T } | { ok: false; message: string; field: string[] }

export function parsePlanDraft(input: PlanWriteInput, keys: readonly LimitKey[]): Parsed<PlanDraft> {
  if (!input.code?.trim()) return fail('Give the plan a code.', ['input', 'code'])
  const code = input.code.trim().toUpperCase()
  if (!CODE.test(code)) return fail('Use 2–32 characters: A–Z, digits and underscores, starting with a letter.', ['input', 'code'])
  const name = parseName(input.name)
  if (!name.ok) return name
  const price = parsePrice(input.priceMinor)
  if (!price.ok) return price
  const currency = parseCurrency(input.currency)
  if (!currency.ok) return currency
  const interval = parseInterval(input.interval)
  if (!interval.ok) return interval
  const features = parseFeatures(input.features ?? [])
  if (!features.ok) return features
  const entitlements = parseEntitlements(input.entitlements ?? [], keys)
  if (!entitlements.ok) return entitlements
  return { ok: true, value: { code, name: name.value, priceMinor: price.value, currency: currency.value, interval: interval.value, features: features.value, active: input.active ?? true, entitlements: entitlements.value } }
}

export function parsePlanPatch(input: PlanWriteInput, keys: readonly LimitKey[]): Parsed<Partial<PlanDraft>> {
  const patch: Partial<PlanDraft> = {}
  if (input.name !== undefined && input.name !== null) {
    const name = parseName(input.name)
    if (!name.ok) return name
    patch.name = name.value
  }
  if (input.priceMinor !== undefined && input.priceMinor !== null) {
    const price = parsePrice(input.priceMinor)
    if (!price.ok) return price
    patch.priceMinor = price.value
  }
  if (input.currency !== undefined && input.currency !== null) {
    const currency = parseCurrency(input.currency)
    if (!currency.ok) return currency
    patch.currency = currency.value
  }
  if (input.interval !== undefined && input.interval !== null) {
    const interval = parseInterval(input.interval)
    if (!interval.ok) return interval
    patch.interval = interval.value
  }
  if (input.features !== undefined && input.features !== null) {
    const features = parseFeatures(input.features)
    if (!features.ok) return features
    patch.features = features.value
  }
  if (input.active !== undefined && input.active !== null) patch.active = input.active
  if (input.entitlements !== undefined && input.entitlements !== null) {
    const entitlements = parseEntitlements(input.entitlements, keys)
    if (!entitlements.ok) return entitlements
    patch.entitlements = entitlements.value
  }
  return { ok: true, value: patch }
}

function parseName(name: string | null | undefined): Parsed<string> {
  const trimmed = name?.trim() ?? ''
  if (!trimmed) return fail('Give the plan a name.', ['input', 'name'])
  if (trimmed.length > MAX_NAME) return fail(`Use at most ${MAX_NAME} characters.`, ['input', 'name'])
  return { ok: true, value: trimmed }
}

function parsePrice(price: number | null | undefined): Parsed<number> {
  if (price === undefined || price === null || !Number.isInteger(price) || price < 0 || price > MAX_PRICE_MINOR) {
    return fail(`Use a whole number of minor units from 0 to ${MAX_PRICE_MINOR}.`, ['input', 'priceMinor'])
  }
  return { ok: true, value: price }
}

function parseCurrency(currency: string | null | undefined): Parsed<string> {
  const code = currency?.trim().toUpperCase() ?? ''
  if (!CURRENCY.test(code)) return fail('Use a three-letter ISO currency code, such as INR.', ['input', 'currency'])
  return { ok: true, value: code }
}

function parseInterval(interval: string | null | undefined): Parsed<PlanIntervalName> {
  if (!interval || !PLAN_INTERVALS.includes(interval as PlanIntervalName)) return fail('Choose NONE, MONTH or YEAR.', ['input', 'interval'])
  return { ok: true, value: interval as PlanIntervalName }
}

function parseFeatures(features: string[]): Parsed<string[]> {
  if (features.length > MAX_FEATURES) return fail(`List at most ${MAX_FEATURES} features.`, ['input', 'features'])
  const out: string[] = []
  for (const feature of features) {
    const trimmed = feature.trim()
    if (!trimmed || trimmed.length > MAX_FEATURE_LENGTH) return fail(`Each feature is 1–${MAX_FEATURE_LENGTH} characters.`, ['input', 'features'])
    out.push(trimmed)
  }
  return { ok: true, value: out }
}

function parseEntitlements(rows: PlanEntitlementInput[], keys: readonly LimitKey[]): Parsed<PlanEntitlementDraft[]> {
  if (rows.length > MAX_ENTITLEMENTS) return fail(`List at most ${MAX_ENTITLEMENTS} limits.`, ['input', 'entitlements'])
  const seen = new Set<string>()
  const out: PlanEntitlementDraft[] = []
  for (const row of rows) {
    if (!keys.includes(row.key)) return fail('That limit is not one this platform uses.', ['input', 'entitlements'])
    const role = row.appliesToRole ?? null
    const id = `${row.key}:${role ?? '*'}`
    if (seen.has(id)) return fail('Each limit and role can be set once.', ['input', 'entitlements'])
    seen.add(id)
    if (row.limit === undefined || row.limit === null || row.limit === '') {
      out.push({ key: row.key, limit: null, appliesToRole: role })
      continue
    }
    if (!/^\d+$/.test(row.limit) || row.limit.length > 18) return fail('A limit is a whole number, or empty for unlimited.', ['input', 'entitlements'])
    out.push({ key: row.key, limit: BigInt(row.limit), appliesToRole: role })
  }
  return { ok: true, value: out }
}

function fail(message: string, field: string[]): Parsed<never> {
  return { ok: false, message, field }
}
