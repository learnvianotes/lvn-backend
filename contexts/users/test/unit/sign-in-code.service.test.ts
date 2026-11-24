import { ErrorCode, type AppError } from '@lvn-backend/errors'
import { SignInCodeService } from '../../src/application/sign-in-code.service'
import { cleanName } from '../../src/application/passkey.service'
import { SIGN_IN_CODE_MAX_ATTEMPTS } from '../../src/domain/rules'

type Row = { id: string; userId: string; codeHash: Uint8Array; expiresAt: Date; attempts: number; usedAt: Date | null; createdAt: Date }

function world(user: { id: string; email: string; displayName: string; deletedAt: Date | null; emailVerifiedAt: Date | null; passwordHash: string | null } | null) {
  const rows: Row[] = []
  const sent: { to: string; code: string }[] = []
  const db = {
    user: { findUnique: async () => user, update: jest.fn(async ({ data }: { data: { emailVerifiedAt: Date } }) => user && Object.assign(user, data)) },
    signInCode: {
      updateMany: jest.fn(async ({ where, data }: { where: { id?: string; userId?: string; usedAt: null }; data: Partial<Row> }) => {
        const hit = rows.filter((r) => (where.id ? r.id === where.id : r.userId === where.userId) && r.usedAt === null)
        hit.forEach((r) => Object.assign(r, data))
        return { count: hit.length }
      }),
      create: async ({ data }: { data: Omit<Row, 'attempts' | 'usedAt' | 'createdAt'> }) => rows.push({ ...data, attempts: 0, usedAt: null, createdAt: new Date(Date.now() + rows.length) }),
      findFirst: async () => [...rows].filter((r) => r.usedAt === null).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => Object.assign(rows.find((r) => r.id === where.id)!, data),
    },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  }
  const limiter = { hit: async () => ({ allowed: true, retryAfter: 0, remaining: 1 }), peek: async () => ({ allowed: true, retryAfter: 0, remaining: 1 }), reset: async () => undefined }
  const sessions = { start: jest.fn(async (userId: string) => ({ userId, familyId: 'f' })) }
  const mailer = { send: jest.fn(async (to: string, _t: string, d: { code: string }) => void sent.push({ to, code: d.code })) }
  const svc = new SignInCodeService(
    db as never,
    limiter as never,
    sessions as never,
    { assertAllowed: async () => undefined } as never,
    { match: async () => undefined } as never,
    mailer as never,
    { codeHmacSecret: 'test-secret-test-secret-test-secret' } as never,
  )
  return { svc, rows, sent, sessions, mailer, db }
}

const asha = () => ({ id: '01920000-0000-7000-8000-00000000aaaa', email: 'asha@example.com', displayName: 'Asha', deletedAt: null, emailVerifiedAt: null as Date | null, passwordHash: null })
const fails = (run: () => Promise<unknown>) => run().then(() => Promise.reject(new Error('expected a rejection')), (e: AppError) => e)

describe('sign in with an emailed code (ADR-0115)', () => {
  it('says ok and sends nothing when no account has the address', async () => {
    const w = world(null)
    await expect(w.svc.request('nobody@example.com')).resolves.toBeUndefined()
    expect(w.mailer.send).not.toHaveBeenCalled()
    expect(w.rows).toHaveLength(0)
  })

  it('emails a 6-digit code and stores only its HMAC', async () => {
    const w = world(asha())
    await w.svc.request('Asha@Example.com')
    expect(w.sent).toHaveLength(1)
    expect(w.sent[0]!.code).toMatch(/^\d{6}$/)
    expect(Buffer.from(w.rows[0]!.codeHash).toString()).not.toContain(w.sent[0]!.code)
  })

  it('signs in once with the right code, and marks the email verified', async () => {
    const user = asha()
    const w = world(user)
    await w.svc.request(user.email)
    await expect(w.svc.signIn(user.email, ` ${w.sent[0]!.code.slice(0, 3)} ${w.sent[0]!.code.slice(3)} `, { client: 'web' })).resolves.toMatchObject({ userId: user.id })
    expect(user.emailVerifiedAt).toBeInstanceOf(Date)
    const again = await fails(() => w.svc.signIn(user.email, w.sent[0]!.code, { client: 'web' }))
    expect(again.code).toBe(ErrorCode.VALIDATION)
  })

  it('a new request makes the earlier code stop working', async () => {
    const user = asha()
    const w = world(user)
    await w.svc.request(user.email)
    await w.svc.request(user.email)
    expect((await fails(() => w.svc.signIn(user.email, w.sent[0]!.code, { client: 'web' }))).code).toBe(ErrorCode.VALIDATION)
    await expect(w.svc.signIn(user.email, w.sent[1]!.code, { client: 'web' })).resolves.toBeTruthy()
  })

  it(`burns the code after ${SIGN_IN_CODE_MAX_ATTEMPTS} wrong tries`, async () => {
    const user = asha()
    const w = world(user)
    await w.svc.request(user.email)
    const right = w.sent[0]!.code
    const wrong = right === '000000' ? '111111' : '000000'
    for (let i = 0; i < SIGN_IN_CODE_MAX_ATTEMPTS; i++) await fails(() => w.svc.signIn(user.email, wrong, { client: 'web' }))
    expect((await fails(() => w.svc.signIn(user.email, right, { client: 'web' }))).code).toBe(ErrorCode.VALIDATION)
    expect(w.sessions.start).not.toHaveBeenCalled()
  })

  it('refuses an expired code', async () => {
    const user = asha()
    const w = world(user)
    await w.svc.request(user.email)
    w.rows[0]!.expiresAt = new Date(Date.now() - 1)
    expect((await fails(() => w.svc.signIn(user.email, w.sent[0]!.code, { client: 'web' }))).code).toBe(ErrorCode.VALIDATION)
  })

  it('gives the same answer for an unknown address as for a wrong code', async () => {
    const w = world(null)
    const err = await fails(() => w.svc.signIn('nobody@example.com', '123456', { client: 'web' }))
    expect(err.message).toBe('That code is incorrect or has expired. Ask for a new one.')
  })
})

describe('passkey names', () => {
  it('keeps names short and plain', () => {
    expect(cleanName('  Pixel\u0000 8  ')).toBe('Pixel 8')
    expect(cleanName('')).toBe('Passkey')
    expect(cleanName('x'.repeat(100))).toHaveLength(60)
  })
})
