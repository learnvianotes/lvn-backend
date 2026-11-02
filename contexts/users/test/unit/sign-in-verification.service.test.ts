import { Prisma } from '@lvn-backend/prisma-base'
import { ErrorCode, type AppError } from '@lvn-backend/errors'
import { GlobalRole } from '@lvn/contracts/domain'
import { AdminService } from '../../src/application/admin.service'
import { AuthService } from '../../src/application/auth.service'
import { OAuthService } from '../../src/application/oauth.service'
import { UsersService } from '../../src/application/users.service'
import { VerificationService } from '../../src/application/verification.service'

function rejection(run: () => Promise<unknown>): Promise<AppError> {
  return run().then(
    () => Promise.reject(new Error('expected a rejection')),
    (e: AppError) => e,
  )
}

const duplicate = () => new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' })

describe('resendVerification and verifyEmail', () => {
  function auth(opts: {
    user?: { id: string; email: string; displayName: string; emailVerifiedAt: Date | null; deletedAt?: Date | null } | null
    limit?: { allowed: boolean; retryAfter?: number }
  }) {
    const sent: unknown[][] = []
    const hits: string[] = []
    const updates: unknown[] = []
    const service = new AuthService(
      {
        user: {
          findFirst: async () => opts.user,
          findUnique: async () => (opts.user ? { id: opts.user.id, email: opts.user.email, deletedAt: null } : null),
          findUniqueOrThrow: async () => ({ id: opts.user!.id, email: opts.user!.email }),
          update: async (args: { data: unknown }) => {
            updates.push(args.data)
            return { id: opts.user!.id, email: opts.user!.email }
          },
          updateMany: async () => ({ count: 1 }),
        },
        emailToken: {
          findUnique: async () => ({
            id: 'tok',
            userId: opts.user?.id ?? 'u',
            purpose: 'VERIFY_EMAIL',
            usedAt: null,
            expiresAt: new Date(Date.now() + 60_000),
            passwordHash: null,
          }),
          updateMany: async () => ({ count: 1 }),
          create: async () => ({ id: 'mail' }),
        },
      } as never,
      {} as never,
      {} as never,
      { hit: async (key: string) => (hits.push(key), opts.limit ?? { allowed: true, retryAfter: 0 }) } as never,
      {} as never,
      { match: async () => undefined } as never,
      { send: async (...args: unknown[]) => void sent.push(args) } as never,
      {} as never,
      { webUrl: 'https://web.example' } as never,
      {} as never,
      { assertAllowed: async () => undefined, allows: async () => true } as never,
      {} as never,
      {} as never,
    )
    return { service, sent, hits, updates }
  }

  it('sends a verification email to a signed-in unverified account and spends the limit', async () => {
    const { service, sent, hits } = auth({ user: { id: 'u', email: 'a@b.com', displayName: 'Asha', emailVerifiedAt: null } })
    await service.resendVerification('u')
    expect(hits).toEqual(['verify-resend:u'])
    expect(sent).toHaveLength(1)
    expect(sent[0]![1]).toBe('verifyEmail')
  })

  it('does nothing when the login email is already verified', async () => {
    const { service, sent, hits } = auth({ user: { id: 'u', email: 'a@b.com', displayName: 'Asha', emailVerifiedAt: new Date() } })
    await service.resendVerification('u')
    expect(hits).toEqual([])
    expect(sent).toEqual([])
  })

  it('refuses a signed-out or missing account and a spent limit', async () => {
    const missing = auth({ user: null })
    expect((await rejection(() => missing.service.resendVerification('gone'))).code).toBe(ErrorCode.UNAUTHENTICATED)
    const limited = auth({ user: { id: 'u', email: 'a@b.com', displayName: 'Asha', emailVerifiedAt: null }, limit: { allowed: false, retryAfter: 30 } })
    expect((await rejection(() => limited.service.resendVerification('u'))).code).toBe(ErrorCode.RATE_LIMITED)
    expect(limited.sent).toEqual([])
  })

  it('returns the user id after the login email is confirmed and does not set institution verification', async () => {
    const { service, updates } = auth({ user: { id: 'u', email: 'a@b.com', displayName: 'Asha', emailVerifiedAt: null } })
    await expect(service.verifyEmail('token')).resolves.toEqual({ userId: 'u' })
    expect(updates).toEqual([{ emailVerifiedAt: expect.any(Date) }])
    expect(updates[0]).not.toHaveProperty('verifiedAt')
  })
})

describe('provider linking', () => {
  const identity = { provider: 'GOOGLE' as const, providerSubject: 'gid', email: 'Person@Example.com', emailVerified: true, name: 'Person' }

  function oauth(opts: { existing?: { id: string; email: string; deletedAt: Date | null; emailVerifiedAt: Date | null } | null; failFirst?: boolean }) {
    let attempts = 0
    const created: { userId: string }[] = []
    const updates: unknown[] = []
    let linked: { userId: string; user: { deletedAt: Date | null; email: string } } | null = null
    const tx = {
      oAuthAccount: {
        create: async (args: { data: { userId: string } }) => {
          if (opts.failFirst && attempts++ === 0) throw duplicate()
          created.push(args.data)
          linked = { userId: args.data.userId, user: { deletedAt: null, email: opts.existing?.email ?? 'person@example.com' } }
        },
      },
      user: {
        create: async () => {
          throw new Error('a second user must not be created')
        },
        update: async (args: { data: unknown }) => void updates.push(args.data),
      },
    }
    const db = {
      ...tx,
      oAuthAccount: {
        ...tx.oAuthAccount,
        findUnique: async () => linked,
      },
      user: {
        ...tx.user,
        findUnique: async () => opts.existing ?? null,
      },
      $transaction: async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
    }
    const started: string[] = []
    const service = new OAuthService(
      db as never,
      { start: async (userId: string) => (started.push(userId), { userId }) } as never,
      { match: async () => undefined } as never,
      { publish: async () => undefined } as never,
      { googleSignInEnabled: async () => true } as never,
      { assertAllowed: async () => undefined, roleFor: async () => null } as never,
      { firebaseProjectId: 'proj', github: null, linkedin: null, oauthRedirectUris: [] } as never,
      { verify: async () => identity } as never,
    )
    return { service, created, updates, started }
  }

  it('links a provider-verified email onto the existing account and sets emailVerifiedAt', async () => {
    const { service, created, updates, started } = oauth({
      existing: { id: 'u', email: 'person@example.com', deletedAt: null, emailVerifiedAt: null },
    })
    await expect(service.signInWithGoogle('token', { client: 'web', userAgent: 'test' })).resolves.toMatchObject({ userId: 'u' })
    expect(created).toEqual([expect.objectContaining({ userId: 'u', provider: 'GOOGLE', providerSubject: 'gid' })])
    expect(updates).toEqual([{ emailVerifiedAt: expect.any(Date) }])
    expect(started).toEqual(['u'])
  })

  it('retries when the unique constraint loses a race, and still does not create a second user', async () => {
    const { service, created, started } = oauth({
      existing: { id: 'u', email: 'person@example.com', deletedAt: null, emailVerifiedAt: new Date() },
      failFirst: true,
    })
    await expect(service.signInWithGoogle('token', { client: 'web', userAgent: 'test' })).resolves.toMatchObject({ userId: 'u' })
    expect(created).toEqual([expect.objectContaining({ userId: 'u', provider: 'GOOGLE', providerSubject: 'gid' })])
    expect(started).toEqual(['u'])
  })
})

describe('setGlobalRole verification', () => {
  function admin() {
    const updates: Record<string, unknown>[] = []
    let user: { globalRole: string; verifiedAt: Date | null } = { globalRole: 'STUDENT', verifiedAt: null }
    const service = new AdminService(
      {
        user: {
          findFirst: async () => user,
          update: async (args: { data: { globalRole: string; verifiedAt?: Date } }) => {
            updates.push(args.data)
            user = { globalRole: args.data.globalRole, verifiedAt: args.data.verifiedAt ?? user.verifiedAt }
          },
        },
      } as never,
      { actor: async () => ({ globalRole: GlobalRole.PLATFORM_ADMIN }) } as never,
      { record: async () => undefined } as never,
      {} as never,
      { publish: async () => undefined } as never,
      {} as never,
    )
    return { service, updates, current: () => user }
  }

  it('changes the role only, and never sets verifiedAt', async () => {
    const { service, updates, current } = admin()
    await service.setGlobalRole('admin', 'user', GlobalRole.MANAGER)
    await service.setGlobalRole('admin', 'user', GlobalRole.PLATFORM_ADMIN)
    await service.setGlobalRole('admin', 'user', GlobalRole.TEACHER)
    expect(updates).toEqual([{ globalRole: 'MANAGER' }, { globalRole: 'PLATFORM_ADMIN' }, { globalRole: 'TEACHER' }])
    expect(current().verifiedAt).toBeNull()
  })
})

describe('reviewing your own verification request', () => {
  const request = {
    id: 'req',
    userId: 'admin',
    status: 'PENDING',
    method: 'DOCUMENTS',
    purpose: 'ACCOUNT',
    teacherId: null,
    collegeIdCard: false,
    documentIds: ['file'],
  }

  function verification(actor: { id: string; globalRole: string; institutionVerified: boolean }) {
    const described: string[][] = []
    const service = new VerificationService(
      {
        verificationRequest: { findUnique: async () => request },
        membership: { findMany: async () => [] },
        institutionalEmail: { findMany: async () => [] },
      } as never,
      { actor: async () => actor } as never,
      { record: async () => undefined } as never,
      {} as never,
      { integer: () => 30 } as never,
      {} as never,
      {} as never,
      { describe: async (ids: string[]) => (described.push(ids), ids.map((id) => ({ id }))), readUrl: async () => 'https://files.example/x' } as never,
      { publish: async () => undefined } as never,
    )
    return { service, described }
  }

  it('refuses the reviewer, including an unverified platform admin, and returns no documents', async () => {
    const { service, described } = verification({ id: 'admin', globalRole: 'PLATFORM_ADMIN', institutionVerified: false })
    const error = await rejection(() => service.review('admin', 'req', true))
    expect(error).toMatchObject({ code: ErrorCode.FORBIDDEN, message: 'You cannot review your own request.' })
    await expect(service.documentsFor('admin', request)).resolves.toEqual([])
    expect(described).toEqual([])
  })

  it('lets an unverified platform admin open someone else’s documents', async () => {
    const { service } = verification({ id: 'admin', globalRole: 'PLATFORM_ADMIN', institutionVerified: false })
    const other = { ...request, userId: 'student' }
    await expect(service.documentsFor('admin', other)).resolves.toEqual([{ id: 'file' }])
  })

  it('lets a verified teacher open documents addressed to them', async () => {
    const { service } = verification({ id: 'teacher', globalRole: 'TEACHER', institutionVerified: true })
    const other = { ...request, userId: 'student', teacherId: 'teacher' }
    await expect(service.documentsFor('teacher', other)).resolves.toEqual([{ id: 'file' }])
  })

  it('hides documents from an unverified teacher, a manager and a student', async () => {
    const hidden = { ...request, userId: 'student', teacherId: 'teacher' }
    const unverifiedTeacher = verification({ id: 'teacher', globalRole: 'TEACHER', institutionVerified: false })
    await expect(unverifiedTeacher.service.documentsFor('teacher', hidden)).resolves.toEqual([])
    const manager = verification({ id: 'manager', globalRole: 'MANAGER', institutionVerified: true })
    await expect(manager.service.documentsFor('manager', hidden)).resolves.toEqual([])
    const error = await rejection(() => manager.service.review('manager', 'req', true))
    expect(error).toMatchObject({ code: ErrorCode.FORBIDDEN })
    await expect(manager.service.collegeIdQueue('manager')).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN })
    await expect(manager.service.toReview('manager')).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN })
    const student = verification({ id: 'student', globalRole: 'STUDENT', institutionVerified: true })
    await expect(student.service.documentsFor('student', hidden)).resolves.toEqual([])
    await expect(student.service.documentUrl('student', 'req', 'file')).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN })
  })
})

describe('viewerNeedsVerification', () => {
  function users(row: { globalRole: string; verifiedAt: Date | null }) {
    return new UsersService(
      {
        user: {
          findFirst: async () => ({
            id: 'u',
            handle: 'ada',
            displayName: 'Ada',
            email: 'ada@example.com',
            emailVerifiedAt: new Date(),
            registrationCompletedAt: new Date(),
            verificationMethod: null,
            createdAt: new Date(),
            dateOfBirth: new Date('2000-01-01'),
            accountStatus: 'ACTIVE',
            deletionRequestedAt: null,
            analyticsOptOut: false,
            consents: [],
            ...row,
          }),
        },
      } as never,
      { statusOf: async () => ({ email: null, status: 'NONE', institution: null }) } as never,
      { consentAge: () => 18 } as never,
    )
  }

  it('is false for a platform admin with no verifiedAt, and true for everyone else until they are verified', async () => {
    expect((await users({ globalRole: 'PLATFORM_ADMIN', verifiedAt: null }).viewerProfile('u'))!.viewerNeedsVerification).toBe(false)
    expect((await users({ globalRole: 'TEACHER', verifiedAt: null }).viewerProfile('u'))!.viewerNeedsVerification).toBe(true)
    expect((await users({ globalRole: 'MANAGER', verifiedAt: null }).viewerProfile('u'))!.viewerNeedsVerification).toBe(true)
    expect((await users({ globalRole: 'STUDENT', verifiedAt: new Date() }).viewerProfile('u'))!.viewerNeedsVerification).toBe(false)
    expect((await users({ globalRole: 'STUDENT', verifiedAt: null }).publicProfile('u'))!.viewerNeedsVerification).toBeNull()
  })
})
