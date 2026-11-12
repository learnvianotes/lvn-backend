import { ErrorCode, type AppError } from '@lvn-backend/errors'
import { AccountDeletionService } from '../../src/application/account-deletion.service'
import { namedInLists } from '../../src/application/age'
import { AuthService } from '../../src/application/auth.service'
import { PlatformSettingsStore } from '../../src/application/platform-settings.store'
import { RegistrationService } from '../../src/application/registration.service'
import {
  DEFAULT_ACCOUNT_MINIMUM_AGE,
  DEFAULT_GUARDIAN_NOTICE_VERSION,
  GUARDIAN_CONSENT_AUTO_UNVERIFIED,
  GUARDIAN_CONSENT_VERIFIED,
  methodsFromConsentRows,
  signUpAgeBand,
} from '../../src/domain/guardian-consent'
import { isRestrictedMinor, DEFAULT_TERMS_VERSION } from '../../src/domain/rules'

const NOTICE = '2026-11-11'

function rejection(run: () => Promise<unknown>): Promise<AppError> {
  return run().then(
    () => Promise.reject(new Error('expected a rejection')),
    (e: AppError) => e,
  )
}

describe('sign-up age bands (ADR-0109)', () => {
  it('documents under_13, 13_15 and 16_17, and writes no band at 18', () => {
    expect(signUpAgeBand(5)).toBe('under_13')
    expect(signUpAgeBand(12)).toBe('under_13')
    expect(signUpAgeBand(13)).toBe('13_15')
    expect(signUpAgeBand(15)).toBe('13_15')
    expect(signUpAgeBand(16)).toBe('16_17')
    expect(signUpAgeBand(17)).toBe('16_17')
    expect(signUpAgeBand(18)).toBeNull()
  })
})

describe('auto_unverified consent does not lift minor limits', () => {
  const child = { dateOfBirth: null, declaredAge: 12, ageDeclaredAt: new Date('2026-11-11T00:00:00Z') }

  it('keeps an auto_unverified minor restricted and lifts a verified method', () => {
    expect(isRestrictedMinor(child, 18, methodsFromConsentRows({ guardianConsents: [{ method: GUARDIAN_CONSENT_AUTO_UNVERIFIED }] }))).toBe(true)
    expect(isRestrictedMinor(child, 18, methodsFromConsentRows({ guardianConsents: [{ method: GUARDIAN_CONSENT_VERIFIED }] }))).toBe(false)
    expect(isRestrictedMinor(child, 18, methodsFromConsentRows({
      consents: [{ kind: 'GUARDIAN' }],
      guardianConsents: [{ method: GUARDIAN_CONSENT_AUTO_UNVERIFIED }],
    }))).toBe(false)
    expect(isRestrictedMinor(child, 18, methodsFromConsentRows({ consents: [{ kind: 'TERMS' }] }))).toBe(true)
  })

  it('names someone in a list for verified consent only, not for auto_unverified', () => {
    const filter = JSON.stringify(namedInLists(18))
    expect(filter).toContain(GUARDIAN_CONSENT_VERIFIED)
    expect(filter).not.toContain(GUARDIAN_CONSENT_AUTO_UNVERIFIED)
    expect(filter).toContain('GUARDIAN')
  })
})

describe('account_minimum_age is an admin setting', () => {
  it('defaults to 13 and ignores an environment fallback of 8', async () => {
    const store = new PlatformSettingsStore(
      { appSetting: { upsert: async () => ({}) } } as never,
      { settingFallbacks: { account_minimum_age: 8 } } as never,
    )
    expect(DEFAULT_ACCOUNT_MINIMUM_AGE).toBe(13)
    expect(store.minimumAge()).toBe(13)
    expect(store.guardianNoticeVersion()).toBe(DEFAULT_GUARDIAN_NOTICE_VERSION)
    await store.put('account_minimum_age', 5, 'admin')
    expect(store.minimumAge()).toBe(5)
    await store.put('guardian_notice_version', '2026-12-01', 'admin')
    expect(store.guardianNoticeVersion()).toBe('2026-12-01')
  })
})

describe('email sign-up age gate', () => {
  function auth(minimum: number, notice = NOTICE) {
    const created: Record<string, unknown>[] = []
    const guardians: Record<string, unknown>[] = []
    let inTx = false
    const tx = {
      user: {
        create: async (args: { data: Record<string, unknown> }) => {
          if (!inTx) throw new Error('account was created outside the transaction')
          created.push(args.data)
        },
        findUnique: async () => null,
      },
      consentRecord: { createMany: async () => ({ count: 3 }) },
      guardianConsent: {
        create: async (args: { data: Record<string, unknown> }) => {
          if (!inTx) throw new Error('guardian consent was written outside the transaction')
          guardians.push(args.data)
        },
      },
    }
    const service = new AuthService(
      {
        user: { findUnique: async () => null },
        emailToken: { create: async () => ({}) },
        $transaction: async (fn: (client: typeof tx) => Promise<void>) => {
          inTx = true
          try {
            await fn(tx)
          } finally {
            inTx = false
          }
        },
      } as never,
      { assertAcceptable: async () => undefined, hash: async () => 'hashed' } as never,
      { start: async () => ({ userId: 'created', accessToken: 'a' }) } as never,
      {} as never,
      { check: async () => undefined, start: async () => undefined } as never,
      { match: async () => undefined } as never,
      { send: async () => undefined } as never,
      { publish: async () => undefined } as never,
      { webUrl: 'https://app.learnvianotes.in' } as never,
      { minimumAge: () => minimum, consentAge: () => 18, guardianNoticeVersion: () => notice } as never,
      { assertAllowed: async () => undefined, roleFor: async () => 'STUDENT' } as never,
      { holdSignUp: async () => undefined } as never,
      { email: async () => 'support@learnvianotes.in' } as never,
      { current: () => DEFAULT_TERMS_VERSION } as never,
      { schedule: async () => undefined } as never,
    )
    const sign = (age: number) => service.signUp(
      { email: `age${age}@example.com`, password: 'correct horse battery staple', displayName: 'Asha Rao', age, acceptedTermsVersion: DEFAULT_TERMS_VERSION },
      { client: 'web' },
    )
    return { sign, created, guardians }
  }

  it('blocks 12 at the default of 13, and records consent for 13, 16 and 17 but not 18', async () => {
    const blocked = auth(13)
    expect(await rejection(() => blocked.sign(12))).toMatchObject({ code: ErrorCode.AGE_RESTRICTED, field: ['input', 'age'] })
    expect(blocked.guardians).toEqual([])
    expect(blocked.created).toEqual([])

    const teen = auth(13, '2026-12-01')
    await expect(teen.sign(13)).resolves.toMatchObject({ status: 'created' })
    await expect(teen.sign(16)).resolves.toMatchObject({ status: 'created' })
    await expect(teen.sign(17)).resolves.toMatchObject({ status: 'created' })
    await expect(teen.sign(18)).resolves.toMatchObject({ status: 'created' })
    expect(teen.guardians.map((row) => row.ageBand)).toEqual(['13_15', '16_17', '16_17'])
    expect(teen.guardians[0]).toMatchObject({ kind: 'GUARDIAN', method: 'auto_unverified', noticeVersion: '2026-12-01' })
    expect(teen.guardians[0]!.recordedAt).toBeInstanceOf(Date)
    expect(teen.created.filter((row) => row.declaredAge === 18)).toHaveLength(1)
  })

  it('admits a 5-year-old when the setting is 5, and blocks a 4-year-old', async () => {
    const open = auth(5)
    await expect(open.sign(5)).resolves.toMatchObject({ status: 'created' })
    await expect(open.sign(12)).resolves.toMatchObject({ status: 'created' })
    expect(open.guardians.map((row) => row.ageBand)).toEqual(['under_13', 'under_13'])
    expect(open.guardians.every((row) => row.method === 'auto_unverified')).toBe(true)
    const closed = auth(5)
    expect(await rejection(() => closed.sign(4))).toMatchObject({ code: ErrorCode.AGE_RESTRICTED, field: ['input', 'age'] })
    expect(closed.guardians).toEqual([])
  })
})

describe('provider registration age gate (Google, GitHub and LinkedIn)', () => {
  function registration(minimum: number, notice = NOTICE) {
    const guardians: Record<string, unknown>[] = []
    const batches: number[] = []
    const service = new RegistrationService(
      {
        user: {
          findUniqueOrThrow: async () => ({ registrationCompletedAt: null }),
          update: () => Promise.resolve({}),
        },
        consentRecord: { createMany: () => Promise.resolve({ count: 3 }) },
        guardianConsent: {
          create: (args: { data: Record<string, unknown> }) => {
            guardians.push(args.data)
            return Promise.resolve(args)
          },
        },
        $transaction: async (ops: Promise<unknown>[]) => {
          batches.push(ops.length)
          return Promise.all(ops)
        },
      } as never,
      { check: async () => undefined } as never,
      { holdRegistration: async () => undefined } as never,
      { publish: async () => undefined } as never,
      { minimumAge: () => minimum, consentAge: () => 18, guardianNoticeVersion: () => notice } as never,
      { email: async () => 'support@learnvianotes.in' } as never,
      { current: () => DEFAULT_TERMS_VERSION } as never,
      { schedule: async () => undefined } as never,
    )
    const complete = (userId: string, age: number) => service.complete(userId, { displayName: 'Asha Rao', age, acceptedTermsVersion: DEFAULT_TERMS_VERSION })
    return { complete, guardians, batches }
  }

  it('blocks 12 at the default of 13, and writes consent in the same transaction for 13 to 17', async () => {
    const blocked = registration(13)
    expect(await rejection(() => blocked.complete('google-12', 12))).toMatchObject({ code: ErrorCode.AGE_RESTRICTED, field: ['input', 'age'] })
    expect(blocked.guardians).toEqual([])
    expect(blocked.batches).toEqual([])

    const teen = registration(13)
    await teen.complete('google-13', 13)
    await teen.complete('github-17', 17)
    await teen.complete('linkedin-18', 18)
    expect(teen.guardians.map((row) => row.ageBand)).toEqual(['13_15', '16_17'])
    expect(teen.guardians[0]).toMatchObject({ method: 'auto_unverified', kind: 'GUARDIAN', noticeVersion: NOTICE })
    expect(teen.batches).toEqual([3, 3, 2])
  })

  it('admits 5 and blocks 4 when an admin has set the minimum to 5', async () => {
    const open = registration(5)
    await open.complete('google-5', 5)
    expect(open.guardians).toEqual([expect.objectContaining({ ageBand: 'under_13', method: 'auto_unverified' })])
    const closed = registration(5)
    expect(await rejection(() => closed.complete('google-4', 4))).toMatchObject({ code: ErrorCode.AGE_RESTRICTED })
    expect(closed.guardians).toEqual([])
  })
})

describe('guardian consent survives account purge', () => {
  it('anonymises the person and does not delete the guardian consent row', async () => {
    const purged: string[] = []
    const rest = new Proxy({}, { get: () => async () => ({}) })
    const db = {
      accountTombstone: { create: async () => undefined },
      user: { findUniqueOrThrow: async () => ({ avatarFileId: null }), update: async () => undefined },
      dataExport: { findMany: async () => [], deleteMany: async () => ({}) },
      verificationRequest: { findMany: async () => [], deleteMany: async () => ({}) },
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
      { revokeAll: async () => undefined } as never,
      { record: async () => undefined } as never,
      { delete: async () => undefined } as never,
      {} as never,
      { publish: async () => undefined } as never,
      {} as never,
    )
    await service.adminErase('user-1', 'admin-1', 'User asked', 'hash')
    expect(purged).toContain('consentRecord')
    expect(purged).not.toContain('guardianConsent')
  })
})
