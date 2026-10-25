import { UseGuards } from '@nestjs/common'
import { Args, Context, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type RequestContext, type Viewer } from '@lvn-backend/auth-guard'
import { Errors, withUserErrors } from '@lvn-backend/errors'
import { AppSettingsService } from '../application/app-settings.service'
import { UsersService } from '../application/users.service'
import { VerificationService } from '../application/verification.service'
import type {
  MutationCreateStudentIdUploadIntentArgs,
  MutationReviewStudentIdVerificationArgs,
  MutationSetStudentIdVerificationEnabledArgs,
  MutationSubmitStudentIdVerificationArgs,
  MutationWithdrawStudentIdVerificationArgs,
  OkPayload,
  QueryStudentIdCardUrlArgs,
  QueryStudentIdVerificationQueueArgs,
  SignedUrl,
  StudentIdUploadPayload,
  StudentIdVerificationPayload,
  StudentIdVerificationSettings,
  User,
  VerificationDocument,
} from './schema.types'

interface CollegeIdRow {
  id: string
  userId: string
  method: string
  purpose: string
  teacherId: string | null
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

/** Anyone may ask whether the control should be shown (ADR-0099). */
@Resolver()
export class StudentIdVerificationPublicResolver {
  constructor(private readonly settings: AppSettingsService) {}

  @Query('studentIdVerificationEnabled')
  studentIdVerificationEnabled(): Promise<boolean> {
    return this.settings.studentIdVerificationEnabled()
  }
}

@Resolver('StudentIdVerificationRequest')
@UseGuards(SignedInGuard)
export class StudentIdVerificationResolver {
  constructor(
    private readonly verification: VerificationService,
    private readonly settings: AppSettingsService,
    private readonly users: UsersService,
  ) {}

  @Query('myStudentIdVerification')
  myStudentIdVerification(@CurrentViewer() viewer: Viewer): Promise<CollegeIdRow | null> {
    return this.verification.myCollegeId(viewer.userId)
  }

  @Query('studentIdVerificationQueue')
  studentIdVerificationQueue(@Args() { first, after }: QueryStudentIdVerificationQueueArgs, @CurrentViewer() viewer: Viewer): Promise<CollegeIdRow[]> {
    return this.verification.collegeIdQueue(viewer.userId, first ?? 20, after)
  }

  @Query('studentIdCardUrl')
  studentIdCardUrl(@Args() { requestId }: QueryStudentIdCardUrlArgs, @CurrentViewer() viewer: Viewer): Promise<SignedUrl> {
    return this.verification.collegeIdUrl(viewer.userId, requestId)
  }

  @Query('studentIdVerificationSettings')
  studentIdVerificationSettings(@CurrentViewer() viewer: Viewer): Promise<StudentIdVerificationSettings> {
    return this.settings.studentIdVerificationSettings(viewer.userId)
  }

  @Mutation('createStudentIdUploadIntent')
  createStudentIdUploadIntent(@Args() { input }: MutationCreateStudentIdUploadIntentArgs, @CurrentViewer() viewer: Viewer, @Context() ctx: RequestContext): Promise<StudentIdUploadPayload> {
    const raw = (ctx.req as { ip?: string }).ip ?? ''
    const ip = raw.startsWith('::ffff:') ? raw.slice('::ffff:'.length) : raw
    return withUserErrors<StudentIdUploadPayload>(async () => ({ upload: await this.verification.createCollegeIdUpload(viewer.userId, input, ip) }), { upload: null })
  }

  @Mutation('submitStudentIdVerification')
  submitStudentIdVerification(@Args() { input }: MutationSubmitStudentIdVerificationArgs, @CurrentViewer() viewer: Viewer): Promise<StudentIdVerificationPayload> {
    return withUserErrors<StudentIdVerificationPayload>(
      async () => ({ request: (await this.verification.submitCollegeId(viewer.userId, input.fileId, input.message)) as never }),
      { request: null },
    )
  }

  @Mutation('withdrawStudentIdVerification')
  withdrawStudentIdVerification(@Args() { requestId }: MutationWithdrawStudentIdVerificationArgs, @CurrentViewer() viewer: Viewer): Promise<OkPayload> {
    return withUserErrors<OkPayload>(async () => {
      const mine = await this.verification.myCollegeId(viewer.userId)
      if (!mine || mine.id !== requestId) throw Errors.notFound('Request not found.')
      await this.verification.withdraw(viewer.userId, requestId)
      return { ok: true }
    }, { ok: false })
  }

  @Mutation('reviewStudentIdVerification')
  reviewStudentIdVerification(@Args() { input }: MutationReviewStudentIdVerificationArgs, @CurrentViewer() viewer: Viewer): Promise<StudentIdVerificationPayload> {
    return withUserErrors<StudentIdVerificationPayload>(
      async () => ({ request: (await this.verification.reviewCollegeId(viewer.userId, input.requestId, input.approve, input.reason)) as never }),
      { request: null },
    )
  }

  @Mutation('setStudentIdVerificationEnabled')
  setStudentIdVerificationEnabled(@Args() { enabled }: MutationSetStudentIdVerificationEnabledArgs, @CurrentViewer() viewer: Viewer): Promise<OkPayload> {
    return withUserErrors<OkPayload>(async () => {
      await this.settings.setStudentIdVerificationEnabled(viewer.userId, enabled)
      return { ok: true }
    }, { ok: false })
  }

  @ResolveField('requester')
  async requester(@Parent() row: CollegeIdRow, @CurrentViewer() viewer: Viewer): Promise<User> {
    const user = row.userId === viewer.userId ? await this.users.viewerProfile(row.userId) : await this.users.publicProfile(row.userId)
    if (!user) throw Errors.notFound()
    return user
  }

  @ResolveField('card')
  async card(@Parent() row: CollegeIdRow, @CurrentViewer() viewer: Viewer): Promise<VerificationDocument | null> {
    const files = await this.verification.documentsFor(viewer.userId, row)
    const file = files[0]
    return file ? { fileId: file.id, fileName: file.originalFileName, mimeType: file.mimeType, sizeBytes: file.sizeBytes } : null
  }

  @ResolveField('aiCheck')
  aiCheck(@Parent() row: CollegeIdRow, @CurrentViewer() viewer: Viewer) {
    return this.verification.aiCheckFor(viewer.userId, row)
  }
}
