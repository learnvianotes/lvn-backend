import { Logger } from '@nestjs/common'
import { ErrorCode, type AppError } from '@lvn-backend/errors'
import { AccountDeletionService, DELETION_GRACE_DAYS, graceDaysForAge } from '../../src/application/account-deletion.service'
import { AuthService } from '../../src/application/auth.service'
import { GuardianManageService } from '../../src/application/guardian-manage.service'
import { GuardianNoticeService } from '../../src/application/guardian-notice.service'
import { MinorPurgeService, minorPurgeLog } from '../../src/application/minor-purge.service'
import { PlatformSettingsStore } from '../../src/application/platform-settings.store'
import { RegistrationService } from '../../src/application/registration.service'
import { sameBytes, sha256 } from '../../src/application/secrets'
import { GUARDIAN_CONSENT_EMAIL_PLUS, methodsFromConsentRows } from '../../src/domain/guardian-consent'
import { readGuardianToken, signGuardianToken } from '../../src/domain/guardian-links'
import { DEFAULT_MINOR_PURGE_WINDOW_DAYS } from '../../src/domain/guardian-verification'
import { DEFAULT_TERMS_VERSION, isRestrictedMinor } from '../../src/domain/rules'

const SECRET = 'test-code-secret'
const WEB = 'https://app.learnvianotes.in'
const SUPPORT = 'support@learnvianotes.in'
const CHILD = 'child@example.com'
const PARENT = 'parent@example.com'

function rejection(run: () => Promise<unknown>): Promise<AppError> {
  return run().then(
    () => Promise.reject(new Error('expected a rejection')),
    (e: AppError) => e,
  )
}

interface ConsentRow {
  id: string
  userId: string
  method: string
  verifiedAt: Date | null
  parentEmail: string | null
  noticeVersion: string
  ageBand: string
  recordedAt: Date
}

interface LinkRow {
  id: string
  userId: string
  purpose: string
  tokenHash: Uint8Array
  expiresAt: Date
  usedAt: Date | null
}

interface UserRow {
  id: string
  email: string
  displayName: string
  deletedAt: Date | null
  accountStatus: string
  statusReason: string | null
  declaredAge: number
  ageDeclaredAt: Date
  dateOfBirth: null
  deletionRequestedAt: Date | null
}

function memory() {
  const consents: ConsentRow[] = []
  const links: LinkRow[] = []
  const users: UserRow[] = []
  const matchLink = (row: LinkRow, where: Record<string, unknown>) => {
    if (where.id && row.id !== where.id) return false
    if (where.userId && row.userId !== where.userId) return false
    if (where.purpose && row.purpose !== where.purpose) return false
    if (where.usedAt === null && row.usedAt !== null) return false
    const exp = where.expiresAt as { gt?: Date } | undefined
    if (exp?.gt && !(row.expiresAt > exp.gt)) return false
    if (where.tokenHash && !sameBytes(row.tokenHash, where.tokenHash as Uint8Array)) return false
    return true
  }
  const db = {
    consents,
    links,
    users,
    user: {
      findFirst: async ({ where }: { where: { id: string; deletedAt: null } }) => users.find((u) => u.id === where.id && u.deletedAt === null) ?? null,
      findUnique: async ({ where }: { where: { id: string } }) => users.find((u) => u.id === where.id) ?? null,
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
        const user = users.find((u) => u.id === where.id)
        if (!user) throw new Error('missing')
        return user
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<UserRow> }) => {
        const user = users.find((u) => u.id === where.id)
        if (user) Object.assign(user, data)
      },
    },
    guardianConsent: {
      findFirst: async ({ where }: { where: { userId: string; parentEmail?: { not: null } } }) => {
        const rows = consents.filter((c) => c.userId === where.userId && (where.parentEmail ? c.parentEmail !== null : true))
        return rows.sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime())[0] ?? null
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<ConsentRow> }) => {
        const row = consents.find((c) => c.id === where.id)
        if (row) Object.assign(row, data)
        return row
      },
      updateMany: async ({ where, data }: { where: { userId: string }; data: Partial<ConsentRow> }) => {
        let count = 0
        for (const row of consents) {
          if (row.userId !== where.userId) continue
          Object.assign(row, data)
          count += 1
        }
        return { count }
      },
      create: async ({ data }: { data: ConsentRow }) => {
        consents.push(data)
        return data
      },
    },
    guardianLink: {
      findUnique: async ({ where }: { where: { tokenHash: Uint8Array } }) => links.find((row) => sameBytes(row.tokenHash, where.tokenHash)) ?? null,
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Partial<LinkRow> }) => {
        let count = 0
        for (const row of links) {
          if (!matchLink(row, where)) continue
          Object.assign(row, data)
          count += 1
        }
        return { count }
      },
      create: async ({ data }: { data: LinkRow }) => {
        links.push({ ...data, usedAt: data.usedAt ?? null })
        return data
      },
    },
    note: { count: async () => 2 },
    fileObject: { count: async () => 1 },
    session: { findMany: async () => [] },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  }
  return db
}

function settings(over: { emailPlus?: boolean; purge?: number; suspend?: boolean; resend?: number } = {}) {
  const emailPlus = over.emailPlus ?? true
  return {
    emailPlusEnabled: () => emailPlus,
    verificationSettings: () => ({ emailPlusEnabled: emailPlus }),
    consentRequiredForAccess: () => over.suspend ?? false,
    guardianLinkTtlHours: () => 72,
    guardianManageSessionMinutes: () => 60,
    guardianLinkResendPerHour: () => over.resend ?? 3,
    minorPurgeWindowDays: () => over.purge ?? DEFAULT_MINOR_PURGE_WINDOW_DAYS,
    guardianNoticeVersion: () => '2026-11-11',
    minimumAge: () => 5,
    consentAge: () => 18,
  }
}

function noticeOf(db: ReturnType<typeof memory>, opts: { emailPlus?: boolean; suspend?: boolean; allowed?: boolean } = {}) {
  const sent: { to: string; template: string; data: Record<string, unknown>; options?: unknown }[] = []
  const lifted: string[] = []
  const suspended: string[] = []
  const limiter = { hit: async () => ({ allowed: opts.allowed ?? true, retryAfter: 60 }) }
  const notice = new GuardianNoticeService(
    db as never,
    settings(opts) as never,
    { lift: async (id: string) => void lifted.push(id), suspend: async (id: string) => void suspended.push(id) } as never,
    limiter as never,
    { send: async (to: string, template: string, data: Record<string, unknown>, options?: unknown) => void sent.push({ to, template, data, options }) } as never,
    { codeHmacSecret: SECRET, webUrl: WEB, supportEmail: SUPPORT } as never,
  )
  return { notice, sent, lifted, suspended }
}

function child(age: number, band: string): { user: UserRow; consent: ConsentRow } {
  const user: UserRow = {
    id: 'child-1',
    email: CHILD,
    displayName: 'Asha Rao',
    deletedAt: null,
    accountStatus: 'ACTIVE',
    statusReason: null,
    declaredAge: age,
    ageDeclaredAt: new Date('2026-11-11T00:00:00Z'),
    dateOfBirth: null,
    deletionRequestedAt: null,
  }
  const consent: ConsentRow = {
    id: 'consent-1',
    userId: user.id,
    method: 'auto_unverified',
    verifiedAt: null,
    parentEmail: PARENT,
    noticeVersion: '2026-11-11',
    ageBand: band,
    recordedAt: new Date('2026-11-11T00:00:00Z'),
  }
  return { user, consent }
}

describe('guardian link signatures', () => {
  it('signs a token the server can read, and rejects a tampered one', () => {
    const token = signGuardianToken(SECRET, { userId: 'child-1', purpose: 'CONFIRM', exp: Date.now() + 1000, jti: 'jti-1' })
    expect(readGuardianToken(SECRET, token)).toMatchObject({ userId: 'child-1', purpose: 'CONFIRM', jti: 'jti-1' })
    expect(readGuardianToken('other-secret', token)).toBeNull()
    expect(readGuardianToken(SECRET, `${token}x`)).toBeNull()
    expect(readGuardianToken(SECRET, 'not-a-token')).toBeNull()
  })
})

describe('parent email on an admitted sign-up under 18', () => {
  function auth(minimum = 5) {
    const created: Record<string, unknown>[] = []
    const guardians: Record<string, unknown>[] = []
    const notified: string[] = []
    const welcomed: string[] = []
    const service = new AuthService(
      {
        user: { findUnique: async () => null },
        emailToken: { create: async () => ({}) },
        $transaction: async (fn: (tx: { user: { create: (args: { data: Record<string, unknown> }) => Promise<void>; findUnique: () => Promise<null> }; consentRecord: { createMany: () => Promise<{ count: number }> }; guardianConsent: { create: (args: { data: Record<string, unknown> }) => Promise<void> } }) => Promise<void>) =>
          fn({
            user: { create: async (args) => void created.push(args.data), findUnique: async () => null },
            consentRecord: { createMany: async () => ({ count: 3 }) },
            guardianConsent: { create: async (args) => void guardians.push(args.data) },
          }),
      } as never,
      { assertAcceptable: async () => undefined, hash: async () => 'hashed' } as never,
      { start: async () => ({ userId: 'created', accessToken: 'a' }) } as never,
      { hit: async () => ({ allowed: true }) } as never,
      { check: async () => undefined, start: async () => undefined } as never,
      { match: async () => undefined } as never,
      { send: async () => undefined } as never,
      { publish: async () => undefined } as never,
      { webUrl: WEB } as never,
      { minimumAge: () => minimum, consentAge: () => 18, guardianNoticeVersion: () => '2026-11-11' } as never,
      { assertAllowed: async () => undefined, roleFor: async () => 'STUDENT' } as never,
      { holdSignUp: async () => undefined } as never,
      { email: async () => SUPPORT } as never,
      { current: () => DEFAULT_TERMS_VERSION } as never,
      { schedule: async (id: string) => void welcomed.push(id) } as never,
      { notify: async (id: string) => void notified.push(id) } as never,
    )
    const sign = (age: number, parentEmail?: string) => service.signUp(
      { email: CHILD, password: 'correct horse battery staple', displayName: 'Asha Rao', age, parentEmail, acceptedTermsVersion: DEFAULT_TERMS_VERSION },
      { client: 'web' },
    )
    return { sign, created, guardians, notified, welcomed }
  }

  it('stores the parent address on the consent row, keeps the child email, and still sends the welcome', async () => {
    const gate = auth()
    await expect(gate.sign(10, PARENT)).resolves.toMatchObject({ status: 'created' })
    expect(gate.created[0]).toMatchObject({ email: CHILD })
    expect(gate.guardians[0]).toMatchObject({ method: 'auto_unverified', parentEmail: PARENT, ageBand: 'under_13' })
    expect(gate.notified).toEqual([expect.any(String)])
    expect(gate.welcomed).toHaveLength(1)
  })

  it('rejects a missing, invalid, or same-as-child parent address, and stores nothing below the floor', async () => {
    const open = auth()
    expect((await rejection(() => open.sign(12))).code).toBe(ErrorCode.VALIDATION)
    expect((await rejection(() => open.sign(12, 'not-an-email'))).field).toEqual(['input', 'parentEmail'])
    expect((await rejection(() => open.sign(12, ` ${CHILD.toUpperCase()} `))).message).toMatch(/not the account email/)
    expect(open.guardians).toEqual([])
    const blocked = auth(13)
    expect((await rejection(() => blocked.sign(12, PARENT))).code).toBe(ErrorCode.AGE_RESTRICTED)
    expect(blocked.guardians).toEqual([])
    expect(blocked.notified).toEqual([])
  })

  it('does not ask an adult for a parent email', async () => {
    const gate = auth()
    await expect(gate.sign(18)).resolves.toMatchObject({ status: 'created' })
    expect(gate.guardians).toEqual([])
    expect(gate.notified).toEqual([])
    expect(gate.welcomed).toHaveLength(1)
  })
})

describe('email plus is a click, including for under 13', () => {
  it('sending the notice does not verify, and the click does, then the follow-up is sent', async () => {
    const db = memory()
    const { user, consent } = child(10, 'under_13')
    db.users.push(user)
    db.consents.push(consent)
    const { notice, sent } = noticeOf(db)
    await notice.notify(user.id)
    expect(consent.method).toBe('auto_unverified')
    expect(consent.verifiedAt).toBeNull()
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ to: PARENT, template: 'guardianNotice' })
    expect(sent[0]!.options).toBeUndefined()
    expect(sent[0]!.data.confirmLink).toEqual(expect.stringContaining('/guardian/confirm?token='))
    expect(String(sent[0]!.data.confirmLink)).not.toContain(PARENT)
    const facts = { dateOfBirth: null, declaredAge: 10, ageDeclaredAt: user.ageDeclaredAt }
    expect(isRestrictedMinor(facts, 18, methodsFromConsentRows({ guardianConsents: [consent] }), user.ageDeclaredAt)).toBe(true)

    await notice.confirm(new URL(String(sent[0]!.data.confirmLink)).searchParams.get('token')!)
    expect(consent.method).toBe(GUARDIAN_CONSENT_EMAIL_PLUS)
    expect(consent.verifiedAt).toBeInstanceOf(Date)
    expect(sent[1]).toMatchObject({ to: PARENT, template: 'guardianConsentConfirmed' })
    expect(String(sent[1]!.data.manageLink)).toContain('/guardian/manage?token=')
    expect(isRestrictedMinor(facts, 18, methodsFromConsentRows({ guardianConsents: [consent] }), user.ageDeclaredAt, { emailPlusEnabled: true })).toBe(false)
    expect(isRestrictedMinor(facts, 18, methodsFromConsentRows({ guardianConsents: [consent] }), user.ageDeclaredAt, { emailPlusEnabled: false })).toBe(true)
  })

  it('refuses an expired link, a reused link, and a click while email plus is off, without spending that click', async () => {
    const db = memory()
    const { user, consent } = child(16, '16_17')
    db.users.push(user)
    db.consents.push(consent)
    const { notice } = noticeOf(db)
    await notice.notify(user.id)
    const confirm = db.links.find((row) => row.purpose === 'CONFIRM')!
    const live = signGuardianToken(SECRET, { userId: user.id, purpose: 'CONFIRM', exp: Date.now() + 60_000, jti: 'live' })
    confirm.tokenHash = sha256(live)
    await notice.confirm(live)
    expect((await rejection(() => notice.confirm(live))).code).toBe(ErrorCode.VALIDATION)
    expect(consent.method).toBe('email_plus')

    const expired = signGuardianToken(SECRET, { userId: user.id, purpose: 'CONFIRM', exp: Date.now() - 1000, jti: 'old' })
    db.links.push({ id: 'expired', userId: user.id, purpose: 'CONFIRM', tokenHash: sha256(expired), expiresAt: new Date(Date.now() + 60_000), usedAt: null })
    expect((await rejection(() => notice.confirm(expired))).message).toMatch(/expired/)

    const spentDb = memory()
    const again = child(8, 'under_13')
    spentDb.users.push(again.user)
    spentDb.consents.push(again.consent)
    const off = noticeOf(spentDb, { emailPlus: false })
    const pending = signGuardianToken(SECRET, { userId: again.user.id, purpose: 'CONFIRM', exp: Date.now() + 60_000, jti: 'pending' })
    spentDb.links.push({ id: 'pending', userId: again.user.id, purpose: 'CONFIRM', tokenHash: sha256(pending), expiresAt: new Date(Date.now() + 60_000), usedAt: null })
    expect((await rejection(() => off.notice.confirm(pending))).message).toMatch(/turned off/)
    expect(spentDb.links[0]!.usedAt).toBeNull()
    expect(again.consent.method).toBe('auto_unverified')
    expect(again.consent.verifiedAt).toBeNull()
  })

  it('rate limits a resent confirm link and retires the previous one', async () => {
    const db = memory()
    const { user, consent } = child(13, '13_15')
    db.users.push(user)
    db.consents.push(consent)
    const { notice, sent } = noticeOf(db)
    await notice.notify(user.id)
    const first = new URL(String(sent[0]!.data.confirmLink)).searchParams.get('token')!
    await notice.resendConfirm(user.id)
    expect((await rejection(() => notice.confirm(first))).code).toBe(ErrorCode.VALIDATION)
    const second = new URL(String(sent.at(-1)!.data.confirmLink)).searchParams.get('token')!
    await notice.confirm(second)
    expect(consent.verifiedAt).toBeInstanceOf(Date)

    const limited = noticeOf(db, { allowed: false })
    expect((await rejection(() => limited.notice.resendConfirm(user.id))).code).toBe(ErrorCode.RATE_LIMITED)
    expect(limited.sent).toEqual([])
  })
})

describe('withdrawing consent restores the restriction', () => {
  it('returns the row to auto_unverified and suspends only when an admin requires consent for access', async () => {
    const db = memory()
    const { user, consent } = child(12, 'under_13')
    consent.method = 'email_plus'
    consent.verifiedAt = new Date()
    db.users.push(user)
    db.consents.push(consent)
    const { notice, sent } = noticeOf(db)
    await notice.notify(user.id)
    const token = new URL(String(sent[0]!.data.manageLink)).searchParams.get('token')!
    const sessions = { revokeAll: jest.fn(async () => undefined) }
    const policy = { suspend: jest.fn(async () => undefined), lift: jest.fn(async () => undefined) }
    const quiet = new GuardianManageService(
      db as never,
      notice,
      { requestByGuardian: async () => new Date(), scheduledFor: async () => new Date() } as never,
      {} as never,
      policy as never,
      sessions as never,
      settings() as never,
    )
    const session = await quiet.redeem(token)
    expect(session.summary).toMatchObject({ displayName: 'Asha Rao', ageBand: 'under_13', consentVerified: true, notes: 2, files: 1 })
    expect(JSON.stringify(session.summary)).not.toContain('@')
    const withdrawn = await quiet.withdraw(session.sessionToken)
    expect(withdrawn.consentMethod).toBe('auto_unverified')
    expect(withdrawn.consentVerified).toBe(false)
    expect(consent.verifiedAt).toBeNull()
    expect(policy.suspend).not.toHaveBeenCalled()
    expect(sessions.revokeAll).not.toHaveBeenCalled()
    expect((await rejection(() => quiet.redeem(token))).code).toBe(ErrorCode.VALIDATION)

    consent.method = 'email_plus'
    consent.verifiedAt = new Date()
    const strictNotice = noticeOf(db, { suspend: true })
    await strictNotice.notice.notify(user.id)
    const strictPolicy = { suspend: jest.fn(async () => undefined), lift: jest.fn(async () => undefined) }
    const strict = new GuardianManageService(
      db as never,
      strictNotice.notice,
      { scheduledFor: async () => new Date() } as never,
      {} as never,
      strictPolicy as never,
      sessions as never,
      settings({ suspend: true }) as never,
    )
    const again = await strict.redeem(new URL(String(strictNotice.sent[0]!.data.manageLink)).searchParams.get('token')!)
    await strict.withdraw(again.sessionToken)
    expect(strictPolicy.suspend).toHaveBeenCalled()
    expect(sessions.revokeAll).toHaveBeenCalledWith(user.id)
  })
})

describe('minor purge window defaults to 14 days', () => {
  it('uses 14 days for a minor and the adult constant for everyone else', () => {
    expect(DEFAULT_MINOR_PURGE_WINDOW_DAYS).toBe(14)
    const store = new PlatformSettingsStore({ appSetting: { upsert: async () => ({}) } } as never, { settingFallbacks: {} } as never)
    expect(store.minorPurgeWindowDays()).toBe(14)
    expect(store.emailPlusEnabled()).toBe(true)
    expect(graceDaysForAge(12, store.minorPurgeWindowDays())).toBe(14)
    expect(graceDaysForAge(17, 3)).toBe(3)
    expect(graceDaysForAge(18, 3)).toBe(DELETION_GRACE_DAYS)
    expect(graceDaysForAge(30, 3)).toBe(14)
    expect(graceDaysForAge(null, 3)).toBe(14)
  })

  it('purges a minor on the window and leaves an adult on the 14-day grace', async () => {
    const now = new Date('2026-11-20T00:00:00Z')
    const day = 86_400_000
    const rows = [
      { id: 'minor-early', deletionRequestedAt: new Date(now.getTime() - 6 * day), dateOfBirth: null, declaredAge: 12, ageDeclaredAt: now },
      { id: 'minor-due', deletionRequestedAt: new Date(now.getTime() - 8 * day), dateOfBirth: null, declaredAge: 12, ageDeclaredAt: now },
      { id: 'adult-early', deletionRequestedAt: new Date(now.getTime() - 10 * day), dateOfBirth: null, declaredAge: 30, ageDeclaredAt: now },
      { id: 'adult-due', deletionRequestedAt: new Date(now.getTime() - 15 * day), dateOfBirth: null, declaredAge: 30, ageDeclaredAt: now },
    ]
    const erased: string[] = []
    const service = new AccountDeletionService(
      {
        user: {
          findMany: async () => rows,
          findUniqueOrThrow: async () => ({ avatarFileId: null }),
        },
        dataExport: { findMany: async () => [] },
        verificationRequest: { findMany: async () => [] },
        $transaction: async () => undefined,
      } as never,
      {} as never,
      { revokeAll: async () => undefined } as never,
      { record: async () => undefined } as never,
      { delete: async () => undefined } as never,
      {} as never,
      { publish: async () => undefined } as never,
      {} as never,
      { minorPurgeWindowDays: () => 7 } as never,
    )
    service['erase'] = async (id: string) => {
      erased.push(id)
    }
    expect((await service.deleteDue(now)).deleted).toBe(2)
    expect(erased).toEqual(['minor-due', 'adult-due'])
  })
})

describe('minor purge deletes Firebase, FCM, installations and R2, and keeps the consent row', () => {
  it('clears the parent email and logs counts only', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)
    const calls: string[] = []
    const consent = { parentEmail: PARENT as string | null }
    const db = {
      oAuthAccount: { findMany: async () => (calls.push('auth-list'), [{ providerSubject: 'firebase-uid' }]) },
      deviceToken: {
        findMany: async () => [{ token: 'fcm-token' }],
        deleteMany: async () => (calls.push('fcm-row'), { count: 1 }),
      },
      firebaseInstallation: {
        findMany: async () => [{ fid: 'fid-1' }],
        deleteMany: async () => (calls.push('install-row'), { count: 1 }),
      },
      guardianConsent: {
        updateMany: async ({ data }: { data: { parentEmail: null } }) => {
          calls.push('anonymise')
          consent.parentEmail = data.parentEmail
          return { count: 1 }
        },
        deleteMany: async () => {
          calls.push('delete-consent')
          return { count: 1 }
        },
      },
    }
    const firebase = {
      deleteAuthUser: async (uid: string) => (calls.push(`auth:${uid}`), 'deleted' as const),
      deleteRegistration: async () => (calls.push('fcm-remote'), 'deleted' as const),
      deleteInstallation: async () => (calls.push('install-remote'), 'absent' as const),
    }
    const files = { purgeOwner: async () => (calls.push('r2'), { objects: 4 }) }
    const report = await new MinorPurgeService(db as never, files as never, firebase as never).purge('child-1')
    expect(report).toEqual({ firebaseAuth: ['deleted'], fcmTokens: 1, installations: 1, r2Objects: 4 })
    expect(consent.parentEmail).toBeNull()
    expect(calls).toEqual(['auth-list', 'auth:firebase-uid', 'fcm-remote', 'fcm-row', 'install-remote', 'install-row', 'r2', 'anonymise'])
    expect(calls).not.toContain('delete-consent')
    const line = minorPurgeLog('child-1', report)
    expect(line).toBe('minor purge user=child-1 firebase=deleted fcm=1 installations=1 r2=4')
    expect(line).not.toContain(PARENT)
    expect(line).not.toContain('fcm-token')
    expect(line).not.toContain('firebase-uid')
    expect(log).toHaveBeenCalledWith(line)
    log.mockRestore()
  })

  it('leaves the local rows when Firebase throws, so the job can retry', async () => {
    const removed: string[] = []
    const db = {
      oAuthAccount: { findMany: async () => [{ providerSubject: 'uid' }] },
      deviceToken: { findMany: async () => [{ token: 't' }], deleteMany: async () => (removed.push('fcm'), { count: 1 }) },
      firebaseInstallation: { findMany: async () => [], deleteMany: async () => ({ count: 0 }) },
      guardianConsent: { updateMany: async () => ({ count: 0 }) },
    }
    const firebase = {
      deleteAuthUser: async () => {
        throw new Error('unavailable')
      },
      deleteRegistration: async () => 'deleted' as const,
      deleteInstallation: async () => 'deleted' as const,
    }
    await expect(new MinorPurgeService(db as never, { purgeOwner: async () => ({ objects: 0 }) } as never, firebase as never).purge('child-1')).rejects.toThrow(/unavailable/)
    expect(removed).toEqual([])
  })
})

describe('provider registration requires the parent email only after the floor', () => {
  it('writes the parent address for an admitted 8-year-old and not for a blocked 4-year-old', async () => {
    const guardians: Record<string, unknown>[] = []
    const service = new RegistrationService(
      {
        user: { findUniqueOrThrow: async () => ({ registrationCompletedAt: null, email: 'child@gmail.com' }), update: async () => ({}) },
        consentRecord: { createMany: async () => ({ count: 3 }) },
        guardianConsent: { create: async (args: { data: Record<string, unknown> }) => void guardians.push(args.data) },
        $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
      } as never,
      { check: async () => undefined } as never,
      { holdRegistration: async () => undefined } as never,
      { publish: async () => undefined } as never,
      { minimumAge: () => 5, consentAge: () => 18, guardianNoticeVersion: () => '2026-11-11' } as never,
      { email: async () => SUPPORT } as never,
      { current: () => DEFAULT_TERMS_VERSION } as never,
      { schedule: async () => undefined } as never,
    )
    await service.complete('google-8', { displayName: 'Eight', age: 8, parentEmail: PARENT, acceptedTermsVersion: DEFAULT_TERMS_VERSION })
    expect(guardians[0]).toMatchObject({ parentEmail: PARENT, method: 'auto_unverified', ageBand: 'under_13' })
    expect((await rejection(() => service.complete('google-4', { displayName: 'Four', age: 4, parentEmail: PARENT, acceptedTermsVersion: DEFAULT_TERMS_VERSION }))).code).toBe(ErrorCode.AGE_RESTRICTED)
    expect(guardians).toHaveLength(1)
  })
})
