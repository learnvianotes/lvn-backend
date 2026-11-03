/**
 * The terms version in effect and the versions an admin may choose (ADR-0103). Pure: the caller passes the saved
 * AppSetting values and the environment.
 */
import { DEFAULT_PUBLISHED_TERMS_VERSIONS, DEFAULT_TERMS_VERSION } from './rules'

export const TERMS_VERSION_SETTING = 'terms_version'
export const TERMS_PUBLISHED_VERSIONS_SETTING = 'terms_published_versions'

export const TERMS_VERSION_PATTERN = '^\\d{4}-\\d{2}-\\d{2}$'
export const TERMS_PUBLISHED_VERSIONS_PATTERN = '^\\d{4}-\\d{2}-\\d{2}(,\\d{4}-\\d{2}-\\d{2})*$'

/** Where the value in effect comes from: a saved admin setting, the environment, or the built-in default. */
export type TermsSource = 'SETTING' | 'ENV' | 'DEFAULT'

/** Fewer distinct accounts than this in a group is not shown on an admin screen. */
export const K_ANONYMITY_THRESHOLD = 5

/** A YYYY-MM-DD that is a real calendar date. */
export function isTermsVersion(value: string): boolean {
  if (!new RegExp(TERMS_VERSION_PATTERN).test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

/** Comma-separated versions → sorted, without duplicates. Spaces around a version are ignored. */
export function parsePublishedTermsVersions(raw: string): { ok: true; versions: string[] } | { ok: false; message: string } {
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (!parts.length) return { ok: false, message: 'List at least one published version, as YYYY-MM-DD.' }
  const bad = parts.find((p) => !isTermsVersion(p))
  if (bad !== undefined) return { ok: false, message: `${bad.slice(0, 20)} is not a date. Use YYYY-MM-DD, separated by commas.` }
  return { ok: true, versions: [...new Set(parts)].sort() }
}

export interface TermsInputs {
  /** The saved AppSetting values, or null when no row is saved. */
  savedVersion: string | null
  savedPublished: string | null
  /** TERMS_VERSION and TERMS_PUBLISHED_VERSIONS, or undefined when unset. */
  envVersion: string | undefined
  envPublished: string | undefined
}

export interface TermsResolution {
  version: string
  source: TermsSource
  published: string[]
  publishedSource: TermsSource
}

/**
 * Saved row, then environment, then the built-in default. A value that does not parse (written outside the admin
 * tools) is skipped, so a bad row cannot lock everyone out of sign-up.
 */
export function resolveTerms(inputs: TermsInputs): TermsResolution {
  const version =
    inputs.savedVersion !== null && isTermsVersion(inputs.savedVersion)
      ? { version: inputs.savedVersion, source: 'SETTING' as const }
      : inputs.envVersion !== undefined && isTermsVersion(inputs.envVersion)
        ? { version: inputs.envVersion, source: 'ENV' as const }
        : { version: DEFAULT_TERMS_VERSION, source: 'DEFAULT' as const }
  const saved = inputs.savedPublished !== null ? parsePublishedTermsVersions(inputs.savedPublished) : null
  const env = inputs.envPublished !== undefined ? parsePublishedTermsVersions(inputs.envPublished) : null
  const published =
    saved?.ok
      ? { published: saved.versions, publishedSource: 'SETTING' as const }
      : env?.ok
        ? { published: env.versions, publishedSource: 'ENV' as const }
        : { published: [...DEFAULT_PUBLISHED_TERMS_VERSIONS], publishedSource: 'DEFAULT' as const }
  return { ...version, ...published }
}

/**
 * Why a change to either setting may not be saved, or null. The version in effect must stay one the web has
 * published, so a save or reset of `terms_version` must land on a listed version, and a save or reset of the list
 * must keep the version in effect.
 */
export function termsChangeError(key: string, next: TermsResolution): string | null {
  if (next.published.includes(next.version)) return null
  const listed = next.published.join(', ')
  if (key === TERMS_VERSION_SETTING) {
    return `${next.version} is not a published terms version. Choose one of: ${listed}. A new version must first be published on the web and added to ${TERMS_PUBLISHED_VERSIONS_SETTING}.`
  }
  return `The published versions must include the terms version in effect (${next.version}). Change ${TERMS_VERSION_SETTING} first.`
}

/** A count for an admin screen, or null when fewer than K_ANONYMITY_THRESHOLD accounts are in it. */
export function kAnonymous(count: number): number | null {
  return count >= K_ANONYMITY_THRESHOLD ? count : null
}
