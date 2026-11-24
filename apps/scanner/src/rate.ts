/** Sliding window of request times for one caller. A refused request is not recorded. */
export class CallerRate {
  private readonly hits = new Map<string, number[]>()

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  /** Seconds until the caller may try again, or null when this request is allowed. */
  take(caller: string, now: number): number | null {
    const start = now - this.windowMs
    const recent = (this.hits.get(caller) ?? []).filter((at) => at > start)
    if (recent.length >= this.max) {
      this.hits.set(caller, recent)
      const oldest = recent[0] ?? now
      return Math.max(1, Math.ceil((oldest + this.windowMs - now) / 1000))
    }
    recent.push(now)
    this.hits.set(caller, recent)
    if (this.hits.size > 10_000) {
      for (const [key, times] of this.hits) if (times.every((at) => at <= start)) this.hits.delete(key)
    }
    return null
  }
}
