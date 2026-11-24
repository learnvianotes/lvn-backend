import { Inject, Injectable } from '@nestjs/common'
import { Action, can, VerificationMethod } from '@lvn/contracts/domain'
import { Errors } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { FILES, type Files } from '@lvn-backend/facades'
import { newId, Prisma, PrismaService } from '@lvn-backend/prisma-base'
import { RateLimiter } from '@lvn-backend/redis'
import { COLLEGE_ID_CARD_URL_SECONDS, COLLEGE_ID_OFF, COLLEGE_ID_UPLOADS_PER_DAY, checkedCollegeIdFile } from '../domain/college-id'
import { domainAndParents } from '../domain/email-domains'
import { STUDENT_ID_IMAGE_RETENTION_SETTING } from '../domain/setting-catalog'
import { AppSettingsService } from './app-settings.service'
import { AuditService } from './audit.service'
import { IdCardCheckService } from './id-card-check.service'
import { PlatformSettingsStore } from './platform-settings.store'
import { PolicyService } from './policy.service'

/** ADR-0019: at most three requests a week, 1–3 documents each, documents deleted 30 days after the decision. */
export const REQUESTS_PER_WEEK = 3
export const MAX_DOCUMENTS = 3
export const DOCUMENT_RETENTION_DAYS = 30
const DAY_MS = 24 * 3600 * 1000

type Method = typeof VerificationMethod.TEACHER | typeof VerificationMethod.DOCUMENTS

/**
 * Verification without an institutional email (ADR-0019): a verified teacher vouches, or reviewers look at proof of
 * enrolment. Platform admins see every request. Managers see student requests, documents included, and cannot decide
 * a teacher application. A verified teacher sees students who picked them and students of their institution, documents
 * included. Every view, approval, decline and role change is audited. Other proof is deleted 30 days after the
 * decision. A college ID image is deleted that many days after approval or rejection (the retention setting, default
 * 30) and at once when the student withdraws.
 */
@Injectable()
export class VerificationService {
  constructor(
    private readonly db: PrismaService,
    private readonly policy: PolicyService,
    private readonly audit: AuditService,
    private readonly settings: AppSettingsService,
    private readonly platformSettings: PlatformSettingsStore,
    private readonly idChecks: IdCardCheckService,
    private readonly limiter: RateLimiter,
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
    await this.idChecks.enqueue(request.id)
    return request
  }

  /**
   * An application for the TEACHER role (ADR-0073): where and what they teach, a message and 0–3 proof files. While it
   * waits, the account is a teacher applicant: it prepares classes but admits no one.
   */
  async applyToTeach(userId: string, input: { institution: string; subjects?: string | null; message?: string | null; fileIds?: string[] | null }) {
    const actor = await this.policy.actor(userId)
    if (!actor) throw Errors.unauthenticated()
    if (actor.globalRole !== 'STUDENT') throw Errors.conflict('Your account is already a teacher’s.')
    if (actor.restrictedMinor) throw Errors.forbidden('Teacher accounts are for adults.')
    if (actor.suspended) throw Errors.forbidden()
    const institution = input.institution.trim().slice(0, 200)
    if (institution.length < 2) throw Errors.validation('Say where you teach.', ['input', 'institution'])
    const unique = [...new Set(input.fileIds ?? [])]
    if (unique.length > MAX_DOCUMENTS) throw Errors.validation(`Attach at most ${MAX_DOCUMENTS} files.`, ['input', 'fileIds'])
    if (await this.db.verificationRequest.count({ where: { userId, purpose: 'TEACHER_ROLE', status: 'PENDING' } })) throw Errors.conflict('Your application is already waiting for review.')
    const lastWeek = await this.db.verificationRequest.count({ where: { userId, createdAt: { gte: new Date(Date.now() - 7 * DAY_MS) } } })
    if (lastWeek >= REQUESTS_PER_WEEK) throw Errors.rateLimited(24 * 3600, 'You can send three requests a week. Try again later.')
    let request
    try {
      request = await this.db.verificationRequest.create({
        data: {
          id: newId(),
          userId,
          purpose: 'TEACHER_ROLE',
          method: VerificationMethod.DOCUMENTS,
          institution,
          subjects: input.subjects?.trim().slice(0, 200) || null,
          message: input.message?.trim().slice(0, 500) || null,
          documentIds: unique,
        },
      })
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw Errors.conflict('Your application is already waiting for review.')
      throw e
    }
    if (unique.length) {
      try {
        await this.files.attach(unique, userId, 'VERIFICATION_DOCUMENT', { type: 'VERIFICATION_REQUEST', id: request.id })
      } catch (e) {
        await this.db.verificationRequest.delete({ where: { id: request.id } })
        throw e
      }
    }
    await this.events.publish('VerificationRequested', { requestId: request.id, userId, method: 'DOCUMENTS', purpose: 'TEACHER_ROLE' })
    return request
  }

  /** The person's latest application to teach, if any. */
  teacherApplication(userId: string) {
    return this.db.verificationRequest.findFirst({ where: { userId, purpose: 'TEACHER_ROLE' }, orderBy: { createdAt: 'desc' } })
  }

  /** NONE, PENDING, VERIFIED (the TEACHER role) or DECLINED (the latest application was). */
  async teacherStatus(userId: string): Promise<'NONE' | 'PENDING' | 'VERIFIED' | 'DECLINED'> {
    const u = await this.db.user.findUnique({ where: { id: userId }, select: { globalRole: true } })
    if (u?.globalRole === 'TEACHER') return 'VERIFIED'
    const latest = await this.teacherApplication(userId)
    return latest?.status === 'PENDING' ? 'PENDING' : latest?.status === 'REJECTED' ? 'DECLINED' : 'NONE'
  }

  async withdraw(userId: string, requestId: string): Promise<void> {
    const request = await this.db.verificationRequest.findUnique({ where: { id: requestId } })
    if (!request || request.userId !== userId) throw Errors.notFound('Request not found.')
    if (request.status !== 'PENDING') throw Errors.conflict('This request was already decided.')
    // A college ID card is deleted before the row forgets it, so a failed delete can be retried (ADR-0099).
    if (request.collegeIdCard) await this.removeCollegeIdCard(userId, requestId, request.documentIds)
    await this.db.verificationRequest.update({ where: { id: requestId }, data: { status: 'WITHDRAWN', documentIds: [] } })
    // Documents exist only for this decision (purpose limitation, §15.2): a withdrawn request keeps none.
    if (!request.collegeIdCard && request.documentIds.length) await this.files.delete(request.documentIds)
  }

  async review(reviewerId: string, requestId: string, approve: boolean, reason?: string | null) {
    const reviewer = await this.policy.actor(reviewerId)
    const request = await this.db.verificationRequest.findUnique({ where: { id: requestId } })
    if (!reviewer || !request) throw Errors.notFound('Request not found.')
    if (reviewerId === request.userId) throw Errors.forbidden('You cannot review your own request.')
    if (!(await this.mayReview(reviewerId, request))) throw Errors.forbidden()
    if (request.status !== 'PENDING') throw Errors.conflict('This request was already decided.')
    const trimmed = reason?.trim().slice(0, 500) || null
    const teacherRole = request.purpose === 'TEACHER_ROLE'
    // A college ID rejection may omit a reason (ADR-0099). Every other rejection still explains why.
    if (!approve && !trimmed && !request.collegeIdCard) throw Errors.validation(teacherRole ? 'Tell them why, so they can apply again.' : 'Tell the student why, so they can try again.', ['input', 'reason'])

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
        // ADR-0073: an approved application to teach grants the TEACHER role.
        if (teacherRole) await tx.user.update({ where: { id: request.userId }, data: { globalRole: 'TEACHER' } })
      }
      const action = teacherRole ? (approve ? 'teacher.approved' : 'teacher.rejected') : approve ? 'verification.approved' : 'verification.rejected'
      await this.audit.record({ actorId: reviewerId, action, targetType: 'VerificationRequest', targetId: requestId, metadata: { method: request.method, userId: request.userId, purpose: request.purpose, collegeIdCard: request.collegeIdCard } }, tx)
      return tx.verificationRequest.findUniqueOrThrow({ where: { id: requestId } })
    })

    const method = request.method as Method
    await this.events.publish('VerificationDecided', { requestId, userId: request.userId, method, decision: approve ? 'APPROVED' : 'REJECTED', reviewerId, purpose: request.purpose })
    if (newlyVerified) await this.events.publish('InstitutionVerified', { userId: request.userId, method })
    // The image stays until the retention window. Withdrawal still deletes a college ID at once.
    return decided
  }

  async mine(userId: string) {
    return this.db.verificationRequest.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 })
  }

  /** Platform admins: every pending request. Verified teachers: students who picked them, and students of their institution. */
  async toReview(reviewerId: string, first = 20, after?: string | null) {
    const where = await this.reviewQueueWhere(reviewerId, {})
    return this.db.verificationRequest.findMany({
      where: { ...where, ...(after ? { id: { gt: after } } : {}) },
      orderBy: { id: 'asc' },
      take: Math.min(Math.max(first, 1), 100),
    })
  }

  /** A reviewer who may see this request, one document at a time. Every view is written to the audit log (ADR-0019). */
  async documentUrl(reviewerId: string, requestId: string, fileId: string) {
    const request = await this.db.verificationRequest.findUnique({ where: { id: requestId } })
    if (!request) throw Errors.notFound('Request not found.')
    if (!(await this.mayReview(reviewerId, request))) throw Errors.forbidden()
    if (!request.documentIds.includes(fileId)) throw Errors.notFound('Document not found.')
    await this.audit.record({ actorId: reviewerId, action: 'verification.document.viewed', targetType: 'VerificationRequest', targetId: requestId, metadata: { fileId, collegeIdCard: request.collegeIdCard } })
    return this.files.readUrl(fileId)
  }

  /** Document metadata for a reviewer who may see this request; empty for everyone else, including the student. */
  async documentsFor(viewerId: string, request: { userId: string; method: string; purpose: string; teacherId: string | null; documentIds: string[] }) {
    if (!request.documentIds.length) return []
    if (!(await this.mayReview(viewerId, request))) return []
    return this.files.describe(request.documentIds)
  }

  /**
   * The stored check, for a reviewer (including the ID number) or the student (without the ID number).
   * Null until the check has run, and null for everyone else.
   */
  async aiCheckFor(viewerId: string, request: { userId: string; method: string; purpose: string; teacherId: string | null; aiVerdict: string | null; aiConfidence: number | null; aiReason: string | null; aiExtracted: unknown; aiCheckedAt: Date | null }) {
    if (!request.aiCheckedAt || !request.aiVerdict) return null
    const reviewer = await this.mayReview(viewerId, request)
    if (!reviewer && viewerId !== request.userId) return null
    const extracted = extractedFields(request.aiExtracted)
    return {
      verdict: request.aiVerdict,
      confidence: request.aiConfidence,
      reason: request.aiReason,
      checkedAt: request.aiCheckedAt,
      extracted: { ...extracted, idNumber: reviewer ? extracted.idNumber : null },
    }
  }

  /**
   * Deletes documents whose retention has ended. Other proof is kept 30 days after the decision (ADR-0019). A college
   * ID image is kept for the retention setting (default 30 days) after approval or rejection, and a withdrawn card
   * that is still stored is deleted on this run.
   */
  async purgeDecidedDocuments(now = new Date()): Promise<number> {
    const rows = await this.db.verificationRequest.findMany({
      where: { NOT: { documentIds: { isEmpty: true } } },
      select: { id: true, documentIds: true, collegeIdCard: true, decidedAt: true, status: true },
    })
    const due = rows.filter((r) => this.retentionDue(r, now))
    for (const r of due) {
      await this.files.delete(r.documentIds)
      await this.db.verificationRequest.update({ where: { id: r.id }, data: { documentIds: [] } })
      await this.audit.record({ actorId: null, action: 'verification.documents.deleted', targetType: 'VerificationRequest', targetId: r.id, metadata: { count: r.documentIds.length, collegeIdCard: r.collegeIdCard } })
    }
    return due.length
  }

  /**
   * A presigned upload for one college ID card (ADR-0099). Refused while the admin switch is off, and never stored
   * then. Independent of UPLOADS_ENABLED: general uploads can stay off.
   */
  async createCollegeIdUpload(userId: string, input: { fileName: string; mimeType: string; sizeBytes: number }, ip = '') {
    await this.assertCollegeIdOpen(userId)
    const file = checkedCollegeIdFile(input)
    const limit = await this.limiter.hit(`college-id-upload:${userId}`, { max: COLLEGE_ID_UPLOADS_PER_DAY, windowSeconds: 24 * 3600 })
    if (!limit.allowed) throw Errors.rateLimited(limit.retryAfter, 'Too many college ID uploads today. Try again tomorrow.')
    return this.files.createCollegeIdUpload(userId, file, ip)
  }

  /** Attaches one READY college ID card to a new account-verification request. Platform admins decide it. */
  async submitCollegeId(userId: string, fileId: string, message?: string | null) {
    await this.assertCollegeIdOpen(userId)
    await this.assertMayRequest(userId, VerificationMethod.DOCUMENTS, false)
    await this.files.finalizeCollegeIdUpload(userId, fileId)
    const request = await this.create(userId, VerificationMethod.DOCUMENTS, { documentIds: [fileId], message, collegeIdCard: true })
    try {
      await this.files.attach([fileId], userId, 'COLLEGE_ID', { type: 'VERIFICATION_REQUEST', id: request.id })
    } catch (e) {
      await this.db.verificationRequest.delete({ where: { id: request.id } })
      throw e
    }
    await this.announce(request)
    await this.idChecks.enqueue(request.id)
    return request
  }

  /** The person's latest college-ID request, if they have sent one. */
  myCollegeId(userId: string) {
    return this.db.verificationRequest.findFirst({ where: { userId, collegeIdCard: true }, orderBy: { createdAt: 'desc' } })
  }

  /**
   * Pending college-ID requests, oldest first. Platform admins see every one. A verified teacher sees students of
   * their institution, and is refused when they have none (a college ID is not addressed to a teacher).
   */
  async collegeIdQueue(reviewerId: string, first = 20, after?: string | null) {
    const reviewer = await this.policy.actor(reviewerId)
    if (!reviewer) throw Errors.unauthenticated()
    const base = { status: 'PENDING' as const, collegeIdCard: true, ...(after ? { id: { gt: after } } : {}) }
    let where: object
    if (reviewer.globalRole === 'PLATFORM_ADMIN') {
      if (!can(reviewer, Action.ACCOUNT_REVIEW_VERIFICATION, { kind: 'verification', method: VerificationMethod.DOCUMENTS, purpose: 'ACCOUNT' })) throw Errors.forbidden()
      where = base
    } else if (reviewer.globalRole === 'TEACHER') {
      const ids = await this.institutionStudentIds(reviewerId)
      if (!ids.length || !can(reviewer, Action.ACCOUNT_REVIEW_VERIFICATION, { kind: 'verification', method: VerificationMethod.DOCUMENTS, sameInstitution: true, purpose: 'ACCOUNT' })) throw Errors.forbidden()
      where = { ...base, userId: { in: ids } }
    } else throw Errors.forbidden()
    return this.db.verificationRequest.findMany({ where, orderBy: { id: 'asc' }, take: Math.min(Math.max(first, 1), 100) })
  }

  /**
   * A reviewer decides a college-ID request. Approval verifies the account (method DOCUMENTS). The card stays until
   * the retention window. A request that is not a college ID card is not found here.
   */
  async reviewCollegeId(reviewerId: string, requestId: string, approve: boolean, reason?: string | null) {
    const request = await this.db.verificationRequest.findUnique({ where: { id: requestId }, select: { collegeIdCard: true } })
    if (!request?.collegeIdCard) throw Errors.notFound('Request not found.')
    return this.review(reviewerId, requestId, approve, reason)
  }

  /** A 5-minute link for a reviewer who may see this card. Every view is audited. The owner cannot open it. */
  async collegeIdUrl(reviewerId: string, requestId: string) {
    const request = await this.db.verificationRequest.findUnique({ where: { id: requestId } })
    if (!request?.collegeIdCard) throw Errors.notFound('Request not found.')
    if (!(await this.mayReview(reviewerId, request))) throw Errors.forbidden()
    const fileId = request.documentIds[0]
    if (!fileId) throw Errors.notFound('The college ID card has been deleted.')
    await this.audit.record({ actorId: reviewerId, action: 'verification.document.viewed', targetType: 'VerificationRequest', targetId: requestId, metadata: { fileId, collegeIdCard: true } })
    return this.files.readUrl(fileId, { ttlSeconds: COLLEGE_ID_CARD_URL_SECONDS })
  }

  private async reviewQueueWhere(reviewerId: string, extra: Record<string, unknown>) {
    const reviewer = await this.policy.actor(reviewerId)
    if (!reviewer) throw Errors.unauthenticated()
    if (reviewer.globalRole === 'PLATFORM_ADMIN') return { status: 'PENDING' as const, ...extra }
    if (reviewer.globalRole !== 'TEACHER' || !can(reviewer, Action.ACCOUNT_REVIEW_VERIFICATION, { kind: 'verification', method: VerificationMethod.TEACHER, addressedToActor: true, purpose: 'ACCOUNT' })) throw Errors.forbidden()
    const ids = await this.institutionStudentIds(reviewerId)
    return {
      status: 'PENDING' as const,
      purpose: 'ACCOUNT' as const,
      OR: [{ teacherId: reviewerId }, ...(ids.length ? [{ userId: { in: ids } }] : [])],
      ...extra,
    }
  }

  /** True when this reviewer may decide the request or open its documents. */
  private async mayReview(reviewerId: string, request: { userId: string; method: string; purpose: string; teacherId: string | null }): Promise<boolean> {
    if (reviewerId === request.userId) return false
    const reviewer = await this.policy.actor(reviewerId)
    if (!reviewer) return false
    const sameInstitution = reviewer.globalRole === 'TEACHER' ? await this.sameInstitution(reviewerId, request.userId) : false
    return can(reviewer, Action.ACCOUNT_REVIEW_VERIFICATION, {
      kind: 'verification',
      method: request.method as Method,
      addressedToActor: request.teacherId === reviewerId,
      sameInstitution,
      purpose: request.purpose === 'TEACHER_ROLE' ? 'TEACHER_ROLE' : 'ACCOUNT',
    })
  }

  private retentionDue(row: { collegeIdCard: boolean; decidedAt: Date | null; status: string }, now: Date): boolean {
    if (row.collegeIdCard && row.status === 'WITHDRAWN') return true
    if (!row.decidedAt || (row.status !== 'APPROVED' && row.status !== 'REJECTED')) return false
    const configured = row.collegeIdCard ? (this.platformSettings.integer(STUDENT_ID_IMAGE_RETENTION_SETTING, DOCUMENT_RETENTION_DAYS) ?? DOCUMENT_RETENTION_DAYS) : DOCUMENT_RETENTION_DAYS
    const days = Math.min(Math.max(configured, 1), 3650)
    return row.decidedAt.getTime() <= now.getTime() - days * DAY_MS
  }

  private async sameInstitution(teacherId: string, studentId: string): Promise<boolean> {
    if (teacherId === studentId) return false
    const ids = await this.institutionStudentIds(teacherId)
    return ids.includes(studentId)
  }

  /** Students who share an organisation membership or a verified email domain with this teacher. At most 500. */
  private async institutionStudentIds(teacherId: string): Promise<string[]> {
    const [memberships, emails] = await Promise.all([
      this.db.membership.findMany({ where: { userId: teacherId }, select: { organizationId: true } }),
      this.db.institutionalEmail.findMany({ where: { userId: teacherId, verifiedAt: { not: null }, replacedAt: null }, select: { domain: true } }),
    ])
    const orgIds = memberships.map((m) => m.organizationId)
    const orgs = orgIds.length ? await this.db.organization.findMany({ where: { id: { in: orgIds } }, select: { emailDomains: true } }) : []
    const domains = new Set<string>()
    for (const email of emails) for (const domain of domainAndParents(email.domain)) domains.add(domain)
    for (const org of orgs) for (const domain of org.emailDomains) for (const parent of domainAndParents(domain.toLowerCase())) domains.add(parent)
    const domainList = [...domains]
    if (!orgIds.length && !domainList.length) return []
    const students = await this.db.user.findMany({
      where: {
        id: { not: teacherId },
        deletedAt: null,
        OR: [
          ...(orgIds.length ? [{ memberships: { some: { organizationId: { in: orgIds } } } }] : []),
          ...(domainList.length
            ? [{ institutionalEmails: { some: { verifiedAt: { not: null }, replacedAt: null, OR: domainList.flatMap((domain) => [{ domain }, { domain: { endsWith: `.${domain}` } }]) } } }]
            : []),
        ],
      },
      select: { id: true },
      take: 500,
    })
    return students.map((student) => student.id)
  }

  private async assertMayRequest(userId: string, method: Method, targetIsVerifiedTeacher: boolean): Promise<void> {
    const actor = await this.policy.actor(userId)
    if (!actor) throw Errors.unauthenticated()
    if (actor.institutionVerified) throw Errors.conflict('Your account is already verified.')
    const pendingRequest = (await this.db.verificationRequest.count({ where: { userId, status: 'PENDING', purpose: 'ACCOUNT' } })) > 0
    if (pendingRequest) throw Errors.conflict('You already have a request waiting. Withdraw it to send another.')
    if (method === VerificationMethod.TEACHER && !targetIsVerifiedTeacher) throw Errors.validation('Choose a verified teacher.', ['input', 'teacherId'])
    if (!can(actor, Action.ACCOUNT_REQUEST_VERIFICATION, { kind: 'verification', method, pendingRequest, targetIsVerifiedTeacher })) {
      throw Errors.forbidden(method === VerificationMethod.DOCUMENTS && actor.restrictedMinor ? 'Ask a teacher to verify your account instead.' : undefined)
    }
    const lastWeek = await this.db.verificationRequest.count({ where: { userId, createdAt: { gte: new Date(Date.now() - 7 * DAY_MS) } } })
    if (lastWeek >= REQUESTS_PER_WEEK) throw Errors.rateLimited(24 * 3600, 'You can send three requests a week. Try again later.')
  }

  private async assertCollegeIdOpen(userId: string): Promise<void> {
    if (!(await this.settings.studentIdVerificationEnabled())) throw Errors.unavailable(COLLEGE_ID_OFF)
    const actor = await this.policy.actor(userId)
    if (!actor) throw Errors.unauthenticated()
    if (actor.institutionVerified) throw Errors.conflict('Your account is already verified.')
    if (actor.restrictedMinor) throw Errors.forbidden('Ask a teacher to verify your account instead.')
    if (await this.db.verificationRequest.count({ where: { userId, status: 'PENDING', purpose: 'ACCOUNT' } })) throw Errors.conflict('You already have a request waiting. Withdraw it to send another.')
  }

  /** Deletes the stored card and records who did it. The request row is updated by the caller when the decision lands. */
  private async removeCollegeIdCard(actorId: string | null, requestId: string, documentIds: string[]): Promise<void> {
    if (!documentIds.length) return
    await this.files.delete(documentIds)
    await this.db.verificationRequest.update({ where: { id: requestId }, data: { documentIds: [] } })
    await this.audit.record({ actorId, action: 'verification.documents.deleted', targetType: 'VerificationRequest', targetId: requestId, metadata: { count: documentIds.length, collegeIdCard: true } })
  }

  private async create(userId: string, method: Method, data: { teacherId?: string; documentIds?: string[]; message?: string | null; collegeIdCard?: boolean }) {
    const message = data.message?.trim().slice(0, 500) || null
    try {
      return await this.db.verificationRequest.create({
        data: { id: newId(), userId, method, teacherId: data.teacherId ?? null, documentIds: data.documentIds ?? [], message, collegeIdCard: data.collegeIdCard ?? false },
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

function extractedFields(value: unknown): { name: string | null; institution: string | null; idNumber: string | null; validUntil: string | null } {
  const empty = { name: null, institution: null, idNumber: null, validUntil: null }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return empty
  const row = value as Record<string, unknown>
  const text = (key: string) => (typeof row[key] === 'string' ? row[key] : null)
  return { name: text('name'), institution: text('institution'), idNumber: text('idNumber'), validUntil: text('validUntil') }
}
