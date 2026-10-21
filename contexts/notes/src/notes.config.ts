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
  /** ADR-0097: people may upload files; false refuses every upload intent */
  uploads: boolean
  /** clamd for scanning uploads (ADR-0041); null: not scanned */
  clamav: { host: string; port: number } | null
  /** Search (ADR-0055): who answers, and Typesense when configured (the worker keeps it whichever answers) */
  search: {
    provider: 'postgres' | 'typesense'
    typesense: { url: string; apiKey: string; prefix: string } | null
    timeoutMs: number
    /** ADR-0057: fuse keyword and semantic ranks, once a semantic source is bound */
    hybrid: boolean
  }
}

export const NOTES_CONFIG = Symbol('NOTES_CONFIG')

export const notesConfigFrom = (c: ApiConfig): NotesConfig => ({
  env: c.APP_ENV,
  bucket: c.S3_BUCKET,
  restrictedBucket: c.S3_RESTRICTED_BUCKET,
  revalidate: c.WEB_REVALIDATE_URL && c.REVALIDATE_SECRET ? { url: c.WEB_REVALIDATE_URL, secret: c.REVALIDATE_SECRET } : null,
  uploads: c.UPLOADS_ENABLED,
  clamav: c.CLAMAV_URL ? { host: new URL(c.CLAMAV_URL).hostname, port: Number(new URL(c.CLAMAV_URL).port) } : null,
  search: {
    provider: c.SEARCH_PROVIDER,
    typesense: c.TYPESENSE_URL && c.TYPESENSE_API_KEY ? { url: c.TYPESENSE_URL, apiKey: c.TYPESENSE_API_KEY, prefix: c.TYPESENSE_COLLECTION_PREFIX } : null,
    timeoutMs: c.SEARCH_TIMEOUT_MS,
    hybrid: c.SEARCH_HYBRID,
  },
})
