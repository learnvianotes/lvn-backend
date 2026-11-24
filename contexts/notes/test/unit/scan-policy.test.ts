import { exponentialBackoffMs, fairPriority, ScanCircuitGate, uploadRefusal, UPLOAD_LIMIT_DEFAULTS } from '../../src/application/scan-policy'

const limits = { ...UPLOAD_LIMIT_DEFAULTS }
const open = { allowed: true, retryAfter: 0 }

describe('scan backoff and fairness', () => {
  it('spreads an exponential retry by up to 20 percent', () => {
    expect(exponentialBackoffMs(1, 15_000, 0.2, 0)).toBe(12_000)
    expect(exponentialBackoffMs(1, 15_000, 0.2, 0.999)).toBe(14_997)
    expect(exponentialBackoffMs(3, 15_000, 0.2, 0)).toBe(48_000)
    expect(exponentialBackoffMs(4, 15_000, 0, 0.4)).toBe(120_000)
  })

  it('gives a user a worse priority for each file already waiting', () => {
    expect(fairPriority(1)).toBe(1)
    expect(fairPriority(2)).toBe(2)
    expect(fairPriority(0)).toBe(1)
    expect(fairPriority(5_000_000)).toBe(1_000_000)
  })
})

describe('upload limits', () => {
  it('allows an attempt inside every window', () => {
    expect(uploadRefusal({ minute: open, day: open, bytes: open, ip: open, pending: 4 }, limits)).toBeNull()
  })

  it('names the window that was hit and keeps the longest retry', () => {
    const refusal = uploadRefusal(
      {
        minute: { allowed: false, retryAfter: 12 },
        day: { allowed: false, retryAfter: 4000 },
        bytes: open,
        ip: { allowed: false, retryAfter: 3 },
        pending: 0,
      },
      limits,
    )
    expect(refusal).toEqual({ retryAfter: 4000, message: 'You can upload 100 files a day. Try again in 4000 seconds.' })
  })

  it('refuses another upload while twelve scans are still waiting', () => {
    const refusal = uploadRefusal({ minute: { allowed: false, retryAfter: 30 }, day: open, bytes: open, ip: open, pending: 12 }, limits)
    expect(refusal?.retryAfter).toBe(60)
    expect(refusal?.message).toMatch(/12 files waiting/)
  })

  it('refuses a network that has used its upload URLs', () => {
    const refusal = uploadRefusal({ minute: open, day: open, bytes: open, ip: { allowed: false, retryAfter: 8 }, pending: 0 }, limits)
    expect(refusal?.message).toMatch(/this network/)
    expect(refusal?.retryAfter).toBe(8)
  })
})

describe('scan circuit gate', () => {
  it('pauses while the circuit is open and resumes when it closes', async () => {
    let paused = false
    const queue = {
      pause: async () => {
        paused = true
      },
      resume: async () => {
        paused = false
      },
      isPaused: async () => paused,
    }
    let now = 1_000
    const gate = new ScanCircuitGate(queue, () => now)
    await gate.sync(5_000)
    expect(paused).toBe(true)
    now = 5_000
    await gate.sync(5_000)
    expect(paused).toBe(false)
  })
})
