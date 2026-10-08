import { Inject, Injectable } from '@nestjs/common'
import { UploadLimits } from '@lvn/contracts/domain'
import { Errors } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { ENTITLEMENTS, POLICY, type Entitlements, type FileParentKind, type FilePurposeKind, type Files, type FileSummary, type Policy } from '@lvn-backend/facades'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { RateLimiter } from '@lvn-backend/redis'
import { detectMimeType, Storage } from '@lvn-backend/storage'
import { NOTES_CONFIG, type NotesConfig } from '../notes.config'

const UPLOAD_URL_TTL_SECONDS = 10 * 60
const READ_URL_TTL_SECONDS = 15 * 60
/** Intents never completed are cleaned up after a day. */
const PENDING_TTL_MS = 24 * 60 * 60 * 1000
const IMAGES = ['image/jpeg', 'image/png', 'image/webp']

interface PurposeRule {
  parentType: FileParentKind
  mimeTypes: string[]
  maxBytes: number
  /** Stored in the restricted bucket (ADR-0019) */
  restricted: boolean
}

/** Purposes open in Phase 1; note media (ATTACHMENT, COVER, VOICE_NOTE) and IMPORT arrive with notes in Phase 2. */
const PURPOSES: Partial<Record<FilePurposeKind, PurposeRule>> = {
  AVATAR: { parentType: 'AVATAR', mimeTypes: IMAGES, maxBytes: UploadLimits.image, restricted: false },
  VERIFICATION_DOCUMENT: { parentType: 'VERIFICATION_REQUEST', mimeTypes: [...IMAGES, 'application/pdf'], maxBytes: UploadLimits.document, restricted: true },
}

export interface UploadRequest {
  fileName: string
  mimeType: string
  sizeBytes: number
  purpose: FilePurposeKind
  parentId?: string | null
}

const field = (name: string) => ['input', name]

/**
 * The upload flow of §8.1 and the FileObject record of §8.2: a row first, then a pre-signed PUT bound to the declared
 * type and size, then completeUpload checks what actually arrived (existence, size, magic bytes) before READY.
 * Clients only ever see file ids; keys are `{env}/{ownerId}/{fileId}/original`.
 */
@Injectable()
export class FilesService implements Files {
  constructor(
    private readonly db: PrismaService,
    private readonly storage: Storage,
    private readonly limiter: RateLimiter,
    @Inject(POLICY) private readonly policy: Policy,
    @Inject(ENTITLEMENTS) private readonly entitlements: Entitlements,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(NOTES_CONFIG) private readonly config: NotesConfig,
  ) {}

  async createUploadIntent(ownerId: string, input: UploadRequest) {
    const actor = await this.policy.actor(ownerId)
    if (!actor) throw Errors.unauthenticated()
    const rule = PURPOSES[input.purpose]
    if (!rule) throw Errors.validation('Uploads for this purpose are not available yet.', field('purpose'))

    const fileName = [...input.fileName].filter((c) => c !== '/' && c !== '\\' && c.charCodeAt(0) >= 0x20).join('').trim().slice(0, 255)
    if (!fileName) throw Errors.validation('Give the file a name.', field('fileName'))
    if (!rule.mimeTypes.includes(input.mimeType)) throw Errors.validation(`This kind of file is not accepted here (${rule.mimeTypes.join(', ')}).`, field('mimeType'))
    if (!Number.isInteger(input.sizeBytes) || input.sizeBytes < 1) throw Errors.validation('The file is empty.', field('sizeBytes'))
    if (input.sizeBytes > rule.maxBytes) throw Errors.validation(`Files can be at most ${Math.round(rule.maxBytes / 1024 ** 2)} MB.`, field('sizeBytes'))

    if (input.purpose === 'VERIFICATION_DOCUMENT') {
      // ADR-0019: restricted minors never upload identity documents; verified accounts have nothing to prove.
      if (actor.restrictedMinor) throw Errors.forbidden('Ask a teacher to verify your account instead of uploading documents.')
      if (actor.institutionVerified) throw Errors.forbidden('Your account is already verified.')
      const limit = await this.limiter.hit(`docs:${ownerId}`, { max: 10, windowSeconds: 24 * 3600 })
      if (!limit.allowed) throw Errors.rateLimited(limit.retryAfter, 'Too many documents today. Try again tomorrow.')
    }
    if (input.purpose === 'AVATAR' && input.parentId && input.parentId !== ownerId) throw Errors.forbidden()

    await this.assertQuota(ownerId, input.sizeBytes)

    const id = newId()
    const bucket = rule.restricted ? this.config.restrictedBucket : this.config.bucket
    const storageKey = `${this.config.env}/${ownerId}/${id}/original`
    await this.db.fileObject.create({
      data: {
        id,
        ownerId,
        parentType: rule.parentType,
        parentId: input.purpose === 'AVATAR' ? ownerId : null,
        purpose: input.purpose,
        bucket,
        storageKey,
        mimeType: input.mimeType,
        sizeBytes: BigInt(input.sizeBytes),
        originalFileName: fileName,
        expiresAt: new Date(Date.now() + PENDING_TTL_MS),
      },
    })
    // S3 metadata mirrors the identity fields so lifecycle rules and forensics work from S3 alone (§8.2).
    const put = await this.storage.presignPut(bucket, storageKey, {
      contentType: input.mimeType,
      sizeBytes: input.sizeBytes,
      expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
      metadata: { 'file-id': id, 'owner-id': ownerId, env: this.config.env },
    })
    return { fileId: id, uploadUrl: put.url, uploadHeaders: Object.entries(put.headers).map(([name, value]) => ({ name, value })), expiresAt: put.expiresAt }
  }

  async completeUpload(ownerId: string, fileId: string): Promise<void> {
    const file = await this.db.fileObject.findUnique({ where: { id: fileId } })
    if (!file || file.ownerId !== ownerId || file.deletedAt) throw Errors.notFound('Upload not found.')
    if (file.status === 'READY') return
    if (file.status !== 'PENDING') throw Errors.validation('This upload cannot be completed. Upload the file again.')

    const object = await this.storage.head(file.bucket, file.storageKey)
    if (!object) throw Errors.validation('The file has not arrived yet. Upload it, then try again.')
    const fail = async (message: string): Promise<never> => {
      await this.storage.delete(file.bucket, [file.storageKey])
      await this.db.fileObject.update({ where: { id: file.id }, data: { status: 'FAILED' } })
      throw Errors.validation(message)
    }
    if (object.sizeBytes !== Number(file.sizeBytes)) await fail('The uploaded file is not the size that was declared.')
    const detected = detectMimeType(await this.storage.firstBytes(file.bucket, file.storageKey))
    if (detected !== file.mimeType) await fail('The file content does not match its type.')

    await this.db.fileObject.update({ where: { id: file.id }, data: { status: 'READY', detectedMimeType: detected, expiresAt: null } })
    await this.events.publish('FileReady', { fileId: file.id, ownerId, mimeType: file.mimeType })
  }

  // ── Files facade (libs/facades) ──────────────────────────────────────────────────────────────────────────

  async attach(fileIds: string[], ownerId: string, purpose: FilePurposeKind, parent: { type: FileParentKind; id: string }): Promise<void> {
    const unique = [...new Set(fileIds)]
    const files = await this.db.fileObject.findMany({ where: { id: { in: unique } } })
    const usable = (f: (typeof files)[number]) => f.ownerId === ownerId && f.purpose === purpose && f.status === 'READY' && !f.parentId && !f.deletedAt
    if (files.length !== unique.length || !files.every(usable)) throw Errors.validation('Upload the files again, then send the request.', ['input', 'fileIds'])
    const { count } = await this.db.fileObject.updateMany({
      where: { id: { in: unique }, ownerId, parentId: null, status: 'READY' },
      data: { parentType: parent.type, parentId: parent.id },
    })
    if (count !== unique.length) throw Errors.conflict('These files were just used elsewhere.', ['input', 'fileIds'])
  }

  async describe(fileIds: string[]): Promise<FileSummary[]> {
    const files = await this.db.fileObject.findMany({ where: { id: { in: fileIds } }, orderBy: { createdAt: 'asc' } })
    return files.map((f) => ({
      id: f.id,
      ownerId: f.ownerId,
      purpose: f.purpose,
      originalFileName: f.originalFileName,
      mimeType: f.mimeType,
      sizeBytes: Number(f.sizeBytes),
      status: f.status,
    }))
  }

  async readUrl(fileId: string): Promise<{ url: string; expiresAt: Date }> {
    const file = await this.db.fileObject.findUnique({ where: { id: fileId } })
    if (!file || file.status !== 'READY' || file.deletedAt) throw Errors.notFound('File not found.')
    await this.db.fileObject.update({ where: { id: fileId }, data: { accessCount: { increment: 1 }, lastAccessedAt: new Date() } })
    return this.storage.presignGet(file.bucket, file.storageKey, { expiresInSeconds: READ_URL_TTL_SECONDS, downloadName: file.originalFileName })
  }

  async delete(fileIds: string[]): Promise<void> {
    const files = await this.db.fileObject.findMany({ where: { id: { in: fileIds }, deletedAt: null } })
    const byBucket = new Map<string, string[]>()
    for (const f of files) byBucket.set(f.bucket, [...(byBucket.get(f.bucket) ?? []), f.storageKey])
    for (const [bucket, keys] of byBucket) await this.storage.delete(bucket, keys)
    await this.db.fileObject.updateMany({ where: { id: { in: files.map((f) => f.id) } }, data: { status: 'DELETED', deletedAt: new Date() } })
  }

  /** §8.1 quotas: 5 GB per student, 20 GB per teacher — from the plan's STORAGE_BYTES entitlement (ADR-0024). */
  private async assertQuota(ownerId: string, sizeBytes: number): Promise<void> {
    const limit = await this.entitlements.limit(ownerId, 'STORAGE_BYTES')
    if (limit === null) return
    const used = await this.db.fileObject.aggregate({ where: { ownerId, deletedAt: null, status: { notIn: ['FAILED', 'DELETED'] } }, _sum: { sizeBytes: true } })
    if ((used._sum.sizeBytes ?? 0n) + BigInt(sizeBytes) > limit) throw Errors.validation('Your storage is full. Delete files to make room.', field('sizeBytes'))
  }
}
