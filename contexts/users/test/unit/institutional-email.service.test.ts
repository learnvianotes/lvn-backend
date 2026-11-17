import { ErrorCode, type AppError } from '@lvn-backend/errors'
import { CODE_TTL_MINUTES, CODES_PER_NETWORK_PER_HOUR, InstitutionalEmailService, MAX_CODE_ATTEMPTS } from '../../src/application/institutional-email.service'

const USER = 'user-1'
const HOUR_MS = 60 * 60 * 1000

interface EmailRow {
  id: string
  userId: string
  email: string
  domain: string
  organizationId: string | null
  codeHash: Uint8Array | null
  codeExpiresAt: Date | null
  attempts: number
  verifiedAt: Date | null
  replacedAt: Date | null
  createdAt: Date
}

interface OrgRow {
  id: string
  name: string
  emailDomains: string[]
}

interface ReviewRow {
  domain: string
  status: string
  requests: number
}

interface MembershipRow {
  userId: string
  organizationId: string
  role: string
}

interface SentMail {
  to: string
  template: string
  data: { displayName: string; code: string; expiresInMinutes: number }
}

/** A Prisma-shaped thenable that runs only when awaited, so an array transaction stays ordered. */
function query<T>(run: () => T): Promise<T> {
  const promise = {
    then(onOk?: (value: T) => unknown, onErr?: (reason: unknown) => unknown) {
      return Promise.resolve().then(run).then(onOk, onErr)
    },
  }
  return promise as Promise<T>
}

function matches(value: unknown, expected: unknown): boolean {
  if (expected === null || typeof expected !== 'object' || expected instanceof Date || expected instanceof Uint8Array) return value === expected
  const cond = expected as Record<string, unknown>
  if ('not' in cond) return cond.not === null ? value != null : value !== cond.not
  if ('in' in cond) return (cond.in as unknown[]).includes(value)
  if ('hasSome' in cond) return (cond.hasSome as unknown[]).some((item) => (value as unknown[] | undefined)?.includes(item))
  throw new Error(`unsupported filter ${JSON.stringify(expected)}`)
}

function whereMatch(row: object, where?: Record<string, unknown>): boolean {
  if (!where) return true
  return Object.entries(where).every(([key, expected]) => matches((row as Record<string, unknown>)[key], expected))
}

function apply(row: object, data: Record<string, unknown>) {
  const target = row as Record<string, unknown>
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object' && !(value instanceof Date) && !(value instanceof Uint8Array) && 'increment' in value) {
      target[key] = (target[key] as number) + (value as { increment: number }).increment
    } else target[key] = value
  }
}

function project<T extends object>(row: T, select?: Record<string, boolean>): T {
  if (!select) return { ...row }
  const out: Record<string, unknown> = {}
  for (const [key, keep] of Object.entries(select)) if (keep) out[key] = (row as Record<string, unknown>)[key]
  return out as T
}

function harness(opts: { acceptsMail?: (domain: string) => boolean; orgs?: OrgRow[]; reviews?: ReviewRow[] } = {}) {
  const emails: EmailRow[] = []
  const orgs: OrgRow[] = opts.orgs ?? []
  const reviews: ReviewRow[] = opts.reviews ?? []
  const memberships: MembershipRow[] = []
  const sent: SentMail[] = []
  const lookedUp: string[] = []
  const limiterCalls: { key: string; limit: { max: number; windowSeconds: number } }[] = []
  const hits = new Map<string, number[]>()
  const events: { name: string; payload: unknown }[] = []
  const user: { id: string; displayName: string; verifiedAt: Date | null; verificationMethod: string | null } = {
    id: USER,
    displayName: 'Asha Rao',
    verifiedAt: null,
    verificationMethod: null,
  }

  const emailsApi = {
    findFirst: (args: { where?: Record<string, unknown>; select?: Record<string, boolean> }) =>
      query(() => {
        const found = emails.find((row) => whereMatch(row, args.where))
        return found ? project(found, args.select) : null
      }),
    findMany: (args: { where?: Record<string, unknown>; include?: { organization?: { select: { name: boolean } } }; orderBy?: { createdAt?: 'asc' | 'desc' } }) =>
      query(() => {
        let rows = emails.filter((row) => whereMatch(row, args.where))
        if (args.orderBy?.createdAt === 'desc') rows = [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        if (!args.include?.organization) return rows
        return rows.map((row) => {
          const org = orgs.find((item) => item.id === row.organizationId)
          return { ...row, organization: org ? { name: org.name } : null }
        })
      }),
    deleteMany: (args: { where?: Record<string, unknown> }) =>
      query(() => {
        const kept = emails.filter((row) => !whereMatch(row, args.where))
        const count = emails.length - kept.length
        emails.splice(0, emails.length, ...kept)
        return { count }
      }),
    create: (args: { data: Partial<EmailRow> }) =>
      query(() => {
        const row: EmailRow = {
          attempts: 0,
          verifiedAt: null,
          replacedAt: null,
          createdAt: new Date(),
          organizationId: null,
          codeHash: null,
          codeExpiresAt: null,
          id: '',
          userId: '',
          email: '',
          domain: '',
          ...args.data,
        }
        emails.push(row)
        return row
      }),
    update: (args: { where: { id: string }; data: Record<string, unknown>; select?: Record<string, boolean> }) =>
      query(() => {
        const row = emails.find((item) => item.id === args.where.id)
        if (!row) throw new Error(`no institutional email ${args.where.id}`)
        apply(row, args.data)
        return project(row, args.select)
      }),
    updateMany: (args: { where?: Record<string, unknown>; data: Record<string, unknown> }) =>
      query(() => {
        let count = 0
        for (const row of emails) {
          if (!whereMatch(row, args.where)) continue
          apply(row, args.data)
          count++
        }
        return { count }
      }),
  }

  const db = {
    institutionalEmail: emailsApi,
    organization: {
      findFirst: (args: { where?: Record<string, unknown>; select?: Record<string, boolean> }) =>
        query(() => {
          const found = orgs.find((row) => whereMatch(row, args.where))
          return found ? project(found, args.select) : null
        }),
    },
    domainReview: {
      findMany: (args: { where?: Record<string, unknown>; select?: Record<string, boolean> }) =>
        query(() => reviews.filter((row) => whereMatch(row, args.where)).map((row) => project(row, args.select))),
      upsert: (args: { where: { domain: string }; create: Partial<ReviewRow>; update: Record<string, unknown> }) =>
        query(() => {
          const existing = reviews.find((row) => row.domain === args.where.domain)
          if (existing) {
            apply(existing, args.update)
            return existing
          }
          const row: ReviewRow = { domain: args.where.domain, status: 'NEEDS_REVIEW', requests: 1, ...args.create }
          reviews.push(row)
          return row
        }),
    },
    user: {
      findUniqueOrThrow: () => query(() => user),
      update: (args: { data: Record<string, unknown> }) =>
        query(() => {
          apply(user, args.data)
          return user
        }),
    },
    membership: {
      findUnique: (args: { where: { userId_organizationId: { userId: string; organizationId: string } } }) =>
        query(() => memberships.find((row) => row.userId === args.where.userId_organizationId.userId && row.organizationId === args.where.userId_organizationId.organizationId) ?? null),
      count: (args: { where?: Record<string, unknown> }) => query(() => memberships.filter((row) => whereMatch(row, args.where)).length),
      upsert: (args: { where: { userId_organizationId: { userId: string; organizationId: string } }; create: MembershipRow }) =>
        query(() => {
          const key = args.where.userId_organizationId
          const existing = memberships.find((row) => row.userId === key.userId && row.organizationId === key.organizationId)
          if (existing) return existing
          memberships.push({ ...args.create })
          return memberships.at(-1)
        }),
    },
    $transaction: async (work: ((tx: unknown) => Promise<unknown>) | Promise<unknown>[]) => {
      if (typeof work === 'function') return work(db)
      const out = []
      for (const item of work) out.push(await item)
      return out
    },
  }

  const limiter = {
    hit: async (key: string, limit: { max: number; windowSeconds: number }, now = Date.now()) => {
      limiterCalls.push({ key, limit: { ...limit } })
      const windowMs = limit.windowSeconds * 1000
      const prev = (hits.get(key) ?? []).filter((at) => now - at < windowMs)
      if (prev.length >= limit.max) {
        const oldest = Math.min(...prev)
        return { allowed: false, retryAfter: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)), remaining: 0 }
      }
      prev.push(now)
      hits.set(key, prev)
      return { allowed: true, retryAfter: 0, remaining: limit.max - prev.length }
    },
  }

  const service = new InstitutionalEmailService(
    db as never,
    limiter as never,
    { send: async (to: string, template: string, data: SentMail['data']) => void sent.push({ to, template, data }) } as never,
    { publish: async (name: string, payload: unknown) => void events.push({ name, payload }) } as never,
    {
      acceptsMail: async (domain: string) => {
        lookedUp.push(domain)
        return opts.acceptsMail?.(domain) ?? true
      },
    },
    { codeHmacSecret: 'test-hmac-secret' } as never,
    { limit: async () => null } as never,
  )

  const code = () => sent.at(-1)!.data.code
  return { service, emails, orgs, reviews, memberships, sent, lookedUp, limiterCalls, events, user, code }
}

function rejection(run: () => Promise<unknown>): Promise<AppError> {
  return run().then(
    () => Promise.reject(new Error('expected a rejection')),
    (error: AppError) => error,
  )
}

describe('InstitutionalEmailService', () => {
  it('refuses a personal domain', async () => {
    const h = harness()
    const error = await rejection(() => h.service.start(USER, 'Person@Gmail.com'))
    expect(error).toMatchObject({ code: ErrorCode.VALIDATION, message: 'Use your college or organisation email, not a personal one.', field: ['input', 'institutionalEmail'] })
    expect(h.emails).toEqual([])
    expect(h.sent).toEqual([])
    expect(h.limiterCalls).toEqual([])
  })

  it('refuses a disposable domain', async () => {
    const h = harness()
    const error = await rejection(() => h.service.start(USER, 'A@Mailinator.com'))
    expect(error).toMatchObject({ code: ErrorCode.VALIDATION, message: 'Use your college or organisation email, not a personal one.', field: ['input', 'institutionalEmail'] })
    expect(h.emails).toEqual([])
    expect(h.sent).toEqual([])
  })

  it('refuses a domain with no MX record', async () => {
    const h = harness({ acceptsMail: () => false })
    const error = await rejection(() => h.service.start(USER, 'Person@No-Mx-College.com'))
    expect(error).toMatchObject({ code: ErrorCode.VALIDATION, message: 'This domain does not receive email. Check the address.', field: ['input', 'institutionalEmail'] })
    expect(h.lookedUp).toEqual(['no-mx-college.com'])
    expect(h.emails).toEqual([])
    expect(h.sent).toEqual([])
  })

  it('expires the code after 15 minutes', async () => {
    jest.useFakeTimers({ now: new Date('2026-11-01T12:00:00.000Z') })
    try {
      const h = harness()
      await h.service.start(USER, 'person@expire-test.com')
      expect(h.sent[0]).toMatchObject({ template: 'institutionalCode', data: { expiresInMinutes: CODE_TTL_MINUTES } })
      expect(CODE_TTL_MINUTES).toBe(15)
      expect(h.emails[0]!.codeExpiresAt!.getTime()).toBe(Date.now() + 15 * 60_000)
      const wrong = h.code() === '000000' ? '000001' : '000000'
      jest.setSystemTime(Date.now() + 15 * 60_000 - 1)
      expect((await rejection(() => h.service.verify(USER, wrong))).message).toMatch(/not right/)
      jest.setSystemTime(Date.now() + 1)
      const expired = await rejection(() => h.service.verify(USER, h.code()))
      expect(expired).toMatchObject({ code: ErrorCode.VALIDATION, message: 'This code has expired. Ask for a new one.', field: ['input', 'code'] })
      expect(h.user.verifiedAt).toBeNull()
    } finally {
      jest.useRealTimers()
    }
  })

  it('locks the code after 5 wrong attempts', async () => {
    const h = harness()
    await h.service.start(USER, 'person@attempt-test.com')
    const correct = h.code()
    const wrong = correct === '000000' ? '000001' : '000000'
    expect(MAX_CODE_ATTEMPTS).toBe(5)
    for (let attempt = 1; attempt <= 4; attempt++) {
      const left = 5 - attempt
      const error = await rejection(() => h.service.verify(USER, wrong))
      expect(error.message).toBe(`That code is not right. ${left} ${left === 1 ? 'try' : 'tries'} left.`)
    }
    expect((await rejection(() => h.service.verify(USER, wrong))).message).toBe('Too many wrong codes. Ask for a new one.')
    const locked = await rejection(() => h.service.verify(USER, correct))
    expect(locked).toMatchObject({ code: ErrorCode.VALIDATION, message: 'Too many wrong codes. Ask for a new one.', field: ['input', 'code'] })
    expect(h.user.verifiedAt).toBeNull()
    expect(h.emails[0]!.attempts).toBe(5)
  })

  it('allows only 3 sends per hour', async () => {
    jest.useFakeTimers({ now: new Date('2026-11-01T12:00:00.000Z') })
    try {
      const h = harness()
      await h.service.start(USER, 'person@send-limit.com')
      await h.service.resend(USER)
      await h.service.resend(USER)
      expect(h.sent).toHaveLength(3)
      const blocked = await rejection(() => h.service.resend(USER))
      expect(blocked).toMatchObject({ code: ErrorCode.RATE_LIMITED, message: 'You can ask for 3 codes an hour. Try again later.' })
      expect(blocked.retryAfter).toBeGreaterThan(0)
      expect(h.sent).toHaveLength(3)
      expect(h.limiterCalls).toEqual([
        { key: `instcode:${USER}`, limit: { max: 3, windowSeconds: 3600 } },
        { key: `instcode:${USER}`, limit: { max: 3, windowSeconds: 3600 } },
        { key: `instcode:${USER}`, limit: { max: 3, windowSeconds: 3600 } },
        { key: `instcode:${USER}`, limit: { max: 3, windowSeconds: 3600 } },
      ])
      jest.setSystemTime(Date.now() + HOUR_MS)
      await h.service.resend(USER)
      expect(h.sent).toHaveLength(4)
    } finally {
      jest.useRealTimers()
    }
  })

  it('verifies the account when the domain belongs to a known organisation', async () => {
    const h = harness({ orgs: [{ id: 'org-1', name: 'Acme Institute', emailDomains: ['acme.com'] }] })
    await h.service.start(USER, 'Rao@Eng.Acme.com')
    expect(h.reviews).toEqual([])
    const result = await h.service.verify(USER, h.code())
    expect(result).toEqual({ verified: true, pendingReview: false })
    expect(h.user.verifiedAt).toBeInstanceOf(Date)
    expect(h.user.verificationMethod).toBe('INSTITUTIONAL_EMAIL')
    expect(h.memberships).toEqual([{ userId: USER, organizationId: 'org-1', role: 'STUDENT' }])
    expect(h.events).toEqual([{ name: 'InstitutionVerified', payload: { userId: USER, method: 'INSTITUTIONAL_EMAIL', organizationId: 'org-1' } }])
    expect(await h.service.statusOf(USER)).toEqual({ email: 'rao@eng.acme.com', status: 'CONFIRMED', institution: { name: 'Acme Institute', verified: true } })
  })

  it('verifies the account for an academic suffix', async () => {
    const h = harness()
    await h.service.start(USER, 'student@stanford.edu')
    expect(h.reviews).toEqual([expect.objectContaining({ domain: 'stanford.edu', status: 'ACADEMIC_QUEUED' })])
    const result = await h.service.verify(USER, h.code())
    expect(result).toEqual({ verified: true, pendingReview: false })
    expect(h.user).toMatchObject({ verificationMethod: 'INSTITUTIONAL_EMAIL' })
    expect(h.user.verifiedAt).toBeInstanceOf(Date)
    expect(h.memberships).toEqual([])
    expect(h.events).toEqual([{ name: 'InstitutionVerified', payload: { userId: USER, method: 'INSTITUTIONAL_EMAIL' } }])
    expect(await h.service.statusOf(USER)).toEqual({ email: 'student@stanford.edu', status: 'CONFIRMED', institution: null })
  })

  it('verifies the account when a domain review is approved', async () => {
    const h = harness({ reviews: [{ domain: 'widgets.io', status: 'APPROVED', requests: 1 }] })
    await h.service.start(USER, 'person@widgets.io')
    expect(h.reviews).toEqual([expect.objectContaining({ domain: 'widgets.io', status: 'APPROVED', requests: 2 })])
    const result = await h.service.verify(USER, h.code())
    expect(result).toEqual({ verified: true, pendingReview: false })
    expect(h.user.verifiedAt).toBeInstanceOf(Date)
    expect(h.user.verificationMethod).toBe('INSTITUTIONAL_EMAIL')
    expect(await h.service.statusOf(USER)).toEqual({ email: 'person@widgets.io', status: 'CONFIRMED', institution: null })
  })

  it('sends an unknown domain to NEEDS_REVIEW', async () => {
    const h = harness()
    await h.service.start(USER, 'person@widgets.io')
    expect(h.reviews).toEqual([expect.objectContaining({ domain: 'widgets.io', status: 'NEEDS_REVIEW', requests: 1 })])
    const result = await h.service.verify(USER, h.code())
    expect(result).toEqual({ verified: false, pendingReview: true })
    expect(h.user.verifiedAt).toBeNull()
    expect(h.user.verificationMethod).toBeNull()
    expect(h.events).toEqual([])
    expect(h.emails[0]!.verifiedAt).toBeInstanceOf(Date)
    expect(await h.service.statusOf(USER)).toEqual({ email: 'person@widgets.io', status: 'PENDING_REVIEW', institution: null })
  })

  it('allows 30 codes an hour from one network, then refuses, and another network still sends', async () => {
    const h = harness()
    for (let i = 0; i < CODES_PER_NETWORK_PER_HOUR.max; i++) {
      await h.service.start(`user-${i}`, `person${i}@net-cap.edu`, ['input', 'institutionalEmail'], '203.0.113.30')
    }
    const blocked = await rejection(() => h.service.start('user-blocked', 'blocked@net-cap.edu', ['input', 'institutionalEmail'], '203.0.113.30'))
    expect(blocked).toMatchObject({ code: ErrorCode.RATE_LIMITED })
    expect(blocked.message).toMatch(/from your network/)
    expect(blocked.retryAfter).toBeGreaterThan(0)
    const before = h.sent.length
    await h.service.start('user-other', 'other@net-cap.edu', ['input', 'institutionalEmail'], '198.51.100.30')
    expect(h.sent.length).toBe(before + 1)
    expect(h.limiterCalls.filter((call) => call.key.startsWith('instcode-net:'))).toEqual(
      expect.arrayContaining([
        { key: 'instcode-net:203.0.113.30', limit: CODES_PER_NETWORK_PER_HOUR },
        { key: 'instcode-net:198.51.100.30', limit: CODES_PER_NETWORK_PER_HOUR },
      ]),
    )
  })
})
