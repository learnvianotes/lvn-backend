import { Inject, Injectable } from '@nestjs/common'
import { Action, can, VerificationMethod } from '@lvn/contracts/domain'
import { Errors } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { FILES, type Files } from '@lvn-backend/facades'
import { newId, Prisma, PrismaService } from '@lvn-backend/prisma-base'
import { AuditService } from './audit.service'
import { PolicyService } from './policy.service'

/** ADR-0019: at most three requests a week, 1–3 documents each, documents deleted 30 days after the decision. */
export const REQUESTS_PER_WEEK = 3
export const MAX_DOCUMENTS = 3
export const DOCUMENT_RETENTION_DAYS = 30
const DAY_MS = 24 * 3600 * 1000

type Method = typeof VerificationMethod.TEACHER | typeof VerificationMethod.DOCUMENTS

/**
 * Verification without an institutional email (ADR-0019): a verified teacher vouches, or platform admins review
 * proof of enrolment. Identity documents are the most sensitive data LVN holds: only platform admins see them, every
 * view is audited, and they are deleted 30 days after the decision. Decisions and teacher vouches are audited too.
 */
@Injectable()
export class VerificationService {
  constructor(
    private readonly db: PrismaService,
    private readonly policy: PolicyService,
    private readonly audit: AuditService,
    @Inject(FILES) private readonly files: Files,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  async requestTeacher(userId: string, teacherId: string, message?: string | null) {
    const teacher = await this.db.user.findFirst({ where: { id: teacherId, deletedAt: null }, select: { globalRole: true, verifiedAt: true } })
    await this.assertMayRequest(userId, VerificationMethod.TEACHER, teacher?.globalRole === 'TEACHER' && teacher.verifiedAt !== null && teacherId !== userId)
    const request = await this.create(userId, VerificationMethod.TEACHER, { teacherId, message })
    await this.announce(request)
    return request
  }

  async requestDocuments(userId: string, fileIds: string[], message?: string | null) {
    const unique = [...new Set(fileIds)]
    if (unique.length < 1 || unique.length > MAX_DOCUMENTS) throw Errors.validation(`Attach 1 to ${MAX_DOCUMENTS} documents.`, ['input', 'fileIds'])
    await this.assertMayRequest(userId, VerificationMethod.DOCUMENTS, false)
    const request = await this.create(userId, VerificationMethod.DOCUMENTS, { documentIds: unique, message })
    try {
      await this.files.attach(unique, userId, 'VERIFICATION_DOCUMENT', { type: 'VERIFICATION_REQUEST', id: request.id })
    } catch (e) {
      await this.db.verificationRequest.delete({ where: { id: request.id } })
      throw e
    }
    await this.announce(request)
    return request
  }

  async withdraw(userId: string, requestId: string): Promise<void> {
    const request = await this.db.verificationRequest.findUnique({ where: { id: requestId } })
    if (!request || request.userId !== userId) throw Errors.notFound('Request not found.')
    if (request.status !== 'PENDING') throw Errors.conflict('This request was already decided.')
    await this.db.verificationRequest.update({ where: { id: requestId }, data: { status: 'WITHDRAWN', documentIds: [] } })
    // Documents exist only for this decision (purpose limitation, §15.2): a withdrawn request keeps none.
    if (request.documentIds.length) await this.files.delete(request.documentIds)
  }

  async review(reviewerId: string, requestId: string, approve: boolean, reason?: string | null) {
    const reviewer = await this.policy.actor(reviewerId)
    const request = await this.db.verificationRequest.findUnique({ where: { id: requestId } })
    if (!reviewer || !request) throw Errors.notFound('Request not found.')
    const resource = { kind: 'verification' as const, method: request.method as Method, addressedToActor: request.teacherId === reviewerId }
    if (!can(reviewer, Action.ACCOUNT_REVIEW_VERIFICATION, resource)) throw Errors.forbidden()
    if (request.status !== 'PENDING') throw Errors.conflict('This request was already decided.')
    const trimmed = reason?.trim().slice(0, 500) || null
    if (!approve && !trimmed) throw Errors.validation('Tell the student why, so they can try again.', ['input', 'reason'])

    const now = new Date()
    let newlyVerified = false
    const decided = await this.db.$transaction(async (tx) => {
      const { count } = await tx.verificationRequest.updateMany({
        where: { id: requestId, status: 'PENDING' },
        data: { status: approve ? 'APPROVED' : 'REJECTED', decidedBy: reviewerId, decidedAt: now, reason: trimmed },
      })
      if (count !== 1) throw Errors.conflict('This request was already decided.')
      if (approve) {
        const user = await tx.user.findUniqueOrThrow({ where: { id: request.userId }, select: { verifiedAt: true } })
        if (!user.verifiedAt) {
          await tx.user.update({ where: { id: request.userId }, data: { verifiedAt: now, verificationMethod: request.method } })
          newlyVerified = true
        }
      }
      await this.audit.record(
        { actorId: reviewerId, action: approve ? 'verification.approved' : 'verification.rejected', targetType: 'VerificationRequest', targetId: requestId, metadata: { method: request.method, userId: request.userId } },
        tx,
      )
      return tx.verificationRequest.findUniqueOrThrow({ where: { id: requestId } })
    })

    const method = request.method as Method
    await this.events.publish('VerificationDecided', { requestId, userId: request.userId, method, decision: approve ? 'APPROVED' : 'REJECTED', reviewerId })
    if (newlyVerified) await this.events.publish('InstitutionVerified', { userId: request.userId, method })
    return decided
  }

  async mine(userId: string) {
    return this.db.verificationRequest.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 })
  }

  /** Teachers: pending requests addressed to them. Platform admins: every pending request. Oldest first. */
  async toReview(reviewerId: string, first = 20, after?: string | null) {
    const reviewer = await this.policy.actor(reviewerId)
    if (!reviewer) throw Errors.unauthenticated()
    const admin = reviewer.globalRole === 'PLATFORM_ADMIN'
    if (!admin && !can(reviewer, Action.ACCOUNT_REVIEW_VERIFICATION, { kind: 'verification', method: VerificationMethod.TEACHER, addressedToActor: true })) throw Errors.forbidden()
    return this.db.verificationRequest.findMany({
      where: { status: 'PENDING', ...(admin ? {} : { teacherId: reviewerId, method: 'TEACHER' }), ...(after ? { id: { gt: after } } : {}) },
      orderBy: { id: 'asc' },
      take: Math.min(Math.max(first, 1), 100),
    })
  }

  /** Platform admins only, one document at a time; every view is written to the audit log (ADR-0019). */
  async documentUrl(adminId: string, requestId: string, fileId: string) {
    const admin = await this.policy.actor(adminId)
    const request = await this.db.verificationRequest.findUnique({ where: { id: requestId } })
    if (!admin || !request) throw Errors.notFound('Request not found.')
    if (!can(admin, Action.ACCOUNT_REVIEW_VERIFICATION, { kind: 'verification', method: VerificationMethod.DOCUMENTS })) throw Errors.forbidden()
    if (!request.documentIds.includes(fileId)) throw Errors.notFound('Document not found.')
    await this.audit.record({ actorId: adminId, action: 'verification.document.viewed', targetType: 'VerificationRequest', targetId: requestId, metadata: { fileId } })
    return this.files.readUrl(fileId)
  }

  /** Document metadata for reviewers who may see documents (platform admins); empty for everyone else. */
  async documentsFor(viewerId: string, documentIds: string[]) {
    if (!documentIds.length) return []
    const viewer = await this.policy.actor(viewerId)
    if (!viewer || !can(viewer, Action.ACCOUNT_REVIEW_VERIFICATION, { kind: 'verification', method: VerificationMethod.DOCUMENTS })) return []
    return this.files.describe(documentIds)
  }

  /** Deletes documents of requests decided 30 days ago or more; keeps the outcome (job, daily). */
  async purgeDecidedDocuments(now = new Date()): Promise<number> {
    const due = await this.db.verificationRequest.findMany({
      where: { decidedAt: { lte: new Date(now.getTime() - DOCUMENT_RETENTION_DAYS * DAY_MS) }, NOT: { documentIds: { isEmpty: true } } },
      select: { id: true, documentIds: true },
    })
    for (const r of due) {
      await this.files.delete(r.documentIds)
      await this.db.verificationRequest.update({ where: { id: r.id }, data: { documentIds: [] } })
      await this.audit.record({ actorId: null, action: 'verification.documents.deleted', targetType: 'VerificationRequest', targetId: r.id, metadata: { count: r.documentIds.length } })
    }
    return due.length
  }

  private async assertMayRequest(userId: string, method: Method, targetIsVerifiedTeacher: boolean): Promise<void> {
    const actor = await this.policy.actor(userId)
    if (!actor) throw Errors.unauthenticated()
    if (actor.institutionVerified) throw Errors.conflict('Your account is already verified.')
    const pendingRequest = (await this.db.verificationRequest.count({ where: { userId, status: 'PENDING' } })) > 0
    if (pendingRequest) throw Errors.conflict('You already have a request waiting. Withdraw it to send another.')
    if (method === VerificationMethod.TEACHER && !targetIsVerifiedTeacher) throw Errors.validation('Choose a verified teacher.', ['input', 'teacherId'])
    if (!can(actor, Action.ACCOUNT_REQUEST_VERIFICATION, { kind: 'verification', method, pendingRequest, targetIsVerifiedTeacher })) {
      throw Errors.forbidden(method === VerificationMethod.DOCUMENTS && actor.restrictedMinor ? 'Ask a teacher to verify your account instead.' : undefined)
    }
    const lastWeek = await this.db.verificationRequest.count({ where: { userId, createdAt: { gte: new Date(Date.now() - 7 * DAY_MS) } } })
    if (lastWeek >= REQUESTS_PER_WEEK) throw Errors.rateLimited(24 * 3600, 'You can send three requests a week. Try again later.')
  }

  private async create(userId: string, method: Method, data: { teacherId?: string; documentIds?: string[]; message?: string | null }) {
    const message = data.message?.trim().slice(0, 500) || null
    try {
      return await this.db.verificationRequest.create({
        data: { id: newId(), userId, method, teacherId: data.teacherId ?? null, documentIds: data.documentIds ?? [], message },
      })
    } catch (e) {
      // The partial unique index allows one pending request per user, even under concurrent requests.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw Errors.conflict('You already have a request waiting. Withdraw it to send another.')
      throw e
    }
  }

  private async announce(request: { id: string; userId: string; method: string; teacherId: string | null }): Promise<void> {
    await this.events.publish('VerificationRequested', {
      requestId: request.id,
      userId: request.userId,
      method: request.method as Method,
      ...(request.teacherId ? { teacherId: request.teacherId } : {}),
    })
  }
}
