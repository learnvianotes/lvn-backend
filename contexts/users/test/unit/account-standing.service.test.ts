import { generateKeyPairSync } from 'node:crypto'
import { ErrorCode, type AppError } from '@lvn-backend/errors'
import { AccountDeletionService } from '../../src/application/account-deletion.service'
import { AuthService } from '../../src/application/auth.service'
import { RegistrationService } from '../../src/application/registration.service'
import { SessionService } from '../../src/application/session.service'
import { ageRestrictedError, refusalError } from '../../src/domain/account-status'
import { ageOn, DEFAULT_TERMS_VERSION } from '../../src/domain/rules'

const SUPPORT = 'support@learnvianotes.in'
const ADMIN_EMAIL = 'earliest-admin@learnvianotes.in'
const pem = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' }) as string

function rejection(run: () => Promise<unknown>): Promise<AppError> {
  return run().then(
    () => Promise.reject(new Error('expected a rejection')),
    (e: AppError) => e,
  )
}

describe('sign-in refusal', () => {
  it('returns AGE_RESTRICTED with the support address, and a blocked sign-in as validation', () => {
    const age = refusalError('AGE_BLOCKED', SUPPORT, ['input', 'dateOfBirth'])
    expect(age).toMatchObject({ code: ErrorCode.AGE_RESTRICTED, supportEmail: SUPPORT, field: ['input', 'dateOfBirth'] })
    expect(age!.message).toMatch(/Contact an admin at support@learnvianotes\.in/)
    expect(refusalError('BLOCKED', SUPPORT)).toMatchObject({ code: ErrorCode.VALIDATION, supportEmail: SUPPORT })
    expect(refusalError('SUSPENDED', SUPPORT)!.message).toMatch(/blocked/)
    expect(refusalError('ACTIVE', SUPPORT)).toBeNull()
    expect(ageRestrictedError(SUPPORT).code).toBe(ErrorCode.AGE_RESTRICTED)
  })
})

describe('AuthService age gate', () => {
  function auth(opts: { hold?: jest.Mock; minimum?: number; start?: jest.Mock; verify?: (hash: string | null, password: string) => Promise<boolean> } = {}) {
    const hold = opts.hold ?? jest.fn(async () => undefined)
    const start = opts.start ?? jest.fn(async () => ({ userId: 'u', accessToken: 'a', accessTokenExpiresAt: new Date(), refreshToken: 'r', refreshTokenExpiresAt: new Date() }))
    const service = new AuthService(
      { user: { findUnique: async () => ({ id: 'u', email: 'asha@example.com', passwordHash: 'hash', deletedAt: null, emailVerifiedAt: null }) } } as never,
      {
        assertAcceptable: async () => undefined,
        hash: async () => 'hashed-password',
        verify: opts.verify ?? (async () => true),
        needsRehash: () => false,
      } as never,
      { start } as never,
      { peek: async () => ({ allowed: true }), hit: async () => ({ allowed: true }), reset: async () => undefined } as never,
      { check: async () => undefined } as never,
      { match: async () => undefined } as never,
      {} as never,
      {} as never,
      { supportEmail: SUPPORT } as never,
      { minimumAge: () => opts.minimum ?? 18 } as never,
      { assertAllowed: async () => undefined, roleFor: async () => 'STUDENT' } as never,
      { holdSignUp: hold } as never,
      { email: async () => ADMIN_EMAIL } as never,
      { current: () => DEFAULT_TERMS_VERSION } as never,
      { schedule: async () => undefined } as never,
    )
    return { service, hold, start }
  }

  const input = {
    email: 'young@example.com',
    password: 'correct horse battery staple',
    displayName: 'Young One',
    age: 14,
    acceptedTermsVersion: DEFAULT_TERMS_VERSION,
  }

  it('treats a configured floor of 8 as 13: 13 and 17 pass the gate, and 12 is held (ADR-0113)', async () => {
    for (const age of [13, 17]) {
      const { service, hold, start } = auth({ minimum: 8 })
      const err = await rejection(() => service.signUp({ ...input, age }, { client: 'web' }))
      // The stand-in already has this address, so a passing age is the usual "sign in instead" answer.
      expect(err.code).toBe(ErrorCode.CONFLICT)
      expect(hold).not.toHaveBeenCalled()
      expect(start).not.toHaveBeenCalled()
    }
    const blocked = auth({ minimum: 8 })
    const err = await rejection(() => blocked.service.signUp({ ...input, age: 12 }, { client: 'web' }))
    expect(err).toMatchObject({ code: ErrorCode.AGE_RESTRICTED, field: ['input', 'age'] })
    expect(blocked.hold).toHaveBeenCalledWith(expect.objectContaining({ age: { declaredAge: 12, ageDeclaredAt: expect.any(Date) } }))
    expect(blocked.start).not.toHaveBeenCalled()
  })

  it('keeps an under-age sign-up and returns AGE_RESTRICTED', async () => {
    const { service, hold, start } = auth()
    const err = await rejection(() => service.signUp(input, { client: 'web' }))
    expect(err).toMatchObject({ code: ErrorCode.AGE_RESTRICTED, supportEmail: ADMIN_EMAIL, field: ['input', 'age'] })
    expect(err.message).toContain(`Contact an admin at ${ADMIN_EMAIL}`)
    expect(hold).toHaveBeenCalledWith(expect.objectContaining({ email: 'young@example.com', passwordHash: 'hashed-password', globalRole: 'STUDENT', termsVersion: DEFAULT_TERMS_VERSION }))
    expect(hold.mock.calls[0]![0]).toMatchObject({ age: { declaredAge: 14, ageDeclaredAt: expect.any(Date) } })
    expect(hold.mock.calls[0]![0]).not.toHaveProperty('dateOfBirth')
    expect(start).not.toHaveBeenCalled()
  })

  it('still takes the date of birth older apps send, and keeps only the age it gives (ADR-0104)', async () => {
    const { service, hold } = auth()
    const { age: _age, ...legacy } = input
    const err = await rejection(() => service.signUp({ ...legacy, dateOfBirth: '2012-01-01' }, { client: 'mobile' }))
    expect(err).toMatchObject({ code: ErrorCode.AGE_RESTRICTED, field: ['input', 'dateOfBirth'] })
    expect(hold.mock.calls[0]![0]).toMatchObject({ age: { declaredAge: ageOn(new Date('2012-01-01T00:00:00Z')) } })
    expect(JSON.stringify(hold.mock.calls[0]![0])).not.toContain('2012-01-01')
  })

  it('uses the age when both are sent, and ignores the date of birth', async () => {
    const young = auth()
    const refused = await rejection(() => young.service.signUp({ ...input, dateOfBirth: '1990-01-01' }, { client: 'web' }))
    expect(refused).toMatchObject({ code: ErrorCode.AGE_RESTRICTED, field: ['input', 'age'] })
    const adult = auth()
    // An adult age with a child's date of birth passes the gate; this address already has an account.
    const passed = await rejection(() => adult.service.signUp({ ...input, age: 30, dateOfBirth: '2015-01-01' }, { client: 'web' }))
    expect(passed.code).toBe(ErrorCode.CONFLICT)
    expect(adult.hold).not.toHaveBeenCalled()
  })

  it.each([
    [{ age: 0 }, ['input', 'age'], /from 1 to 120/],
    [{ age: 121 }, ['input', 'age'], /from 1 to 120/],
    [{ age: 17.5 }, ['input', 'age'], /whole number/],
    [{ age: null }, ['input', 'age'], /Enter your age/],
    [{ age: undefined, dateOfBirth: '2004-02-30' }, ['input', 'dateOfBirth'], /real date/],
    [{ age: undefined, dateOfBirth: '2999-01-01' }, ['input', 'dateOfBirth'], /future/],
    [{ age: undefined, dateOfBirth: new Date().toISOString().slice(0, 10) }, ['input', 'dateOfBirth'], /real date of birth/],
  ])('refuses %p as VALIDATION before holding anything', async (over, field, message) => {
    const { service, hold } = auth()
    const err = await rejection(() => service.signUp({ ...input, ...over } as never, { client: 'web' }))
    expect(err).toMatchObject({ code: ErrorCode.VALIDATION, field })
    expect(err.message).toMatch(message)
    expect(hold).not.toHaveBeenCalled()
  })

  it('does not hold an account when the terms are not accepted', async () => {
    const { service, hold } = auth()
    const err = await rejection(() => service.signUp({ ...input, acceptedTermsVersion: '1999-01-01' }, { client: 'web' }))
    expect(err.code).toBe(ErrorCode.VALIDATION)
    expect(hold).not.toHaveBeenCalled()
  })

  it('signs an adult in and lets a wrong password fail before the standing check', async () => {
    const adult = auth({ verify: async () => false })
    const err = await rejection(() => adult.service.signIn('asha@example.com', 'nope nope nope', { client: 'web' }))
    expect(err).toMatchObject({ code: ErrorCode.VALIDATION })
    expect(err.message).toMatch(/incorrect/)
    expect(adult.start).not.toHaveBeenCalled()

    const blocked = auth({ start: jest.fn(async () => { throw refusalError('AGE_BLOCKED', SUPPORT) }) })
    const refused = await rejection(() => blocked.service.signIn('asha@example.com', 'correct horse battery staple', { client: 'web' }))
    expect(refused.code).toBe(ErrorCode.AGE_RESTRICTED)
    expect(blocked.start).toHaveBeenCalled()
  })
})

describe('RegistrationService age gate', () => {
  function registration(held = jest.fn(async () => undefined)) {
    const service = new RegistrationService(
      { user: { findUniqueOrThrow: async () => ({ registrationCompletedAt: null }) } } as never,
      { check: async () => undefined } as never,
      { holdRegistration: held } as never,
      { publish: async () => undefined } as never,
      { minimumAge: () => 18 } as never,
      { email: async () => ADMIN_EMAIL } as never,
      { current: () => DEFAULT_TERMS_VERSION } as never,
      { schedule: async () => undefined } as never,
    )
    return { service, held }
  }

  it('completes registration at 13 and 17 when the configured floor is 8, and holds 12 (ADR-0113)', async () => {
    const updates: unknown[] = []
    const open = (minimum: number) =>
      new RegistrationService(
        {
          user: {
            findUniqueOrThrow: async () => ({ registrationCompletedAt: null }),
            update: (args: unknown) => {
              updates.push(args)
              return Promise.resolve(args)
            },
          },
          consentRecord: { createMany: () => Promise.resolve({ count: 3 }) },
          guardianConsent: { create: () => Promise.resolve({}) },
          $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
        } as never,
        { check: async () => undefined } as never,
        { holdRegistration: jest.fn(async () => undefined) } as never,
        { publish: async () => undefined } as never,
        { minimumAge: () => minimum, consentAge: () => 18, guardianNoticeVersion: () => '2026-11-11' } as never,
        { email: async () => ADMIN_EMAIL } as never,
        { current: () => DEFAULT_TERMS_VERSION } as never,
        { schedule: async () => undefined } as never,
      )
    updates.length = 0
    await open(8).complete('google-13', { displayName: 'Thirteen', age: 13, parentEmail: 'parent@example.com', acceptedTermsVersion: DEFAULT_TERMS_VERSION })
    await open(8).complete('google-17', { displayName: 'Seventeen', age: 17, parentEmail: 'parent@example.com', acceptedTermsVersion: DEFAULT_TERMS_VERSION })
    expect(updates).toEqual([
      expect.objectContaining({ data: expect.objectContaining({ declaredAge: 13, analyticsOptOut: true }) }),
      expect.objectContaining({ data: expect.objectContaining({ declaredAge: 17, analyticsOptOut: true }) }),
    ])
    const held = jest.fn(async () => undefined)
    const young = new RegistrationService(
      { user: { findUniqueOrThrow: async () => ({ registrationCompletedAt: null }) } } as never,
      { check: async () => undefined } as never,
      { holdRegistration: held } as never,
      { publish: async () => undefined } as never,
      { minimumAge: () => 8, consentAge: () => 18 } as never,
      { email: async () => ADMIN_EMAIL } as never,
      { current: () => DEFAULT_TERMS_VERSION } as never,
      { schedule: async () => undefined } as never,
    )
    const err = await rejection(() => young.complete('google-12', { displayName: 'Twelve', age: 12, acceptedTermsVersion: DEFAULT_TERMS_VERSION }))
    expect(err).toMatchObject({ code: ErrorCode.AGE_RESTRICTED, field: ['input', 'age'] })
    expect(held).toHaveBeenCalledWith('google-12', 'Twelve', { declaredAge: 12, ageDeclaredAt: expect.any(Date) }, DEFAULT_TERMS_VERSION)
  })

  it('holds the provider account instead of erasing it', async () => {
    const { service, held } = registration()
    const err = await rejection(() => service.complete('google-1', { displayName: 'Young One', age: 14, acceptedTermsVersion: DEFAULT_TERMS_VERSION }))
    expect(err).toMatchObject({ code: ErrorCode.AGE_RESTRICTED, supportEmail: ADMIN_EMAIL, field: ['input', 'age'] })
    expect(held).toHaveBeenCalledWith('google-1', 'Young One', { declaredAge: 14, ageDeclaredAt: expect.any(Date) }, DEFAULT_TERMS_VERSION)
  })

  it('holds the date of birth an older app sends as the age it gives, not the date (ADR-0104)', async () => {
    const { service, held } = registration()
    const err = await rejection(() => service.complete('google-1', { displayName: 'Young One', dateOfBirth: '2012-01-01', acceptedTermsVersion: DEFAULT_TERMS_VERSION }))
    expect(err).toMatchObject({ code: ErrorCode.AGE_RESTRICTED, supportEmail: ADMIN_EMAIL, field: ['input', 'dateOfBirth'] })
    expect(held).toHaveBeenCalledWith('google-1', 'Young One', { declaredAge: ageOn(new Date('2012-01-01T00:00:00Z')), ageDeclaredAt: expect.any(Date) }, DEFAULT_TERMS_VERSION)
  })

  it('refuses a missing or impossible age before holding anything', async () => {
    const { service, held } = registration()
    expect(await rejection(() => service.complete('google-1', { displayName: 'Young One', acceptedTermsVersion: DEFAULT_TERMS_VERSION }))).toMatchObject({ code: ErrorCode.VALIDATION, field: ['input', 'age'] })
    expect(await rejection(() => service.complete('google-1', { displayName: 'Young One', age: 200, acceptedTermsVersion: DEFAULT_TERMS_VERSION }))).toMatchObject({ code: ErrorCode.VALIDATION, field: ['input', 'age'] })
    expect(held).not.toHaveBeenCalled()
  })

  it('does not hold the account when the terms are wrong', async () => {
    const { service, held } = registration()
    const err = await rejection(() => service.complete('google-1', { displayName: 'Young One', age: 14, acceptedTermsVersion: 'nope' }))
    expect(err).toMatchObject({ code: ErrorCode.VALIDATION, field: ['input', 'acceptedTermsVersion'] })
    expect(held).not.toHaveBeenCalled()
  })
})

describe('SessionService standing', () => {
  function sessions(accountStatus: string) {
    const created: unknown[] = []
    const revokedFamilies: string[] = []
    const db = {
      user: { findUniqueOrThrow: async () => ({ globalRole: 'STUDENT', email: 'asha@example.com', accountStatus }) },
      session: {
        create: async ({ data }: { data: unknown }) => void created.push(data),
        findUnique: async () => ({
          id: 's',
          userId: 'u',
          familyId: 'family-1',
          revokedAt: null,
          replacedById: null,
          expiresAt: new Date(Date.now() + 86_400_000),
          device: { client: 'web' },
          user: { globalRole: 'STUDENT', deletedAt: null, email: 'asha@example.com', accountStatus },
        }),
        updateMany: async () => {
          revokedFamilies.push('family-1')
          return { count: 1 }
        },
      },
    }
    const service = new SessionService(
      db as never,
      { revoke: async () => undefined } as never,
      { publish: async () => undefined } as never,
      { jwtPrivateKey: pem, jwtIssuer: 'http://localhost', tokenAudience: 'lvn', supportEmail: SUPPORT } as never,
      { allows: async () => true } as never,
      { email: async () => ADMIN_EMAIL } as never,
    )
    return { service, created, revokedFamilies }
  }

  it('refuses a new session for an age-blocked or blocked account', async () => {
    const age = sessions('AGE_BLOCKED')
    expect(await rejection(() => age.service.start('u', { client: 'web' }))).toMatchObject({ code: ErrorCode.AGE_RESTRICTED, supportEmail: ADMIN_EMAIL })
    expect(age.created).toEqual([])
    const blocked = sessions('BLOCKED')
    expect(await rejection(() => blocked.service.start('u', { client: 'web' }))).toMatchObject({ code: ErrorCode.VALIDATION, supportEmail: ADMIN_EMAIL })
    const ok = sessions('ACTIVE')
    const issued = await ok.service.start('u', { client: 'web' })
    expect(issued.refreshToken).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(ok.created).toHaveLength(1)
  })

  it('revokes the family when a refresh token belongs to an account that is no longer active', async () => {
    const age = sessions('AGE_BLOCKED')
    expect(await rejection(() => age.service.refresh('token'))).toMatchObject({ code: ErrorCode.UNAUTHENTICATED })
    expect(age.revokedFamilies).toEqual(['family-1'])
  })
})

describe('AccountDeletionService.adminErase', () => {
  it('writes a hashed tombstone, deletes files, anonymises the row, and announces UserDeleted', async () => {
    const tombstones: Record<string, unknown>[] = []
    const audits: { action: string; actorId: string | null; metadata?: Record<string, unknown> }[] = []
    const published: unknown[][] = []
    const deletedFiles: string[][] = []
    const revoked: string[] = []
    let anonymised: Record<string, unknown> | null = null
    const purged: string[] = []
    const rest = new Proxy({}, { get: () => async () => ({}) })
    const db = {
      accountTombstone: { create: async ({ data }: { data: Record<string, unknown> }) => void tombstones.push(data) },
      user: {
        findUniqueOrThrow: async () => ({ avatarFileId: 'avatar-1' }),
        update: async ({ data }: { data: Record<string, unknown> }) => {
          anonymised = data
        },
      },
      guardianConsent: { updateMany: async () => ({ count: 0 }) },
      guardianLink: { deleteMany: async () => ({}) },
      firebaseInstallation: { deleteMany: async () => ({}) },
      dataExport: { findMany: async () => [{ fileId: 'export-1' }], deleteMany: async () => ({}) },
      verificationRequest: { findMany: async () => [{ documentIds: ['doc-1'] }], deleteMany: async () => ({}) },
      $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
    }
    const service = new AccountDeletionService(
      new Proxy(db, {
        get: (target, prop, receiver) => {
          if (typeof prop === 'string' && !(prop in target)) purged.push(prop)
          return prop in target ? Reflect.get(target, prop, receiver) : rest
        },
      }) as never,
      {} as never,
      { revokeAll: async (id: string) => void revoked.push(id) } as never,
      { record: async (entry: { action: string; actorId: string | null; metadata?: Record<string, unknown> }) => void audits.push(entry) } as never,
      { delete: async (ids: string[]) => void deletedFiles.push(ids) } as never,
      {} as never,
      { publish: async (...args: unknown[]) => void published.push(args) } as never,
      {} as never,
    )
    const hash = 'abc123'
    await service.adminErase('user-1', 'admin-1', 'User asked', hash)
    expect(tombstones[0]).toMatchObject({ userId: 'user-1', emailHash: hash, adminId: 'admin-1', reason: 'User asked' })
    expect(tombstones[0]!.deletedAt).toBeInstanceOf(Date)
    expect(deletedFiles).toEqual([['export-1', 'doc-1', 'avatar-1']])
    expect(revoked).toEqual(['user-1'])
    expect(anonymised).toMatchObject({ displayName: 'Deleted user', dateOfBirth: null, declaredAge: null, ageDeclaredAt: null, accountStatus: 'ACTIVE', statusReason: null, passwordHash: null })
    expect(purged).toContain('consentRecord')
    expect(purged).not.toContain('guardianConsent')
    expect(String(anonymised!.email)).toMatch(/^deleted-user-1@deleted\.learnvianotes\.invalid$/)
    expect(audits.map((a) => a.action)).toEqual(['account.admin.deleted', 'account.deleted'])
    expect(audits[0]).toMatchObject({ actorId: 'admin-1', metadata: { reason: 'User asked', emailHash: hash } })
    expect(JSON.stringify(audits)).not.toContain('@example.com')
    expect(published).toEqual([['UserDeleted', { userId: 'user-1' }]])
  })
})
