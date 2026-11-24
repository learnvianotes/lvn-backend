/** BullMQ queue for one remote scan per uploaded file (ADR-0102). */
export const FILE_SCAN_QUEUE = 'file-scan'
/** Jobs that used up their attempts. Nothing processes this queue. */
export const FILE_SCAN_DLQ = 'file-scan-dlq'

export const SCAN_JOB_ATTEMPTS = 5
/** First retry waits about 5s, then 10s, 20s, 40s, each reduced by up to 20%: a phone upload is not left waiting minutes. */
export const SCAN_BACKOFF_BASE_MS = 5_000
export const SCAN_BACKOFF_JITTER = 0.2
export const SCAN_QUEUE_CONCURRENCY = 4

export const UPLOAD_LIMIT_DEFAULTS = {
  perMinute: 10,
  perDay: 100,
  bytesPerDay: 500 * 1024 * 1024,
  /** At least QuickNoteLimits.files (10), so one quick note of photos and PDFs is never refused halfway. */
  pendingScans: 12,
  perIpPerMinute: 30,
} as const

export interface UploadLimitConfig {
  perMinute: number
  perDay: number
  bytesPerDay: number
  pendingScans: number
  perIpPerMinute: number
}

export interface WindowResult {
  allowed: boolean
  retryAfter: number
}

/**
 * The same curve BullMQ uses for `backoff: { type: 'exponential', delay, jitter }`:
 * `floor(random * max * jitter + max * (1 - jitter))` with `max = round(base * 2^(attempt-1))`.
 * `random` is in `[0, 1)`.
 */
export function exponentialBackoffMs(attempt: number, baseMs: number, jitter: number, random: number): number {
  const max = Math.round(2 ** (attempt - 1) * baseMs)
  const span = max * jitter
  return Math.floor(random * span + max * (1 - jitter))
}

/**
 * BullMQ runs a lower priority number first. A user's nth file waiting for a scan gets priority n, so another
 * user's first file is not stuck behind the rest of a bulk upload.
 */
export function fairPriority(queuedForUser: number): number {
  if (!Number.isInteger(queuedForUser) || queuedForUser < 1) return 1
  return Math.min(queuedForUser, 1_000_000)
}

/** Which upload limit, if any, refuses this attempt. Pending scans win over the windows. */
export function uploadRefusal(
  input: {
    minute: WindowResult
    day: WindowResult
    bytes: WindowResult
    ip: WindowResult
    pending: number
  },
  limits: UploadLimitConfig,
): { retryAfter: number; message: string } | null {
  if (input.pending >= limits.pendingScans) {
    return {
      retryAfter: 60,
      message: `You already have ${limits.pendingScans} files waiting to be scanned. Try again in 60 seconds.`,
    }
  }
  const hits = [
    !input.minute.allowed ? { retryAfter: input.minute.retryAfter, message: `You can upload ${limits.perMinute} files a minute. Try again in ${input.minute.retryAfter} seconds.` } : null,
    !input.day.allowed ? { retryAfter: input.day.retryAfter, message: `You can upload ${limits.perDay} files a day. Try again in ${input.day.retryAfter} seconds.` } : null,
    !input.bytes.allowed
      ? { retryAfter: input.bytes.retryAfter, message: `You can upload ${Math.round(limits.bytesPerDay / (1024 * 1024))} MB a day. Try again in ${input.bytes.retryAfter} seconds.` }
      : null,
    !input.ip.allowed ? { retryAfter: input.ip.retryAfter, message: `Too many uploads from this network. Try again in ${input.ip.retryAfter} seconds.` } : null,
  ].filter((hit): hit is { retryAfter: number; message: string } => hit !== null)
  if (!hits.length) return null
  return hits.reduce((left, right) => (left.retryAfter >= right.retryAfter ? left : right))
}

/** Pauses a queue while `openUntil` is in the future and resumes it once that time has passed. */
export class ScanCircuitGate {
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(
    private readonly queue: { pause(): Promise<void>; resume(): Promise<void>; isPaused(): Promise<boolean> },
    private readonly now: () => number = Date.now,
  ) {}

  async sync(openUntil: number): Promise<void> {
    if (this.now() < openUntil) {
      await this.queue.pause()
      this.arm(openUntil)
      return
    }
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    if (await this.queue.isPaused()) await this.queue.resume()
  }

  private arm(until: number): void {
    if (this.timer) clearTimeout(this.timer)
    const wait = Math.max(0, until - this.now())
    this.timer = setTimeout(() => void this.sync(0), wait)
    this.timer.unref?.()
  }
}
