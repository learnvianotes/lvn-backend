import type { ApiConfig } from '@lvn/contracts/config'

/** What the notes context needs from the API configuration. */
export interface NotesConfig {
  /** development | sandbox | production — the first segment of every storage key (§8.1) */
  env: string
  bucket: string
  /** Identity documents (ADR-0019): own bucket and key, never behind the CDN */
  restrictedBucket: string
  /** Where to tell the web app that a public note page changed; null when not configured (P2d) */
  revalidate: { url: string; secret: string } | null
}

export const NOTES_CONFIG = Symbol('NOTES_CONFIG')

export const notesConfigFrom = (c: ApiConfig): NotesConfig => ({
  env: c.APP_ENV,
  bucket: c.S3_BUCKET,
  restrictedBucket: c.S3_RESTRICTED_BUCKET,
  revalidate: c.WEB_REVALIDATE_URL && c.REVALIDATE_SECRET ? { url: c.WEB_REVALIDATE_URL, secret: c.REVALIDATE_SECRET } : null,
})
