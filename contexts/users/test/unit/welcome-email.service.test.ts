import { ErrorCode } from '@lvn-backend/errors'
import { AuthService } from '../../src/application/auth.service'
import { RegistrationService } from '../../src/application/registration.service'
import { WelcomeEmailService } from '../../src/application/welcome-email.service'
import { STUDY_PUBLISHER_EMAIL } from '../../src/domain/study-publisher'
import { DEFAULT_TERMS_VERSION } from '../../src/domain/rules'

const WEB = 'https://app.learnvianotes.in'
const ADULT_LINES = ['Read and find notes', 'Write your own notes and share them', 'Join groups and classrooms']
const MINOR_LINES = ['Read and find notes', 'Write your own notes', 'Join groups and classrooms']

type Row = {
  id: string
  email: string
  displayName: string
  deletedAt: Date | null
  accountStatus: string
  registrationCompletedAt: Date | null
  welcomeEmailSentAt: Date | null
  dateOfBirth: Date | null
  declaredAge: number | null
  ageDeclaredAt: Date | null
  consents: { kind: string }[]
}

function row(over: Partial<Row> = {}): Row {
  return {
    id: 'user-1',
    email: 'asha@college.edu',
    displayName: 'Asha',
    deletedAt: null,
    accountStatus: 'ACTIVE',
    registrationCompletedAt: new Date('2026-11-06T00:00:00.000Z'),
    welcomeEmailSentAt: null,
    dateOfBirth: null,
    declaredAge: 20,
    ageDeclaredAt: new Date('2026-11-06T00:00:00.000Z'),
    consents: [{ kind: 'TERMS' }, { kind: 'PRIVACY' }, { kind: 'PUBLIC_CONTENT_LICENCE' }],
    ...over,
  }
}

function harness(initial: Partial<Row> = {}, queueAdd: (...args: unknown[]) => Promise<unknown> = async () => ({ id: 'job' })) {
  const stored = row(initial)
  const sent: unknown[][] = []
  let failSend = false
  const db = {
    user: {
      findUnique: async ({ where }: { where: { id: string } }) => (where.id === stored.id ? { ...stored, consents: stored.consents.map((c) => ({ ...c })) } : null),
      updateMany: async ({ where, data }: { where: { id: string; welcomeEmailSentAt?: Date | null; deletedAt?: null; accountStatus?: string; registrationCompletedAt?: { not: null } }; data: { welcomeEmailSentAt: Date | null } }) => {
        if (where.id !== stored.id) return { count: 0 }
        if ('welcomeEmailSentAt' in where) {
          const expected = where.welcomeEmailSentAt
          const actual = stored.welcomeEmailSentAt
          const same = expected === null ? actual === null : expected instanceof Date && actual instanceof Date && expected.getTime() === actual.getTime()
          if (!same) return { count: 0 }
        }
        if (where.deletedAt === null && stored.deletedAt !== null) return { count: 0 }
        if (where.accountStatus !== undefined && where.accountStatus !== stored.accountStatus) return { count: 0 }
        if (where.registrationCompletedAt && stored.registrationCompletedAt === null) return { count: 0 }
        stored.welcomeEmailSentAt = data.welcomeEmailSentAt
        return { count: 1 }
      },
    },
  }
  const service = new WelcomeEmailService(
    db as never,
    { queue: () => ({ add: queueAdd }) } as never,
    { send: async (...args: unknown[]) => { if (failSend) throw new Error('smtp down'); sent.push(args) } } as never,
    { consentAge: () => 18 } as never,
    { webUrl: `${WEB}/` } as never,
  )
  return { service, stored, sent, failSend: (v: boolean) => { failSend = v } }
}

describe('WelcomeEmailService', () => {
  it('sends once, greets by name, and does not send again', async () => {
    const { service, stored, sent } = harness()
    await expect(service.deliver('user-1')).resolves.toBe('sent')
    await expect(service.deliver('user-1')).resolves.toBe('skipped')
    expect(sent).toHaveLength(1)
    expect(sent[0]).toEqual(['asha@college.edu', 'welcome', { displayName: 'Asha', appLink: WEB, guideLink: `${WEB}/guide`, lines: ADULT_LINES }])
    expect(stored.welcomeEmailSentAt).toBeInstanceOf(Date)
    expect(stored.registrationCompletedAt).toEqual(new Date('2026-11-06T00:00:00.000Z'))
  })

  it('skips when the welcome was already sent', async () => {
    const claimed = new Date('2026-11-01T00:00:00.000Z')
    const { service, stored, sent } = harness({ welcomeEmailSentAt: claimed })
    await expect(service.deliver('user-1')).resolves.toBe('skipped')
    expect(sent).toEqual([])
    expect(stored.welcomeEmailSentAt).toBe(claimed)
  })

  it('releases the claim when the send fails so a retry can send, and leaves the profile in place', async () => {
    const { service, stored, sent, failSend } = harness()
    const completedAt = stored.registrationCompletedAt
    failSend(true)
    await expect(service.deliver('user-1')).rejects.toThrow('smtp down')
    expect(sent).toEqual([])
    expect(stored.welcomeEmailSentAt).toBeNull()
    expect(stored.registrationCompletedAt).toBe(completedAt)
    failSend(false)
    await expect(service.deliver('user-1')).resolves.toBe('sent')
    expect(sent).toHaveLength(1)
    expect(stored.welcomeEmailSentAt).toBeInstanceOf(Date)
  })

  it('skips an age-blocked, deleted, unfinished or publisher account, and a restricted minor is not offered public sharing', async () => {
    const blocked = harness({ accountStatus: 'AGE_BLOCKED' })
    await expect(blocked.service.deliver('user-1')).resolves.toBe('skipped')
    expect(blocked.sent).toEqual([])
    expect(blocked.stored.welcomeEmailSentAt).toBeNull()

    const deleted = harness({ deletedAt: new Date() })
    await expect(deleted.service.deliver('user-1')).resolves.toBe('skipped')
    expect(deleted.sent).toEqual([])

    const unfinished = harness({ registrationCompletedAt: null })
    await expect(unfinished.service.deliver('user-1')).resolves.toBe('skipped')

    const publisher = harness({ email: STUDY_PUBLISHER_EMAIL })
    await expect(publisher.service.deliver('user-1')).resolves.toBe('skipped')
    expect(publisher.sent).toEqual([])

    const noConsent = harness({ consents: [{ kind: 'TERMS' }] })
    await expect(noConsent.service.deliver('user-1')).resolves.toBe('skipped')
    expect(noConsent.sent).toEqual([])

    const minor = harness({ declaredAge: 16 })
    await expect(minor.service.deliver('user-1')).resolves.toBe('sent')
    expect(minor.sent[0]![2]).toMatchObject({ lines: MINOR_LINES })
  })

  it('queues one job id per user and does not throw when the queue rejects', async () => {
    const jobs: unknown[] = []
    const ok = harness({}, async (...args) => {
      jobs.push(args)
      return { id: 'job' }
    })
    await ok.service.schedule('user-1')
    await ok.service.schedule('user-1')
    expect(jobs).toEqual([
      ['welcome', { userId: 'user-1' }, { jobId: 'welcome-user-1' }],
      ['welcome', { userId: 'user-1' }, { jobId: 'welcome-user-1' }],
    ])

    const down = harness({}, async () => { throw new Error('redis down') })
    await expect(down.service.schedule('user-1')).resolves.toBeUndefined()
  })
})

describe('registration still completes when the welcome email cannot be queued', () => {
  function registration(add: () => Promise<unknown>) {
    const updates: unknown[] = []
    const db = {
      user: {
        findUniqueOrThrow: async () => ({ registrationCompletedAt: null }),
        update: (args: unknown) => {
          updates.push(args)
          return Promise.resolve({})
        },
      },
      consentRecord: { createMany: () => Promise.resolve({ count: 3 }) },
      $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
    }
    const welcome = new WelcomeEmailService(
      {} as never,
      { queue: () => ({ add }) } as never,
      {} as never,
      {} as never,
      { webUrl: WEB } as never,
    )
    const service = new RegistrationService(
      db as never,
      { check: async () => undefined } as never,
      { holdRegistration: async () => undefined } as never,
      { publish: async () => undefined } as never,
      { minimumAge: () => 18 } as never,
      { email: async () => 'support@learnvianotes.in' } as never,
      { current: () => DEFAULT_TERMS_VERSION } as never,
      welcome,
    )
    return { service, updates }
  }

  it('stores the name and age when the queue is down', async () => {
    const { service, updates } = registration(async () => { throw new Error('redis down') })
    await expect(service.complete('user-1', { displayName: 'Asha Rao', age: 20, acceptedTermsVersion: DEFAULT_TERMS_VERSION })).resolves.toBeUndefined()
    expect(updates).toEqual([
      { where: { id: 'user-1' }, data: { displayName: 'Asha Rao', declaredAge: 20, ageDeclaredAt: expect.any(Date), registrationCompletedAt: expect.any(Date) } },
    ])
  })

  it('does not queue a welcome for an age-blocked registration', async () => {
    const held = jest.fn(async () => undefined)
    let queued = 0
    const db = { user: { findUniqueOrThrow: async () => ({ registrationCompletedAt: null }) } }
    const welcome = new WelcomeEmailService({} as never, { queue: () => ({ add: async () => { queued += 1 } }) } as never, {} as never, {} as never, { webUrl: WEB } as never)
    const service = new RegistrationService(
      db as never,
      { check: async () => undefined } as never,
      { holdRegistration: held } as never,
      { publish: async () => undefined } as never,
      { minimumAge: () => 18 } as never,
      { email: async () => 'support@learnvianotes.in' } as never,
      { current: () => DEFAULT_TERMS_VERSION } as never,
      welcome,
    )
    await expect(service.complete('user-1', { displayName: 'Young One', age: 14, acceptedTermsVersion: DEFAULT_TERMS_VERSION })).rejects.toMatchObject({ code: ErrorCode.AGE_RESTRICTED })
    expect(held).toHaveBeenCalled()
    expect(queued).toBe(0)
  })
})

describe('sign-up still completes when the welcome email cannot be queued', () => {
  it('creates the account and returns a session when the queue is down', async () => {
    const created: unknown[] = []
    let queued = 0
    const tx = {
      user: {
        create: async (args: { data: unknown }) => { created.push(args.data) },
        findUnique: async () => null,
      },
      consentRecord: { createMany: async () => ({ count: 3 }) },
    }
    const welcome = new WelcomeEmailService(
      {} as never,
      { queue: () => ({ add: async () => { queued += 1; throw new Error('redis down') } }) } as never,
      {} as never,
      {} as never,
      { webUrl: WEB } as never,
    )
    const service = new AuthService(
      { user: { findUnique: async () => null }, emailToken: { create: async () => ({}) }, $transaction: async (fn: (client: typeof tx) => Promise<void>) => fn(tx) } as never,
      { assertAcceptable: async () => undefined, hash: async () => 'hashed' } as never,
      { start: async () => ({ userId: 'created', accessToken: 'a' }) } as never,
      {} as never,
      { check: async () => undefined, start: async () => undefined } as never,
      { match: async () => undefined } as never,
      { send: async () => undefined } as never,
      { publish: async () => undefined } as never,
      { webUrl: WEB } as never,
      { minimumAge: () => 18 } as never,
      { assertAllowed: async () => undefined, roleFor: async () => 'STUDENT' } as never,
      { holdSignUp: async () => undefined } as never,
      { email: async () => 'support@learnvianotes.in' } as never,
      { current: () => DEFAULT_TERMS_VERSION } as never,
      welcome,
    )
    await expect(service.signUp(
      { email: 'asha@college.edu', password: 'correct horse battery staple', displayName: 'Asha Rao', age: 20, acceptedTermsVersion: DEFAULT_TERMS_VERSION },
      { client: 'web' },
    )).resolves.toMatchObject({ status: 'created' })
    expect(queued).toBe(1)
    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({ email: 'asha@college.edu', displayName: 'Asha Rao', declaredAge: 20, registrationCompletedAt: expect.any(Date) })
    expect(created[0]).not.toHaveProperty('welcomeEmailSentAt')
  })

  it('does not queue a welcome for an under-age sign-up', async () => {
    let queued = 0
    const hold = jest.fn(async () => undefined)
    const welcome = new WelcomeEmailService({} as never, { queue: () => ({ add: async () => { queued += 1 } }) } as never, {} as never, {} as never, { webUrl: WEB } as never)
    const service = new AuthService(
      { user: { findUnique: async () => null } } as never,
      { assertAcceptable: async () => undefined, hash: async () => 'hashed' } as never,
      { start: jest.fn() } as never,
      {} as never,
      { check: async () => undefined } as never,
      { match: async () => undefined } as never,
      { send: async () => undefined } as never,
      { publish: async () => undefined } as never,
      { webUrl: WEB } as never,
      { minimumAge: () => 18 } as never,
      { assertAllowed: async () => undefined, roleFor: async () => 'STUDENT' } as never,
      { holdSignUp: hold } as never,
      { email: async () => 'support@learnvianotes.in' } as never,
      { current: () => DEFAULT_TERMS_VERSION } as never,
      welcome,
    )
    await expect(service.signUp(
      { email: 'young@example.com', password: 'correct horse battery staple', displayName: 'Young One', age: 14, acceptedTermsVersion: DEFAULT_TERMS_VERSION },
      { client: 'web' },
    )).rejects.toMatchObject({ code: ErrorCode.AGE_RESTRICTED })
    expect(hold).toHaveBeenCalled()
    expect(queued).toBe(0)
  })
})
