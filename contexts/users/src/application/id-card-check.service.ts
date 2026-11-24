import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { FILES, type Files } from '@lvn-backend/facades'
import { PrismaService } from '@lvn-backend/prisma-base'
import { Queues } from '@lvn-backend/queue'
import { domainAndParents } from '../domain/email-domains'
import {
  combineJudgements,
  shouldAutoApprove,
  judgeIdCard,
  type IdCardExtraction,
  type IdCardJudgement,
  type IdCardProfile,
} from '../domain/id-card-match'
import { STUDENT_ID_AI_AUTO_APPROVE_SETTING, STUDENT_ID_AI_CHECK_SETTING, STUDENT_ID_AI_THRESHOLD_SETTING } from '../domain/setting-catalog'
import { AuditService } from './audit.service'
import { PlatformSettingsStore } from './platform-settings.store'

/** Background ID-card check. The API enqueues; apps/worker runs it. */
export const USERS_ID_CHECK_QUEUE = 'users.id-check'
/**
 * reviewerId on VerificationDecided has to be a UUID. This is not an account.
 * Document reviews are not named in the notification; the audit row says actor "system:ai".
 */
export const AI_REVIEWER_ID = '00000000-0000-4000-8000-0000000000a1'

export interface IdCardExtractor {
  /**
   * Reads one image or PDF. The implementation must send the bytes and nothing about the account.
   * Throws when the provider cannot answer; the check then stores `unreadable`.
   */
  extract(bytes: Buffer, mimeType: string, subjectId?: string | null): Promise<IdCardExtraction>
}

const IMAGE_OR_PDF = new Set(['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])

/**
 * Reads a college ID or proof document and stores a verdict on the request (B5).
 * Only the file bytes go to the extractor. The profile comparison happens after the answer comes back.
 * A mismatch or a low score stays pending for a person. Auto-approve is a separate switch and defaults off.
 */
@Injectable()
export class IdCardCheckService {
  private readonly log = new Logger('IdCardCheck')

  constructor(
    private readonly db: PrismaService,
    private readonly settings: PlatformSettingsStore,
    private readonly audit: AuditService,
    private readonly queues: Queues,
    @Inject(FILES) private readonly files: Files,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  /** Best-effort. A failed enqueue leaves the request for manual review. */
  async enqueue(requestId: string): Promise<void> {
    if (!this.settings.boolean(STUDENT_ID_AI_CHECK_SETTING, false)) return
    try {
      await this.queues.queue(USERS_ID_CHECK_QUEUE).add('check', { requestId }, { jobId: requestId })
    } catch (e) {
      this.log.warn(`id-card check was not queued for ${requestId}: ${(e as Error).name}`)
    }
  }

  /**
   * Runs the check. `extractor` is the AI provider in the worker and a fake in tests.
   * Nothing about the image is logged.
   */
  async run(requestId: string, extractor: IdCardExtractor): Promise<IdCardJudgement | null> {
    if (!this.settings.boolean(STUDENT_ID_AI_CHECK_SETTING, false)) return null
    const request = await this.db.verificationRequest.findUnique({ where: { id: requestId } })
    if (!request || request.status !== 'PENDING' || request.purpose !== 'ACCOUNT' || !request.documentIds.length) return null
    const profile = await this.profileFor(request.userId)
    const judgements: IdCardJudgement[] = []
    for (const fileId of request.documentIds) {
      const file = await this.readFile(fileId)
      if (!file || !IMAGE_OR_PDF.has(file.mimeType)) {
        judgements.push(judgeIdCard(null, profile))
        continue
      }
      try {
        judgements.push(judgeIdCard(await extractor.extract(file.bytes, file.mimeType, request.userId), profile))
      } catch (e) {
        this.log.warn(`id-card check could not read a document on ${requestId}: ${(e as Error).name}`)
        judgements.push(judgeIdCard(null, profile))
      }
    }
    const judgement = combineJudgements(judgements)
    await this.store(requestId, judgement)
    if (await this.maybeAutoApprove(request, judgement)) return judgement
    return judgement
  }

  private async store(requestId: string, judgement: IdCardJudgement): Promise<void> {
    await this.db.verificationRequest.update({
      where: { id: requestId },
      data: {
        aiVerdict: judgement.verdict,
        aiConfidence: judgement.confidence,
        aiReason: judgement.reason,
        aiExtracted: judgement.extracted,
        aiCheckedAt: new Date(),
      },
    })
    await this.audit.record({
      actorId: null,
      action: 'verification.ai.checked',
      targetType: 'VerificationRequest',
      targetId: requestId,
      metadata: { verdict: judgement.verdict, confidence: judgement.confidence, actor: 'system:ai' },
    })
  }

  /** Approves a high-confidence match when the switch is on. Never rejects. */
  private async maybeAutoApprove(request: { id: string; userId: string; method: string; purpose: string; collegeIdCard: boolean }, judgement: IdCardJudgement): Promise<boolean> {
    const threshold = this.settings.integer(STUDENT_ID_AI_THRESHOLD_SETTING, 90) ?? 90
    if (!shouldAutoApprove({ enabled: true, auto: this.settings.boolean(STUDENT_ID_AI_AUTO_APPROVE_SETTING, false), threshold, verdict: judgement.verdict, confidence: judgement.confidence })) return false
    const now = new Date()
    let newlyVerified = false
    const claimed = await this.db.$transaction(async (tx) => {
      const { count } = await tx.verificationRequest.updateMany({
        where: { id: request.id, status: 'PENDING', purpose: 'ACCOUNT' },
        data: { status: 'APPROVED', decidedAt: now, reason: judgement.reason },
      })
      if (count !== 1) return false
      const user = await tx.user.findUniqueOrThrow({ where: { id: request.userId }, select: { verifiedAt: true } })
      if (!user.verifiedAt) {
        await tx.user.update({ where: { id: request.userId }, data: { verifiedAt: now, verificationMethod: request.method === 'TEACHER' ? 'TEACHER' : 'DOCUMENTS' } })
        newlyVerified = true
      }
      await this.audit.record(
        {
          actorId: null,
          action: 'verification.approved',
          targetType: 'VerificationRequest',
          targetId: request.id,
          metadata: { method: request.method, userId: request.userId, purpose: request.purpose, collegeIdCard: request.collegeIdCard, actor: 'system:ai', confidence: judgement.confidence },
        },
        tx,
      )
      return true
    })
    if (!claimed) return false
    await this.events.publish('VerificationDecided', { requestId: request.id, userId: request.userId, method: request.method as 'TEACHER' | 'DOCUMENTS', decision: 'APPROVED', reviewerId: AI_REVIEWER_ID, purpose: 'ACCOUNT' })
    if (newlyVerified) await this.events.publish('InstitutionVerified', { userId: request.userId, method: request.method as 'TEACHER' | 'DOCUMENTS' })
    return true
  }

  private async profileFor(userId: string): Promise<IdCardProfile> {
    const [user, memberships, emails, orgs] = await Promise.all([
      this.db.user.findUnique({ where: { id: userId }, select: { displayName: true } }),
      this.db.membership.findMany({ where: { userId }, select: { organizationId: true } }),
      this.db.institutionalEmail.findMany({ where: { userId, verifiedAt: { not: null }, replacedAt: null }, select: { domain: true, organizationId: true } }),
      this.db.organization.findMany({ select: { id: true, name: true, emailDomains: true } }),
    ])
    const ownOrgIds = new Set([...memberships.map((m) => m.organizationId), ...emails.flatMap((e) => (e.organizationId ? [e.organizationId] : []))])
    const ownOrgs = orgs.filter((org) => ownOrgIds.has(org.id))
    const ownDomains = new Set<string>()
    for (const email of emails) for (const domain of domainAndParents(email.domain)) ownDomains.add(domain)
    for (const org of ownOrgs) for (const domain of org.emailDomains) for (const parent of domainAndParents(domain.toLowerCase())) ownDomains.add(parent)
    const names = (ownOrgs.length ? ownOrgs : orgs).map((org) => org.name)
    const domains = ownDomains.size ? [...ownDomains] : orgs.flatMap((org) => org.emailDomains.flatMap((domain) => domainAndParents(domain.toLowerCase())))
    return { displayName: user?.displayName ?? '', institutionNames: names, domains }
  }

  /** Bytes for the extractor. The temp file is removed before this returns, and the bytes are not logged. */
  private async readFile(fileId: string): Promise<{ mimeType: string; bytes: Buffer } | null> {
    const dir = await mkdtemp(path.join(tmpdir(), 'lvn-id-'))
    const dest = path.join(dir, 'card')
    try {
      const { mimeType } = await this.files.download(fileId, dest)
      return { mimeType, bytes: await readFile(dest) }
    } catch (e) {
      this.log.warn(`id-card file ${fileId} could not be read: ${(e as Error).name}`)
      return null
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  }
}
