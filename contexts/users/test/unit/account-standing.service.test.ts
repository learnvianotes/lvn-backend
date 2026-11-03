import { generateKeyPairSync } from 'node:crypto'
import { ErrorCode, type AppError } from '@lvn-backend/errors'
import { AccountDeletionService } from '../../src/application/account-deletion.service'
import { AuthService } from '../../src/application/auth.service'
import { RegistrationService } from '../../src/application/registration.service'
import { SessionService } from '../../src/application/session.service'
import { ageRestrictedError, refusalError } from '../../src/domain/account-status'
import { DEFAULT_TERMS_VERSION } from '../../src/domain/rules'

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
    )
    return { service, hold, start }
  }

  const input = {
    email: 'young@example.com',
    password: 'correct horse battery staple',
    displayName: 'Young One',
    dateOfBirth: '2012-01-01',
    acceptedTermsVersion: DEFAULT_TERMS_VERSION,
  }

  it('keeps an under-age sign-up and returns AGE_RESTRICTED', async () => {
    const { service, hold, start } = auth()
    const err = await rejection(() => service.signUp(input, { client: 'web' }))
    expect(err).toMatchObject({ code: ErrorCode.AGE_RESTRICTED, supportEmail: ADMIN_EMAIL, field: ['input', 'dateOfBirth'] })
    expect(err.message).toContain(`Contact an admin at ${ADMIN_EMAIL}`)
    expect(hold).toHaveBeenCalledWith(expect.objectContaining({ email: 'young@example.com', passwordHash: 'hashed-password', globalRole: 'STUDENT', termsVersion: DEFAULT_TERMS_VERSION }))
    expect(start).not.toHaveBeenCalled()
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
    )
    return { service, held }
  }

  it('holds the provider account instead of erasing it', async () => {
    const { service, held } = registration()
    const err = await rejection(() => service.complete('google-1', { displayName: 'Young One', dateOfBirth: '2012-01-01', acceptedTermsVersion: DEFAULT_TERMS_VERSION }))
    expect(err).toMatchObject({ code: ErrorCode.AGE_RESTRICTED, supportEmail: ADMIN_EMAIL })
    expect(held).toHaveBeenCalledWith('google-1', 'Young One', new Date('2012-01-01T00:00:00.000Z'), DEFAULT_TERMS_VERSION)
  })

  it('does not hold the account when the terms are wrong', async () => {
    const { service, held } = registration()
    const err = await rejection(() => service.complete('google-1', { displayName: 'Young One', dateOfBirth: '2012-01-01', acceptedTermsVersion: 'nope' }))
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
    const rest = new Proxy({}, { get: () => async () => ({}) })
    const db = {
      accountTombstone: { create: async ({ data }: { data: Record<string, unknown> }) => void tombstones.push(data) },
      user: {
        findUniqueOrThrow: async () => ({ avatarFileId: 'avatar-1' }),
        update: async ({ data }: { data: Record<string, unknown> }) => {
          anonymised = data
        },
      },
      dataExport: { findMany: async () => [{ fileId: 'export-1' }], deleteMany: async () => ({}) },
      verificationRequest: { findMany: async () => [{ documentIds: ['doc-1'] }], deleteMany: async () => ({}) },
      $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
    }
    const service = new AccountDeletionService(
      new Proxy(db, { get: (target, prop, receiver) => (prop in target ? Reflect.get(target, prop, receiver) : rest) }) as never,
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
    expect(anonymised).toMatchObject({ displayName: 'Deleted user', dateOfBirth: null, accountStatus: 'ACTIVE', statusReason: null, passwordHash: null })
    expect(String(anonymised!.email)).toMatch(/^deleted-user-1@deleted\.learnvianotes\.invalid$/)
    expect(audits.map((a) => a.action)).toEqual(['account.admin.deleted', 'account.deleted'])
    expect(audits[0]).toMatchObject({ actorId: 'admin-1', metadata: { reason: 'User asked', emailHash: hash } })
    expect(JSON.stringify(audits)).not.toContain('@example.com')
    expect(published).toEqual([['UserDeleted', { userId: 'user-1' }]])
  })
})
