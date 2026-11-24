import { UseGuards } from '@nestjs/common'
import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql'
import { CurrentViewer, RequireMfa, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { Errors, withUserErrors } from '@lvn-backend/errors'
import { PrismaService } from '@lvn-backend/prisma-base'
import { AdminService } from '../application/admin.service'
import { UsersService } from '../application/users.service'
import { VerificationService } from '../application/verification.service'
import type {
  DomainReview,
  MutationDecideDomainReviewArgs,
  MutationRequestDocumentVerificationArgs,
  MutationRequestTeacherVerificationArgs,
  MutationReviewVerificationRequestArgs,
  MutationSetGlobalRoleArgs,
  MutationWithdrawVerificationRequestArgs,
  OkPayload,
  QueryDomainReviewsArgs,
  QueryTeachersArgs,
  QueryVerificationDocumentUrlArgs,
  QueryVerificationRequestsToReviewArgs,
  SignedUrl,
  User,
  VerificationDocument,
  VerificationRequestPayload,
} from './schema.types'

/** A request row as resolvers pass it around; requester, teacher and documents resolve on demand. */
interface RequestRow {
  id: string
  userId: string
  teacherId: string | null
  purpose: string
  institution: string | null
  subjects: string | null
  method: string
  status: string
  message: string | null
  createdAt: Date
  decidedAt: Date | null
  reason: string | null
  documentIds: string[]
  aiVerdict: string | null
  aiConfidence: number | null
  aiReason: string | null
  aiExtracted: unknown
  aiCheckedAt: Date | null
}

@Resolver('VerificationRequest')
@UseGuards(SignedInGuard)
export class VerificationResolver {
  constructor(
    private readonly verification: VerificationService,
    private readonly admin: AdminService,
    private readonly users: UsersService,
    private readonly db: PrismaService,
  ) {}

  @Query('myVerificationRequests')
  myVerificationRequests(@CurrentViewer() viewer: Viewer): Promise<RequestRow[]> {
    return this.verification.mine(viewer.userId)
  }

  @Query('myTeacherApplication')
  myTeacherApplication(@CurrentViewer() viewer: Viewer): Promise<RequestRow | null> {
    return this.verification.teacherApplication(viewer.userId)
  }

  @Mutation('applyToTeach')
  applyToTeach(@Args('input') input: { institution: string; subjects?: string | null; message?: string | null; fileIds?: string[] | null }, @CurrentViewer() viewer: Viewer): Promise<VerificationRequestPayload> {
    return withUserErrors<VerificationRequestPayload>(async () => ({ request: (await this.verification.applyToTeach(viewer.userId, input)) as never }), { request: null })
  }

  @Query('verificationRequestsToReview')
  @RequireMfa()
  verificationRequestsToReview(@Args() { first, after }: QueryVerificationRequestsToReviewArgs, @CurrentViewer() viewer: Viewer): Promise<RequestRow[]> {
    return this.verification.toReview(viewer.userId, first ?? 20, after)
  }

  @Query('verificationDocumentUrl')
  @RequireMfa()
  verificationDocumentUrl(@Args() { requestId, fileId }: QueryVerificationDocumentUrlArgs, @CurrentViewer() viewer: Viewer): Promise<SignedUrl> {
    return this.verification.documentUrl(viewer.userId, requestId, fileId)
  }

  @Query('teachers')
  async teachers(@Args() { search }: QueryTeachersArgs): Promise<User[]> {
    const q = search.trim()
    if (q.length < 2) return []
    const found = await this.db.user.findMany({
      where: {
        globalRole: 'TEACHER',
        verifiedAt: { not: null },
        deletedAt: null,
        OR: [{ displayName: { contains: q, mode: 'insensitive' } }, { handle: { startsWith: q.toLowerCase() } }],
      },
      take: 20,
      orderBy: { displayName: 'asc' },
      select: { id: true },
    })
    return (await Promise.all(found.map((u) => this.users.publicProfile(u.id)))).filter((u): u is User => u !== null)
  }

  @Query('domainReviews')
  @RequireMfa()
  domainReviews(@Args() { status }: QueryDomainReviewsArgs, @CurrentViewer() viewer: Viewer): Promise<DomainReview[]> {
    return this.admin.domainReviews(viewer.userId, status)
  }

  @Mutation('requestTeacherVerification')
  requestTeacherVerification(@Args() { input }: MutationRequestTeacherVerificationArgs, @CurrentViewer() viewer: Viewer): Promise<VerificationRequestPayload> {
    return withUserErrors<VerificationRequestPayload>(
      async () => ({ request: (await this.verification.requestTeacher(viewer.userId, input.teacherId, input.message)) as never }),
      { request: null },
    )
  }

  @Mutation('requestDocumentVerification')
  requestDocumentVerification(@Args() { input }: MutationRequestDocumentVerificationArgs, @CurrentViewer() viewer: Viewer): Promise<VerificationRequestPayload> {
    return withUserErrors<VerificationRequestPayload>(
      async () => ({ request: (await this.verification.requestDocuments(viewer.userId, input.fileIds, input.message)) as never }),
      { request: null },
    )
  }

  @Mutation('withdrawVerificationRequest')
  withdrawVerificationRequest(@Args() { requestId }: MutationWithdrawVerificationRequestArgs, @CurrentViewer() viewer: Viewer): Promise<OkPayload> {
    return withUserErrors<OkPayload>(async () => {
      await this.verification.withdraw(viewer.userId, requestId)
      return { ok: true }
    }, { ok: false })
  }

  @Mutation('reviewVerificationRequest')
  @RequireMfa()
  reviewVerificationRequest(@Args() { input }: MutationReviewVerificationRequestArgs, @CurrentViewer() viewer: Viewer): Promise<VerificationRequestPayload> {
    return withUserErrors<VerificationRequestPayload>(
      async () => ({ request: (await this.verification.review(viewer.userId, input.requestId, input.approve, input.reason)) as never }),
      { request: null },
    )
  }

  @Mutation('decideDomainReview')
  @RequireMfa()
  decideDomainReview(@Args() { input }: MutationDecideDomainReviewArgs, @CurrentViewer() viewer: Viewer): Promise<OkPayload> {
    return withUserErrors<OkPayload>(async () => {
      await this.admin.decideDomain(viewer.userId, input.domain, input.approve)
      return { ok: true }
    }, { ok: false })
  }

  @Mutation('setGlobalRole')
  @RequireMfa()
  setGlobalRole(@Args() { input }: MutationSetGlobalRoleArgs, @CurrentViewer() viewer: Viewer): Promise<OkPayload> {
    return withUserErrors<OkPayload>(async () => {
      await this.admin.setGlobalRole(viewer.userId, input.userId, input.role)
      return { ok: true }
    }, { ok: false })
  }

  @Query('institutionDomains')
  @RequireMfa()
  institutionDomains(@Args('status') status: DomainReview['status'] | null, @Args('first') first: number | null, @CurrentViewer() viewer: Viewer): Promise<DomainReview[]> {
    return this.admin.institutionDomains(viewer.userId, status, first ?? 50)
  }

  @Mutation('reviewInstitutionDomain')
  @RequireMfa()
  reviewInstitutionDomain(@Args('input') input: { domain: string; approve: boolean }, @CurrentViewer() viewer: Viewer): Promise<OkPayload> {
    return withUserErrors<OkPayload>(async () => {
      await this.admin.reviewInstitutionDomain(viewer.userId, input.domain, input.approve)
      return { ok: true }
    }, { ok: false })
  }

  // ── VerificationRequest fields ───────────────────────────────────────────────────────────────────────────

  @ResolveField('requester')
  async requester(@Parent() r: RequestRow, @CurrentViewer() viewer: Viewer): Promise<User> {
    const user = r.userId === viewer.userId ? await this.users.viewerProfile(r.userId) : await this.users.publicProfile(r.userId)
    if (!user) throw Errors.notFound()
    return user
  }

  @ResolveField('teacher')
  teacher(@Parent() r: RequestRow): Promise<User | null> {
    return r.teacherId ? this.users.publicProfile(r.teacherId) : Promise.resolve(null)
  }

  @ResolveField('documents')
  async documents(@Parent() r: RequestRow, @CurrentViewer() viewer: Viewer): Promise<VerificationDocument[]> {
    const files = await this.verification.documentsFor(viewer.userId, r)
    return files.map((f) => ({ fileId: f.id, fileName: f.originalFileName, mimeType: f.mimeType, sizeBytes: f.sizeBytes }))
  }

  @ResolveField('aiCheck')
  aiCheck(@Parent() r: RequestRow, @CurrentViewer() viewer: Viewer) {
    return this.verification.aiCheckFor(viewer.userId, r)
  }
}

/** `User.teacherStatus`, for the viewer only (ADR-0073). */
@Resolver('User')
export class TeacherStatusResolver {
  constructor(private readonly verification: VerificationService) {}

  @ResolveField('teacherStatus')
  teacherStatus(@Parent() user: { id: string }, @CurrentViewer() viewer: Viewer | null) {
    return viewer?.userId === user.id ? this.verification.teacherStatus(user.id) : null
  }
}
