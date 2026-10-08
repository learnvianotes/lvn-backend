import { Inject, Injectable } from '@nestjs/common'
import { UploadLimits } from '@lvn/contracts/domain'
import { Errors } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { ENTITLEMENTS, POLICY, type Entitlements, type FileParentKind, type FilePurposeKind, type Files, type FileSummary, type Policy } from '@lvn-backend/facades'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { RateLimiter } from '@lvn-backend/redis'
import { detectMimeType, Storage } from '@lvn-backend/storage'
import { NOTES_CONFIG, type NotesConfig } from '../notes.config'
import { NotesService } from './notes.service'

const UPLOAD_URL_TTL_SECONDS = 10 * 60
const READ_URL_TTL_SECONDS = 15 * 60
/** Intents never completed are cleaned up after a day. */
const PENDING_TTL_MS = 24 * 60 * 60 * 1000
const IMAGES = ['image/jpeg', 'image/png', 'image/webp']

/** What a note may show (§8.1 limits by kind): pictures, video, audio and PDF documents. */
const NOTE_MEDIA: Record<string, number> = {
  ...Object.fromEntries([...IMAGES, 'image/gif'].map((m) => [m, UploadLimits.image])),
  ...Object.fromEntries(['video/mp4', 'video/webm', 'video/quicktime'].map((m) => [m, UploadLimits.video])),
  ...Object.fromEntries(['audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/webm'].map((m) => [m, UploadLimits.audio])),
  'application/pdf': UploadLimits.document,
}

interface PurposeRule {
  parentType: FileParentKind
  mimeTypes: string[]
  maxBytes: number | ((mimeType: string) => number)
  /** Stored in the restricted bucket (ADR-0019) */
  restricted: boolean
}

/** Purposes open so far; COVER, VOICE_NOTE and IMPORT arrive with their features. */
const PURPOSES: Partial<Record<FilePurposeKind, PurposeRule>> = {
  ATTACHMENT: { parentType: 'NOTE', mimeTypes: Object.keys(NOTE_MEDIA), maxBytes: (m) => NOTE_MEDIA[m]!, restricted: false },
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
 * Whether the bytes are what was declared. WebM and MP4 are containers: a recording made in the browser is audio/webm
 * whose bytes look like video/webm, and many .m4a files carry an MP4 brand.
 */
function sameKind(declared: string, detected: string | null): boolean {
  if (declared === detected) return true
  return (declared === 'audio/webm' && detected === 'video/webm') || (declared === 'audio/mp4' && detected === 'video/mp4')
}

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
    private readonly notes: NotesService,
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
    const maxBytes = typeof rule.maxBytes === 'number' ? rule.maxBytes : rule.maxBytes(input.mimeType)
    if (input.sizeBytes > maxBytes) throw Errors.validation(`Files like this can be at most ${Math.round(maxBytes / 1024 ** 2)} MB.`, field('sizeBytes'))

    if (input.purpose === 'VERIFICATION_DOCUMENT') {
      // ADR-0019: restricted minors never upload identity documents; verified accounts have nothing to prove.
      if (actor.restrictedMinor) throw Errors.forbidden('Ask a teacher to verify your account instead of uploading documents.')
      if (actor.institutionVerified) throw Errors.forbidden('Your account is already verified.')
      const limit = await this.limiter.hit(`docs:${ownerId}`, { max: 10, windowSeconds: 24 * 3600 })
      if (!limit.allowed) throw Errors.rateLimited(limit.retryAfter, 'Too many documents today. Try again tomorrow.')
    }
    if (input.purpose === 'AVATAR' && input.parentId && input.parentId !== ownerId) throw Errors.forbidden()
    if (input.purpose === 'ATTACHMENT') {
      // Files go to a note the uploader may edit: its owner or a share editor (§5). Its readers then see them.
      if (!input.parentId) throw Errors.validation('Say which note the file is for.', field('parentId'))
      await this.notes.require(ownerId, input.parentId, 'edit')
      const limit = await this.limiter.hit(`uploads:${ownerId}`, { max: 300, windowSeconds: 3600 })
      if (!limit.allowed) throw Errors.rateLimited(limit.retryAfter, 'You have uploaded a lot in the last hour. Try again later.')
    }

    await this.assertQuota(ownerId, input.sizeBytes)

    const id = newId()
    const bucket = rule.restricted ? this.config.restrictedBucket : this.config.bucket
    const storageKey = `${this.config.env}/${ownerId}/${id}/original`
    const parentId = input.purpose === 'AVATAR' ? ownerId : input.purpose === 'ATTACHMENT' ? input.parentId! : null
    await this.db.fileObject.create({
      data: {
        id,
        ownerId,
        parentType: rule.parentType,
        parentId,
        purpose: input.purpose,
        bucket,
        storageKey,
        mimeType: input.mimeType,
        sizeBytes: BigInt(input.sizeBytes),
        originalFileName: fileName,
        expiresAt: new Date(Date.now() + PENDING_TTL_MS),
        ...(input.purpose === 'ATTACHMENT' ? { attachments: { create: { noteId: parentId! } } } : {}),
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
    if (!sameKind(file.mimeType, detected)) await fail('The file content does not match its type.')

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

  async store(ownerId: string, file: { purpose: FilePurposeKind; parent: { type: FileParentKind; id: string }; fileName: string; mimeType: string; bytes: Uint8Array; restricted: boolean; expiresAt: Date | null }): Promise<string> {
    const id = newId()
    const bucket = file.restricted ? this.config.restrictedBucket : this.config.bucket
    const storageKey = `${this.config.env}/${ownerId}/${id}/original`
    await this.storage.put(bucket, storageKey, file.bytes, { contentType: file.mimeType, metadata: { 'file-id': id, 'owner-id': ownerId, env: this.config.env } })
    await this.db.fileObject.create({
      data: {
        id,
        ownerId,
        parentType: file.parent.type,
        parentId: file.parent.id,
        purpose: file.purpose,
        bucket,
        storageKey,
        mimeType: file.mimeType,
        detectedMimeType: detectMimeType(file.bytes.slice(0, 64)),
        sizeBytes: BigInt(file.bytes.length),
        originalFileName: file.fileName,
        status: 'READY',
        expiresAt: file.expiresAt,
      },
    })
    return id
  }

  /** The bytes of a READY file of this owner (the importer reads uploads), at most `maxBytes`. */
  async readBytes(ownerId: string, fileId: string, maxBytes: number): Promise<{ bytes: Uint8Array; fileName: string; mimeType: string }> {
    const file = await this.db.fileObject.findUnique({ where: { id: fileId } })
    if (!file || file.ownerId !== ownerId || file.status !== 'READY' || file.deletedAt) throw Errors.notFound('Upload not found.')
    return { bytes: await this.storage.getBytes(file.bucket, file.storageKey, maxBytes), fileName: file.originalFileName, mimeType: file.mimeType }
  }

  /** Read URLs for READY files the caller has already decided the reader may see; one access count update. */
  async readUrls(fileIds: string[]) {
    const files = fileIds.length ? await this.db.fileObject.findMany({ where: { id: { in: [...new Set(fileIds)] }, status: 'READY', deletedAt: null } }) : []
    if (files.length) await this.db.fileObject.updateMany({ where: { id: { in: files.map((f) => f.id) } }, data: { accessCount: { increment: 1 }, lastAccessedAt: new Date() } })
    const signed = await Promise.all(
      files.map(async (f) => {
        const { url, expiresAt } = await this.storage.presignGet(f.bucket, f.storageKey, { expiresInSeconds: READ_URL_TTL_SECONDS, downloadName: f.originalFileName })
        return [f.id, { file: f, url, expiresAt }] as const
      }),
    )
    return new Map(signed)
  }

  async delete(fileIds: string[]): Promise<void> {
    const files = await this.db.fileObject.findMany({ where: { id: { in: fileIds }, deletedAt: null } })
    const byBucket = new Map<string, string[]>()
    for (const f of files) byBucket.set(f.bucket, [...(byBucket.get(f.bucket) ?? []), f.storageKey])
    for (const [bucket, keys] of byBucket) await this.storage.delete(bucket, keys)
    await this.db.fileObject.updateMany({ where: { id: { in: files.map((f) => f.id) } }, data: { status: 'DELETED', deletedAt: new Date() } })
  }

  async storageUsed(ownerId: string): Promise<bigint> {
    const used = await this.db.fileObject.aggregate({ where: { ownerId, deletedAt: null, status: { notIn: ['FAILED', 'DELETED'] } }, _sum: { sizeBytes: true } })
    return used._sum.sizeBytes ?? 0n
  }

  /** §8.1 quotas: 5 GB per student, 20 GB per teacher — from the plan's STORAGE_BYTES entitlement (ADR-0024). */
  private async assertQuota(ownerId: string, sizeBytes: number): Promise<void> {
    const limit = await this.entitlements.limit(ownerId, 'STORAGE_BYTES')
    if (limit === null) return
    if ((await this.storageUsed(ownerId)) + BigInt(sizeBytes) > limit) throw Errors.validation('Your storage is full. Delete files to make room.', field('sizeBytes'))
  }
}
