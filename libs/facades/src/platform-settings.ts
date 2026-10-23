/**
 * Application settings stored as data (ADR-0101). A missing key returns `fallback`, which is the process
 * environment for settings that used to be environment variables, or the catalog default for the rest.
 * Permission decisions are not cached here; only the setting values, and only for a few seconds.
 */
export const PLATFORM_SETTINGS = Symbol('PLATFORM_SETTINGS')

export interface PlatformSettings {
  boolean(key: string, fallback: boolean): boolean
  /** `null` is a saved empty value (no cap). A missing key returns `fallback`. */
  integer(key: string, fallback: number | null): number | null
}

/** Used where no store is bound: every read is the caller's fallback (the environment). */
export const fallbackPlatformSettings: PlatformSettings = {
  boolean: (_key, fallback) => fallback,
  integer: (_key, fallback) => fallback,
}
