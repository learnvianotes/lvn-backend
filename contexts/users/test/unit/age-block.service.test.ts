import { Prisma } from '@lvn-backend/prisma-base'
import { AgeBlockService } from '../../src/application/age-block.service'
import { AGE_BLOCK_REASON } from '../../src/domain/rules'

function harness(opts: { duplicate?: boolean } = {}) {
  const users: Record<string, unknown>[] = []
  const consents: unknown[] = []
  const audits: { action: string; metadata?: Record<string, unknown> }[] = []
  const revoked: string[] = []
  const db = {
    user: {
      findUnique: async ({ where }: { where: { email?: string; handle?: string } }) => {
        if (where.email) return users.find((u) => u.email === where.email) ?? null
        if (where.handle) return users.find((u) => u.handle === where.handle) ?? null
        return null
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        if (opts.duplicate) throw new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' })
        users.push(data)
        return data
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = users.find((u) => u.id === where.id)
        if (row) Object.assign(row, data)
        return row
      },
    },
    consentRecord: { createMany: async ({ data }: { data: unknown[] }) => void consents.push(...data) },
    $transaction: async (work: unknown) => (Array.isArray(work) ? Promise.all(work) : (work as (tx: unknown) => Promise<unknown>)(db)),
  }
  const service = new AgeBlockService(
    db as never,
    { revokeAll: async (id: string) => void revoked.push(id) } as never,
    { record: async (entry: { action: string; metadata?: Record<string, unknown> }) => void audits.push(entry) } as never,
  )
  return { service, users, consents, audits, revoked }
}

const dob = new Date('2012-04-01T00:00:00Z')

describe('AgeBlockService', () => {
  it('creates an age-blocked account with consents and no session', async () => {
    const h = harness()
    await h.service.holdSignUp({ email: 'young@example.com', displayName: 'Young One', dateOfBirth: dob, passwordHash: 'hash', globalRole: 'STUDENT' })
    expect(h.users).toHaveLength(1)
    expect(h.users[0]).toMatchObject({
      email: 'young@example.com',
      displayName: 'Young One',
      accountStatus: 'AGE_BLOCKED',
      statusReason: AGE_BLOCK_REASON,
      analyticsOptOut: true,
      passwordHash: 'hash',
      globalRole: 'STUDENT',
    })
    expect(h.users[0]!.registrationCompletedAt).toBeInstanceOf(Date)
    expect(h.consents).toHaveLength(3)
    expect(h.revoked).toEqual([])
    expect(h.audits).toMatchObject([{ action: 'account.age_blocked', targetType: 'USER', metadata: { source: 'sign_up' } }])
  })

  it('does not rewrite an account that already has the address', async () => {
    const h = harness()
    h.users.push({ id: 'adult', email: 'meera@example.com', deletedAt: null, displayName: 'Meera Iyer', passwordHash: null })
    await h.service.holdSignUp({ email: 'meera@example.com', displayName: 'Other', dateOfBirth: dob, passwordHash: 'hash', globalRole: 'STUDENT' })
    expect(h.users).toHaveLength(1)
    expect(h.users[0]).toMatchObject({ displayName: 'Meera Iyer', passwordHash: null })
    expect(h.audits).toEqual([])
    expect(h.consents).toEqual([])
  })

  it('treats a unique-email race as already held', async () => {
    const h = harness({ duplicate: true })
    await expect(h.service.holdSignUp({ email: 'race@example.com', displayName: 'Race', dateOfBirth: dob, passwordHash: 'hash', globalRole: 'STUDENT' })).resolves.toBeUndefined()
    expect(h.users).toEqual([])
    expect(h.audits).toEqual([])
  })

  it('holds a provider account, stores the date of birth, and ends its session', async () => {
    const h = harness()
    h.users.push({ id: 'google-1', email: 'young@gmail.com', displayName: 'Google', deletedAt: null })
    await h.service.holdRegistration('google-1', 'Young One', dob)
    expect(h.users[0]).toMatchObject({ displayName: 'Young One', dateOfBirth: dob, accountStatus: 'AGE_BLOCKED', statusReason: AGE_BLOCK_REASON, analyticsOptOut: true })
    expect(h.users[0]!.registrationCompletedAt).toBeInstanceOf(Date)
    expect(h.users[0]!.deletedAt).toBeNull()
    expect(h.revoked).toEqual(['google-1'])
    expect(h.consents).toHaveLength(3)
    expect(h.audits).toMatchObject([{ action: 'account.age_blocked', actorId: 'google-1', targetType: 'USER', metadata: { source: 'registration' } }])
  })
})
