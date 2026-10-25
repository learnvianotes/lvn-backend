import type { ApiConfig } from '@lvn/contracts/config'
import type { UploadLimitConfig } from './application/scan-policy'

/** Where an upload is scanned (ADR-0041, ADR-0102). */
export type ScanConfig =
  | { mode: 'off' }
  | { mode: 'local'; clamav: { host: string; port: number } }
  | { mode: 'remote'; url: string; secret: string; timeoutMs: number }

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
  /** clamd beside this process (ADR-0041). Null unless scan.mode is local. */
  clamav: { host: string; port: number } | null
  /** ADR-0102. Unset SCAN_MODE keeps the old rule: CLAMAV_URL means local, otherwise off. */
  scan: ScanConfig
  /** Upload windows. An admin setting overrides these until it is reset. */
  uploadLimits: UploadLimitConfig
  /** The file-scan queue. Concurrency is how many scans the worker runs at once. */
  scanQueue: { concurrency: number; attempts: number }
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

export const notesConfigFrom = (c: ApiConfig): NotesConfig => {
  const scan = scanFrom(c)
  return {
    env: c.APP_ENV,
    bucket: c.S3_BUCKET,
    restrictedBucket: c.S3_RESTRICTED_BUCKET,
    revalidate: c.WEB_REVALIDATE_URL && c.REVALIDATE_SECRET ? { url: c.WEB_REVALIDATE_URL, secret: c.REVALIDATE_SECRET } : null,
    uploads: c.UPLOADS_ENABLED,
    clamav: scan.mode === 'local' ? scan.clamav : null,
    scan,
    uploadLimits: {
      perMinute: c.UPLOADS_PER_MINUTE,
      perDay: c.UPLOADS_PER_DAY,
      bytesPerDay: c.UPLOAD_BYTES_PER_DAY,
      pendingScans: c.UPLOAD_PENDING_SCANS,
      perIpPerMinute: c.UPLOADS_PER_IP_PER_MINUTE,
    },
    scanQueue: { concurrency: c.SCAN_QUEUE_CONCURRENCY, attempts: c.SCAN_JOB_ATTEMPTS },
    search: {
      provider: c.SEARCH_PROVIDER,
      typesense: c.TYPESENSE_URL && c.TYPESENSE_API_KEY ? { url: c.TYPESENSE_URL, apiKey: c.TYPESENSE_API_KEY, prefix: c.TYPESENSE_COLLECTION_PREFIX } : null,
      timeoutMs: c.SEARCH_TIMEOUT_MS,
      hybrid: c.SEARCH_HYBRID,
    },
  }
}

function scanFrom(c: ApiConfig): ScanConfig {
  const mode = c.SCAN_MODE ?? (c.CLAMAV_URL ? 'local' : 'off')
  if (mode === 'remote') return { mode: 'remote', url: c.SCANNER_URL ?? '', secret: c.SCANNER_SECRET ?? '', timeoutMs: c.SCANNER_TIMEOUT_MS }
  if (mode === 'local' && c.CLAMAV_URL) {
    const url = new URL(c.CLAMAV_URL)
    return { mode: 'local', clamav: { host: url.hostname, port: Number(url.port) } }
  }
  return { mode: 'off' }
}
