import { createHash } from 'node:crypto'
import { Prisma } from '@lvn-backend/prisma-base'
import { AppError, ErrorCode } from '@lvn-backend/errors'
import { AccountAdminService, emailHash, type ManagedUser } from '../../src/application/account-admin.service'
import { AGE_BLOCK_REASON, ageOn } from '../../src/domain/rules'
import { STUDY_PUBLISHER_EMAIL, STUDY_PUBLISHER_ID } from '../../src/domain/study-publisher'

const ADMIN = 'admin-1'
const USER = 'user-1'

type Row = {
  id: string
  email: string
  displayName: string
  handle: string
  dateOfBirth: Date | null
  declaredAge: number | null
  ageDeclaredAt: Date | null
  accountStatus: 'ACTIVE' | 'AGE_BLOCKED' | 'BLOCKED' | 'SUSPENDED'
  statusReason: string | null
  globalRole: string
  createdAt: Date
  deletedAt: Date | null
  suspendedUntil?: Date | null
  suspensionReason?: string | null
}

function row(over: Partial<Row> = {}): Row {
  return {
    id: USER,
    email: 'asha@example.com',
    displayName: 'Asha Rao',
    handle: 'asharao',
    dateOfBirth: new Date('2012-01-01T00:00:00Z'),
    declaredAge: null,
    ageDeclaredAt: null,
    accountStatus: 'AGE_BLOCKED',
    statusReason: AGE_BLOCK_REASON,
    globalRole: 'STUDENT',
    createdAt: new Date('2026-01-02T00:00:00Z'),
    deletedAt: null,
    suspendedUntil: null,
    suspensionReason: null,
    ...over,
  }
}

function harness(initial: Row = row(), minimum = 18) {
  let current = { ...initial }
  const audits: { action: string; actorId?: string; metadata?: Record<string, unknown> }[] = []
  const revoked: string[] = []
  const erased: unknown[][] = []
  const queries: unknown[] = []
  const audience: { userId: string; previousEmail: string }[] = []
  const db = {
    user: {
      findUnique: async () => ({ ...current }),
      findMany: async (args: unknown) => {
        queries.push(args)
        return [{ ...current }]
      },
      count: async (args: unknown) => {
        queries.push(args)
        return 1
      },
      update: async ({ data }: { data: Partial<Row> }) => {
        current = { ...current, ...data }
        return current
      },
    },
  }
  const service = new AccountAdminService(
    db as never,
    { actor: async (id: string) => (id === ADMIN ? { globalRole: 'PLATFORM_ADMIN' } : id === 'missing' ? null : { globalRole: 'STUDENT' }) } as never,
    { minimumAge: () => minimum } as never,
    { revokeAll: async (id: string) => void revoked.push(id) } as never,
    { record: async (entry: { action: string; metadata?: Record<string, unknown> }) => void audits.push(entry) } as never,
    { adminErase: async (...args: unknown[]) => void erased.push(args) } as never,
    { scheduleEmailChange: async (userId: string, previousEmail: string) => void audience.push({ userId, previousEmail }) } as never,
  )
  return {
    service,
    audits,
    revoked,
    erased,
    queries,
    audience,
    current: () => current,
    failEmail: () => {
      db.user.update = async () => {
        throw new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' })
      }
    },
  }
}

async function rejection(run: () => Promise<unknown>): Promise<AppError> {
  try {
    await run()
  } catch (e) {
    return e as AppError
  }
  throw new Error('expected a rejection')
}

describe('AccountAdminService', () => {
  it('lists one standing and searches name, email and handle', async () => {
    const h = harness()
    const listed = await h.service.list(ADMIN, 'AGE_BLOCKED', '  Asha ', 500)
    expect(listed.total).toBe(1)
    expect(listed.users[0]).toMatchObject({ id: USER, dateOfBirth: '2012-01-01', age: ageOn(new Date('2012-01-01T00:00:00Z')), accountStatus: 'AGE_BLOCKED' })
    expect(h.queries[0]).toMatchObject({
      take: 100,
      where: {
        deletedAt: null,
        accountStatus: 'AGE_BLOCKED',
        OR: [
          { email: { contains: 'Asha', mode: 'insensitive' } },
          { displayName: { contains: 'Asha', mode: 'insensitive' } },
          { handle: { contains: 'Asha', mode: 'insensitive' } },
        ],
      },
    })
    await h.service.list(ADMIN, 'BLOCKED_OR_SUSPENDED', ' ', 0)
    expect(h.queries[2]).toMatchObject({ take: 1, where: { deletedAt: null, accountStatus: { in: ['BLOCKED', 'SUSPENDED'] } } })
    await h.service.list(ADMIN, 'ACTIVE', null, null)
    expect(h.queries[4]).toMatchObject({ take: 50, where: { deletedAt: null, accountStatus: 'ACTIVE' } })
  })

  it('refuses anyone who is not a platform admin', async () => {
    const h = harness()
    const err = await rejection(() => h.service.list('student', 'ACTIVE', null, null))
    expect(err).toBeInstanceOf(AppError)
    expect(err.code).toBe(ErrorCode.FORBIDDEN)
    expect(await rejection(() => h.service.list('missing', 'ACTIVE', null, null))).toMatchObject({ code: ErrorCode.FORBIDDEN })
  })

  it('rejects an empty reason before a date of birth can clear an age block', async () => {
    const h = harness()
    const err = await rejection(() => h.service.update(ADMIN, { userId: USER, dateOfBirth: '2000-01-01', reason: '   ' }))
    expect(err).toMatchObject({ code: ErrorCode.VALIDATION, field: ['input', 'reason'] })
    expect(h.current().accountStatus).toBe('AGE_BLOCKED')
    expect(h.audits).toEqual([])
  })

  it('keeps the account age-blocked when the corrected date is still too young', async () => {
    const h = harness(row({ accountStatus: 'ACTIVE', statusReason: null, dateOfBirth: new Date('2000-01-01T00:00:00Z') }))
    const user = await h.service.update(ADMIN, { userId: USER, dateOfBirth: '2014-06-01', reason: 'Parent asked for a correction' })
    expect(user).toMatchObject({ accountStatus: 'AGE_BLOCKED', statusReason: AGE_BLOCK_REASON, dateOfBirth: '2014-06-01' })
    expect(h.revoked).toEqual([USER])
    expect(h.audits[0]).toMatchObject({ action: 'account.admin.updated', metadata: { reason: 'Parent asked for a correction', fields: ['dateOfBirth'], ageUnblocked: false } })
  })

  it('does not revoke again when the account was already age-blocked', async () => {
    const h = harness()
    await h.service.update(ADMIN, { userId: USER, displayName: 'Asha R', reason: 'Spelling' })
    expect(h.current().accountStatus).toBe('AGE_BLOCKED')
    expect(h.revoked).toEqual([])
  })

  it('clears AGE_BLOCKED when the new date of birth passes and a reason is recorded', async () => {
    const h = harness()
    const user = await h.service.update(ADMIN, { userId: USER, dateOfBirth: '2000-05-01', email: 'Asha.Rao@Example.com', reason: 'Document shows 2000' })
    expect(user).toMatchObject({ accountStatus: 'ACTIVE', statusReason: null, dateOfBirth: '2000-05-01', email: 'asha.rao@example.com' })
    expect(h.revoked).toEqual([])
    expect(h.audits[0]!.metadata).toMatchObject({ ageUnblocked: true, fields: ['email', 'dateOfBirth'] })
    expect(JSON.stringify(h.audits)).not.toContain('asha.rao@example.com')
    expect(h.audience).toEqual([{ userId: USER, previousEmail: 'asha@example.com' }])
  })

  it('does not clear a block or a suspension just because the date of birth passes', async () => {
    const h = harness(row({ accountStatus: 'BLOCKED', statusReason: 'Spam', dateOfBirth: new Date('2012-01-01T00:00:00Z') }))
    const user = await h.service.update(ADMIN, { userId: USER, dateOfBirth: '1999-01-01', reason: 'Also fixing the birthday' })
    expect(user.accountStatus).toBe('BLOCKED')
    expect(user.statusReason).toBe('Spam')
    expect(h.revoked).toEqual([])
  })

  it('reports an email that is already taken', async () => {
    const h = harness()
    h.failEmail()
    const err = await rejection(() => h.service.update(ADMIN, { userId: USER, email: 'taken@example.com', reason: 'Typo' }))
    expect(err).toMatchObject({ code: ErrorCode.CONFLICT, field: ['input', 'email'] })
  })

  it('refuses an edit that changes nothing, and a deleted or publisher account', async () => {
    const h = harness()
    expect(await rejection(() => h.service.update(ADMIN, { userId: USER, reason: 'Nothing' }))).toMatchObject({ code: ErrorCode.VALIDATION })
    const gone = harness(row({ deletedAt: new Date() }))
    expect(await rejection(() => gone.service.update(ADMIN, { userId: USER, displayName: 'X', reason: 'Gone' }))).toMatchObject({ code: ErrorCode.NOT_FOUND })
    const publisher = harness(row({ id: STUDY_PUBLISHER_ID, email: STUDY_PUBLISHER_EMAIL }))
    expect(await rejection(() => publisher.service.update(ADMIN, { userId: STUDY_PUBLISHER_ID, displayName: 'X', reason: 'No' }))).toMatchObject({ code: ErrorCode.NOT_FOUND })
  })

  it('refuses to mark an under-age account active without correcting the date of birth', async () => {
    const h = harness()
    const err = await rejection(() => h.service.setStanding(ADMIN, { userId: USER, status: 'ACTIVE', reason: 'Let them in' }))
    expect(err).toMatchObject({ code: ErrorCode.VALIDATION, field: ['input', 'dateOfBirth'] })
    expect(h.current().accountStatus).toBe('AGE_BLOCKED')
    const stillYoung = harness(row({ accountStatus: 'ACTIVE', dateOfBirth: new Date('2015-01-01T00:00:00Z'), statusReason: null }))
    expect(await rejection(() => stillYoung.service.setStanding(ADMIN, { userId: USER, status: 'ACTIVE', reason: 'Already active' }))).toMatchObject({ code: ErrorCode.VALIDATION })
  })

  it('refuses a hand-set age block, and an admin changing their own standing', async () => {
    const h = harness(row({ accountStatus: 'ACTIVE', dateOfBirth: new Date('2000-01-01T00:00:00Z'), statusReason: null }))
    expect(await rejection(() => h.service.setStanding(ADMIN, { userId: USER, status: 'AGE_BLOCKED', reason: 'Too young' }))).toMatchObject({ code: ErrorCode.VALIDATION, field: ['input', 'status'] })
    expect(await rejection(() => h.service.setStanding(ADMIN, { userId: ADMIN, status: 'BLOCKED', reason: 'Myself' }))).toMatchObject({ code: ErrorCode.VALIDATION, field: ['input', 'userId'] })
  })

  it('accepts the ISO-8601 string a GraphQL DateTime input arrives as', async () => {
    const h = harness(row({ accountStatus: 'ACTIVE', dateOfBirth: new Date('2000-01-01T00:00:00Z'), statusReason: null }))
    const until = new Date(Date.now() + 86_400_000).toISOString()
    const suspended = await h.service.setStanding(ADMIN, { userId: USER, status: 'SUSPENDED', reason: 'Review', until: until as unknown as Date })
    expect(suspended).toMatchObject({ accountStatus: 'SUSPENDED', statusReason: 'Review' })
    expect(h.audits[0]).toMatchObject({ action: 'account.admin.suspended', metadata: { until } })
  })

  it('blocks and suspends with a reason, revokes sessions, and restores a blocked account', async () => {
    const h = harness(row({ accountStatus: 'ACTIVE', dateOfBirth: new Date('2000-01-01T00:00:00Z'), statusReason: null }))
    const until = new Date(Date.now() + 86_400_000)
    expect(await rejection(() => h.service.setStanding(ADMIN, { userId: USER, status: 'SUSPENDED', reason: 'Review', until: new Date(Date.now() - 1000) }))).toMatchObject({ field: ['input', 'until'] })
    const suspended = await h.service.setStanding(ADMIN, { userId: USER, status: 'SUSPENDED', reason: 'Review the report', until })
    expect(suspended).toMatchObject({ accountStatus: 'SUSPENDED', statusReason: 'Review the report' })
    expect(h.revoked).toEqual([USER])
    expect(h.audits[0]).toMatchObject({ action: 'account.admin.suspended', metadata: { reason: 'Review the report' } })

    const blocked = await h.service.setStanding(ADMIN, { userId: USER, status: 'BLOCKED', reason: 'Confirmed spam' })
    expect(blocked).toMatchObject({ accountStatus: 'BLOCKED', statusReason: 'Confirmed spam' })
    expect(h.revoked).toEqual([USER, USER])

    const restored = await h.service.setStanding(ADMIN, { userId: USER, status: 'ACTIVE', reason: 'Appeal accepted' })
    expect(restored).toMatchObject({ accountStatus: 'ACTIVE', statusReason: null })
    expect(h.audits.map((a) => a.action)).toEqual(['account.admin.suspended', 'account.admin.blocked', 'account.admin.unblocked'])
    expect(h.audits[2]).toMatchObject({ actorId: ADMIN, metadata: { reason: 'Appeal accepted' } })
  })

  it('deletes only with the exact word DELETE, and stores a hash rather than the email', async () => {
    const h = harness(row({ accountStatus: 'ACTIVE', dateOfBirth: new Date('2000-01-01T00:00:00Z'), statusReason: null }))
    expect(await rejection(() => h.service.delete(ADMIN, { userId: USER, reason: 'Requested', confirm: 'delete' }))).toMatchObject({ field: ['input', 'confirm'] })
    expect(await rejection(() => h.service.delete(ADMIN, { userId: ADMIN, reason: 'Myself', confirm: 'DELETE' }))).toMatchObject({ field: ['input', 'userId'] })
    await h.service.delete(ADMIN, { userId: USER, reason: '  User asked  ', confirm: 'DELETE' })
    const hash = createHash('sha256').update('asha@example.com').digest('hex')
    expect(emailHash('  Asha@Example.com ')).toBe(hash)
    expect(h.erased).toEqual([[USER, ADMIN, 'User asked', hash]])
    expect(JSON.stringify(h.erased)).not.toContain('asha@example.com')
  })
})

describe('declared ages (ADR-0104)', () => {
  /** An account registered with an age, not a date of birth. */
  const declared = (age: number, over: Partial<Row> = {}) => row({ dateOfBirth: null, declaredAge: age, ageDeclaredAt: new Date(), ...over })

  it('clears AGE_BLOCKED at 13 and keeps it at 12 even when the configured floor is 8 (ADR-0113)', async () => {
    const passed = harness(declared(12), 8)
    const user = await passed.service.update(ADMIN, { userId: USER, age: 13, reason: 'Now old enough' })
    expect(user).toMatchObject({ accountStatus: 'ACTIVE', statusReason: null, age: 13 })
    const held = harness(declared(14, { accountStatus: 'ACTIVE', statusReason: null }), 8)
    const blocked = await held.service.update(ADMIN, { userId: USER, age: 12, reason: 'Typed the wrong age' })
    expect(blocked).toMatchObject({ accountStatus: 'AGE_BLOCKED', age: 12 })
    expect(held.revoked).toEqual([USER])
  })

  it('keeps an account age-blocked while the corrected age is still too young', async () => {
    const h = harness(declared(15))
    const user = await h.service.update(ADMIN, { userId: USER, age: 16, reason: 'Parent asked for a correction' })
    expect(user).toMatchObject({ accountStatus: 'AGE_BLOCKED', statusReason: AGE_BLOCK_REASON, age: 16, dateOfBirth: null })
    expect(h.current()).toMatchObject({ declaredAge: 16, dateOfBirth: null })
    expect(h.audits[0]).toMatchObject({ action: 'account.admin.updated', metadata: { fields: ['age'], ageUnblocked: false } })
  })

  it('clears AGE_BLOCKED when the corrected age passes, and records when it was given', async () => {
    const h = harness(declared(15, { ageDeclaredAt: new Date('2026-01-01T00:00:00Z') }))
    const before = Date.now()
    const user = await h.service.update(ADMIN, { userId: USER, age: 19, reason: 'Document shows an adult' })
    expect(user).toMatchObject({ accountStatus: 'ACTIVE', statusReason: null, age: 19 })
    expect(h.current().declaredAge).toBe(19)
    expect(h.current().ageDeclaredAt!.getTime()).toBeGreaterThanOrEqual(before)
    expect(h.audits[0]!.metadata).toMatchObject({ fields: ['age'], ageUnblocked: true })
    expect(JSON.stringify(h.audits)).not.toContain('19')
  })

  it('age-blocks an active account whose corrected age is too young and ends its sessions', async () => {
    const h = harness(declared(30, { accountStatus: 'ACTIVE', statusReason: null }))
    const user = await h.service.update(ADMIN, { userId: USER, age: 14, reason: 'Typed the wrong age' })
    expect(user).toMatchObject({ accountStatus: 'AGE_BLOCKED', age: 14 })
    expect(h.revoked).toEqual([USER])
  })

  it.each([0, 121, 17.5])('refuses the age %p before changing anything', async (age) => {
    const h = harness(declared(15))
    expect(await rejection(() => h.service.update(ADMIN, { userId: USER, age, reason: 'Fix' }))).toMatchObject({ code: ErrorCode.VALIDATION, field: ['input', 'age'] })
    expect(h.current()).toMatchObject({ declaredAge: 15, accountStatus: 'AGE_BLOCKED' })
    expect(h.audits).toEqual([])
  })

  it('refuses an age for an account whose date of birth decides it, and an age with a date of birth', async () => {
    const h = harness()
    expect(await rejection(() => h.service.update(ADMIN, { userId: USER, age: 30, reason: 'Fix' }))).toMatchObject({ code: ErrorCode.VALIDATION, field: ['input', 'age'] })
    expect(h.current()).toMatchObject({ dateOfBirth: new Date('2012-01-01T00:00:00Z'), declaredAge: null, accountStatus: 'AGE_BLOCKED' })
    const both = harness(declared(15))
    expect(await rejection(() => both.service.update(ADMIN, { userId: USER, age: 30, dateOfBirth: '1996-01-01', reason: 'Fix' }))).toMatchObject({ code: ErrorCode.VALIDATION, field: ['input', 'age'] })
    expect(both.audits).toEqual([])
  })

  it('lets a date of birth correct a declared age', async () => {
    const h = harness(declared(15))
    const user = await h.service.update(ADMIN, { userId: USER, dateOfBirth: '2000-05-01', reason: 'Document shows 2000' })
    expect(user).toMatchObject({ accountStatus: 'ACTIVE', dateOfBirth: '2000-05-01', age: ageOn(new Date('2000-05-01T00:00:00Z')) })
  })

  it('points a refused activation at the age', async () => {
    const h = harness(declared(15))
    const err = await rejection(() => h.service.setStanding(ADMIN, { userId: USER, status: 'ACTIVE', reason: 'Let them in' }))
    expect(err).toMatchObject({ code: ErrorCode.VALIDATION, field: ['input', 'age'] })
    expect(err.message).not.toMatch(/18/)
    const stillYoung = harness(declared(15, { accountStatus: 'ACTIVE', statusReason: null }))
    expect(await rejection(() => stillYoung.service.setStanding(ADMIN, { userId: USER, status: 'ACTIVE', reason: 'Already active' }))).toMatchObject({ field: ['input', 'age'] })
  })
})

describe('managed user shape', () => {
  it('omits a missing date of birth', async () => {
    const h = harness(row({ dateOfBirth: null, accountStatus: 'ACTIVE', statusReason: null }))
    const listed: { users: ManagedUser[] } = await h.service.list(ADMIN, 'ACTIVE', null, 10)
    expect(listed.users[0]!.dateOfBirth).toBeNull()
    expect(listed.users[0]!.age).toBeNull()
  })

  it('shows a declared age counted forward by whole years, and no date of birth', async () => {
    const twoYearsAgo = new Date()
    twoYearsAgo.setUTCFullYear(twoYearsAgo.getUTCFullYear() - 2)
    twoYearsAgo.setUTCDate(twoYearsAgo.getUTCDate() - 1)
    const h = harness(row({ dateOfBirth: null, declaredAge: 17, ageDeclaredAt: twoYearsAgo, accountStatus: 'ACTIVE', statusReason: null }))
    const listed: { users: ManagedUser[] } = await h.service.list(ADMIN, 'ACTIVE', null, 10)
    expect(listed.users[0]).toMatchObject({ dateOfBirth: null, age: 19 })
    expect(listed.users[0]).not.toHaveProperty('declaredAge')
    expect(listed.users[0]).not.toHaveProperty('ageDeclaredAt')
  })
})
