import { Inject, Injectable } from '@nestjs/common'
import { CollegeIdCardLimits, collegeIdFileName, isCollegeIdMimeType, UploadLimits } from '@lvn/contracts/domain'
import { assertWithinPlan, Errors } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { ENTITLEMENTS, PEOPLE, PLATFORM_SETTINGS, POLICY, type Entitlements, type FileParentKind, type FilePurposeKind, type Files, type FileSummary, type People, type PlatformSettings, type Policy } from '@lvn-backend/facades'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { RateLimiter } from '@lvn-backend/redis'
import { detectMimeType, isPlainText, MIME_SAMPLE_BYTES, sameKind, sniffBytes, Storage } from '@lvn-backend/storage'
import { NOTES_CONFIG, type NotesConfig } from '../notes.config'
import { NotesService } from './notes.service'
import { uploadRefusal, type UploadLimitConfig, type WindowResult } from './scan-policy'

/** What an upload attempt reads while uploads are off (ADR-0097). */
export const UPLOADS_OFF = 'Uploads are off for now. You can still write notes, cards and code.'

const UPLOAD_URL_TTL_SECONDS = 10 * 60
const READ_URL_TTL_SECONDS = 15 * 60
/** Intents never completed are cleaned up after a day. */
const PENDING_TTL_MS = 24 * 60 * 60 * 1000
const IMAGES = ['image/jpeg', 'image/png', 'image/webp']

/** Documents share the PDF limit: PDF, Word, PowerPoint and plain text. */
const DOCUMENTS = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
]

/** What a note may show (§8.1 limits by kind): pictures, video, audio and documents. */
const NOTE_MEDIA: Record<string, number> = {
  ...Object.fromEntries([...IMAGES, 'image/gif'].map((m) => [m, UploadLimits.image])),
  ...Object.fromEntries(['video/mp4', 'video/webm', 'video/quicktime'].map((m) => [m, UploadLimits.video])),
  ...Object.fromEntries(['audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/webm'].map((m) => [m, UploadLimits.audio])),
  ...Object.fromEntries(DOCUMENTS.map((m) => [m, UploadLimits.document])),
}

interface PurposeRule {
  parentType: FileParentKind
  mimeTypes: string[]
  maxBytes: number | ((mimeType: string) => number)
  /** Stored in the restricted bucket (ADR-0019) */
  restricted: boolean
}

const AUDIO = Object.keys(NOTE_MEDIA).filter((mime) => mime.startsWith('audio/'))
const PAGE_IMAGES = ['image/png', 'image/jpeg']

/** Purposes open to clients. PAGE_IMAGE and VOICE_NOTE finish through completeUpload, so a remote scan still runs. */
const PURPOSES: Partial<Record<FilePurposeKind, PurposeRule>> = {
  ATTACHMENT: { parentType: 'NOTE', mimeTypes: Object.keys(NOTE_MEDIA), maxBytes: (m) => NOTE_MEDIA[m]!, restricted: false },
  PAGE_IMAGE: { parentType: 'NOTE', mimeTypes: PAGE_IMAGES, maxBytes: UploadLimits.image, restricted: false },
  VOICE_NOTE: { parentType: 'NOTE', mimeTypes: AUDIO, maxBytes: UploadLimits.audio, restricted: false },
  // ADR-0018: notes to import — an LVN export, a ZIP of Markdown, or one Markdown or text file.
  IMPORT: { parentType: 'IMPORT_JOB', mimeTypes: ['application/zip', 'text/markdown', 'text/plain'], maxBytes: 200 * 1024 ** 2, restricted: false },
  AVATAR: { parentType: 'AVATAR', mimeTypes: IMAGES, maxBytes: UploadLimits.image, restricted: false },
  // ADR-0074: a resource's cover picture, uploaded before the resource is sent and attached to it then.
  COVER: { parentType: 'RESOURCE', mimeTypes: IMAGES, maxBytes: 2 * 1024 ** 2, restricted: false },
  // ADR-0076: a group's picture, uploaded by one of its admins and attached when the group is saved.
  GROUP_PICTURE: { parentType: 'GROUP', mimeTypes: IMAGES, maxBytes: 2 * 1024 ** 2, restricted: false },
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
    private readonly notes: NotesService,
    @Inject(POLICY) private readonly policy: Policy,
    @Inject(ENTITLEMENTS) private readonly entitlements: Entitlements,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(NOTES_CONFIG) private readonly config: NotesConfig,
    @Inject(PLATFORM_SETTINGS) private readonly settings: PlatformSettings,
    @Inject(PEOPLE) private readonly people: People,
  ) {}

  /** ADR-0097, ADR-0101: off until the environment or an admin turns uploads on. */
  get uploadsEnabled(): boolean {
    return this.settings.boolean('uploads_enabled', this.config.uploads)
  }

  async createUploadIntent(ownerId: string, input: UploadRequest, ip = '') {
    if (!this.uploadsEnabled) throw Errors.unavailable(UPLOADS_OFF)
    const actor = await this.policy.actor(ownerId)
    if (!actor) throw Errors.unauthenticated()
    const rule = PURPOSES[input.purpose]
    if (!rule) throw Errors.validation('Uploads for this purpose are not available yet.', field('purpose'))

    const fileName = [...input.fileName].filter((c) => c !== '/' && c !== '\\' && c.charCodeAt(0) >= 0x20).join('').trim().slice(0, 255)
    if (!fileName) throw Errors.validation('Give the file a name.', field('fileName'))
    if (!rule.mimeTypes.includes(input.mimeType)) throw Errors.validation(`This kind of file is not accepted here (${rule.mimeTypes.join(', ')}).`, field('mimeType'))
    // Camera stills are image/* and have no capture source, so they follow the usual image rules.
    // Voice notes, and any audio or video MIME type, stay off for an under-13 account until consent is verified.
    await this.people.assertCaptureAllowed(ownerId, input.purpose, input.mimeType)
    if (!Number.isInteger(input.sizeBytes) || input.sizeBytes < 1) throw Errors.validation('The file is empty.', field('sizeBytes'))
    const maxBytes = typeof rule.maxBytes === 'number' ? rule.maxBytes : rule.maxBytes(input.mimeType)
    if (input.sizeBytes > maxBytes) throw Errors.validation(`Files like this can be at most ${Math.round(maxBytes / 1024 ** 2)} MB.`, field('sizeBytes'))

    await this.assertUploadRate(ownerId, ip, input.sizeBytes, true)

    if (input.purpose === 'VERIFICATION_DOCUMENT') {
      // ADR-0019: restricted minors never upload identity documents; verified accounts have nothing to prove.
      if (actor.restrictedMinor) throw Errors.forbidden('Ask a teacher to verify your account instead of uploading documents.')
      if (actor.institutionVerified) throw Errors.forbidden('Your account is already verified.')
      const limit = await this.limiter.hit(`docs:${ownerId}`, { max: 10, windowSeconds: 24 * 3600 })
      if (!limit.allowed) throw Errors.rateLimited(limit.retryAfter, 'Too many documents today. Try again tomorrow.')
    }
    if (input.purpose === 'AVATAR' && input.parentId && input.parentId !== ownerId) throw Errors.forbidden()
    // A page image always belongs to a note. A voice note may stand alone (parent is the owner, so the orphan sweep leaves it).
    const onANote = input.purpose === 'ATTACHMENT' || input.purpose === 'PAGE_IMAGE' || (input.purpose === 'VOICE_NOTE' && !!input.parentId)
    if (onANote) {
      if (!input.parentId) throw Errors.validation('Say which note the file is for.', field('parentId'))
      await this.notes.require(ownerId, input.parentId, 'edit')
      const limit = await this.limiter.hit(`uploads:${ownerId}`, { max: 300, windowSeconds: 3600 })
      if (!limit.allowed) throw Errors.rateLimited(limit.retryAfter, 'You have uploaded a lot in the last hour. Try again later.')
    }

    await this.assertQuota(ownerId, input.sizeBytes)

    const id = newId()
    const bucket = rule.restricted ? this.config.restrictedBucket : this.config.bucket
    const storageKey = `${this.config.env}/${ownerId}/${id}/original`
    const parentId = input.purpose === 'AVATAR' ? ownerId : input.purpose === 'ATTACHMENT' || input.purpose === 'PAGE_IMAGE' ? input.parentId! : input.purpose === 'VOICE_NOTE' ? (input.parentId ?? ownerId) : null
    const attachToNote = input.purpose === 'ATTACHMENT' || (input.purpose === 'VOICE_NOTE' && !!input.parentId)
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
        ...(attachToNote ? { attachments: { create: { noteId: input.parentId! } } } : {}),
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
    await this.people.assertCaptureAllowed(ownerId, file.purpose, file.mimeType)
    // ADR-0099: a college ID card is finished by submitStudentIdVerification, which does not publish FileReady.
    if (file.purpose === 'COLLEGE_ID') throw Errors.validation('Send the college ID card with your verification request.')
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
    const { detected, sample } = await this.sniff(file.bucket, file.storageKey, object.sizeBytes)
    if (!sameKind(file.mimeType, detected, sample)) await fail('The file content does not match its type.')
    if (this.config.scan.mode === 'remote') await this.assertPendingScans(ownerId)

    await this.db.fileObject.update({
      where: { id: file.id },
      data: { status: 'READY', detectedMimeType: detected, expiresAt: null, ...(this.config.scan.mode === 'remote' ? { scanResult: 'PENDING' as const } : {}) },
    })
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
      parentId: f.parentId,
      mimeType: f.mimeType,
      sizeBytes: Number(f.sizeBytes),
      status: f.status,
    }))
  }

  async readUrl(fileId: string, opts?: { ttlSeconds?: number }): Promise<{ url: string; expiresAt: Date }> {
    const file = await this.db.fileObject.findUnique({ where: { id: fileId } })
    if (!file || file.status !== 'READY' || file.deletedAt || unserved(file.scanResult)) throw Errors.notFound('File not found.')
    await this.db.fileObject.update({ where: { id: fileId }, data: { accessCount: { increment: 1 }, lastAccessedAt: new Date() } })
    return this.storage.presignGet(file.bucket, file.storageKey, { expiresInSeconds: opts?.ttlSeconds ?? READ_URL_TTL_SECONDS, downloadName: file.originalFileName })
  }

  async createCollegeIdUpload(ownerId: string, input: { fileName: string; mimeType: string; sizeBytes: number }, ip = '') {
    const fileName = collegeIdFileName(input.fileName)
    if (!fileName) throw Errors.validation('Give the file a name.', field('fileName'))
    if (!isCollegeIdMimeType(input.mimeType)) throw Errors.validation('Use a JPEG, PNG, WebP or PDF of your college ID card.', field('mimeType'))
    if (!Number.isInteger(input.sizeBytes) || input.sizeBytes < 1) throw Errors.validation('The file is empty.', field('sizeBytes'))
    if (input.sizeBytes > CollegeIdCardLimits.maxBytes) throw Errors.validation('A college ID card can be at most 5 MB.', field('sizeBytes'))
    await this.assertUploadRate(ownerId, ip, input.sizeBytes, false)
    await this.assertQuota(ownerId, input.sizeBytes)

    const id = newId()
    const bucket = this.config.restrictedBucket
    const storageKey = `${this.config.env}/${ownerId}/${id}/original`
    await this.db.fileObject.create({
      data: {
        id,
        ownerId,
        parentType: 'VERIFICATION_REQUEST',
        parentId: null,
        purpose: 'COLLEGE_ID',
        bucket,
        storageKey,
        mimeType: input.mimeType,
        sizeBytes: BigInt(input.sizeBytes),
        originalFileName: fileName,
        expiresAt: new Date(Date.now() + PENDING_TTL_MS),
      },
    })
    const put = await this.storage.presignPut(bucket, storageKey, {
      contentType: input.mimeType,
      sizeBytes: input.sizeBytes,
      expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
      metadata: { 'file-id': id, 'owner-id': ownerId, env: this.config.env },
    })
    return { fileId: id, uploadUrl: put.url, uploadHeaders: Object.entries(put.headers).map(([name, value]) => ({ name, value })), expiresAt: put.expiresAt }
  }

  async finalizeCollegeIdUpload(ownerId: string, fileId: string): Promise<void> {
    const file = await this.db.fileObject.findUnique({ where: { id: fileId } })
    if (!file || file.ownerId !== ownerId || file.deletedAt || file.purpose !== 'COLLEGE_ID') throw Errors.validation('Upload the college ID card again, then send the request.', ['input', 'fileId'])
    if (file.status === 'READY' && !file.parentId) return
    if (file.status !== 'PENDING' || file.bucket !== this.config.restrictedBucket) throw Errors.validation('Upload the college ID card again, then send the request.', ['input', 'fileId'])

    const object = await this.storage.head(file.bucket, file.storageKey)
    if (!object) throw Errors.validation('The file has not arrived yet. Upload it, then try again.', ['input', 'fileId'])
    const fail = async (message: string): Promise<never> => {
      await this.storage.delete(file.bucket, [file.storageKey])
      await this.db.fileObject.update({ where: { id: file.id }, data: { status: 'FAILED' } })
      throw Errors.validation(message, ['input', 'fileId'])
    }
    if (object.sizeBytes !== Number(file.sizeBytes)) await fail('The uploaded file is not the size that was declared.')
    const { detected, sample } = await this.sniff(file.bucket, file.storageKey, object.sizeBytes)
    if (!sameKind(file.mimeType, detected, sample)) await fail('The file content does not match its type.')

    // READY, but not FileReady and not scanned: the media pipeline would write derivative copies of an identity
    // document, and a college ID card never enters it (ADR-0099, ADR-0102).
    await this.db.fileObject.update({ where: { id: file.id }, data: { status: 'READY', detectedMimeType: detected, expiresAt: null } })
  }

  async download(fileId: string, toPath: string, variant?: 'audio' | 'medium'): Promise<{ mimeType: string }> {
    const file = await this.db.fileObject.findUnique({ where: { id: fileId } })
    if (!file || file.status !== 'READY' || file.deletedAt) throw Errors.notFound('File not found.')
    if (file.scanResult === 'PENDING') throw Errors.unavailable('This file is still being scanned.')
    if (file.scanResult === 'FAILED') throw Errors.validation('This file could not be scanned, so it is not available.')
    const made = variant ? ((file.variants ?? {}) as Record<string, string | undefined>)[variant] : undefined
    await this.storage.download(file.bucket, made ?? file.storageKey, toPath)
    return { mimeType: made ? (variant === 'audio' ? 'audio/mp4' : 'image/webp') : file.mimeType }
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
        detectedMimeType: detectMimeType(file.bytes),
        sizeBytes: BigInt(file.bytes.length),
        originalFileName: file.fileName,
        status: 'READY',
        expiresAt: file.expiresAt,
        ...(!file.restricted && this.config.scan.mode === 'remote' ? { scanResult: 'PENDING' as const } : {}),
      },
    })
    // Scanned and sized like an upload (ADR-0088): a cover copied from a link, a file inside an import. A restricted
    // file (a person's own data export) is never served to anyone else.
    if (!file.restricted) await this.events.publish('FileReady', { fileId: id, ownerId, mimeType: file.mimeType })
    return id
  }

  /**
   * The nightly `orphan-s3` job (§9.2, ADR-0088): uploads never completed (PENDING past their expiry) and files never
   * attached a day after upload (a cover for a resource never submitted, a picture for a post never written). At most
   * 1,000 a night; the rest the next night.
   */
  async purgeOrphans(now = new Date()): Promise<number> {
    const dayAgo = new Date(now.getTime() - 86_400_000)
    const orphans = await this.db.fileObject.findMany({
      where: { deletedAt: null, OR: [{ status: 'PENDING', expiresAt: { lt: now } }, { status: { not: 'PENDING' }, parentId: null, createdAt: { lt: dayAgo } }] },
      select: { id: true },
      take: 1_000,
    })
    if (orphans.length) await this.delete(orphans.map((f) => f.id))
    return orphans.length
  }

  /**
   * A file found inside an import (ADR-0018), stored as an attachment of the note being created — with the checks an
   * upload gets: what the bytes are (not what the name says), the size limit of its kind, and the owner's storage.
   * Returns the file id, or why it was left out.
   */
  async storeAttachment(ownerId: string, noteId: string, fileName: string, bytes: Uint8Array): Promise<{ fileId: string } | { refused: string }> {
    const mimeType = detectMimeType(bytes) ?? (isPlainText(bytes) ? 'text/plain' : null)
    const limit = mimeType ? NOTE_MEDIA[mimeType] : undefined
    if (!mimeType || limit === undefined) return { refused: 'not a picture, video, audio, PDF, Word, PowerPoint or text file notes accept' }
    if (bytes.length > limit) return { refused: `larger than ${Math.round(limit / 1024 ** 2)} MB` }
    try {
      await this.assertQuota(ownerId, bytes.length)
    } catch (e) {
      return { refused: e instanceof Error ? e.message : "You've reached your plan's limit for storage." }
    }
    const fileId = await this.store(ownerId, { purpose: 'ATTACHMENT', parent: { type: 'NOTE', id: noteId }, fileName: fileName.slice(0, 255), mimeType, bytes, restricted: false, expiresAt: null })
    await this.db.noteAttachment.create({ data: { noteId, fileId } })
    return { fileId }
  }

  /** The bytes of a READY file of this owner (the importer reads uploads), at most `maxBytes`. */
  async readBytes(ownerId: string, fileId: string, maxBytes: number): Promise<{ bytes: Uint8Array; fileName: string; mimeType: string }> {
    const file = await this.db.fileObject.findUnique({ where: { id: fileId } })
    if (!file || file.ownerId !== ownerId || file.status !== 'READY' || file.deletedAt) throw Errors.notFound('Upload not found.')
    if (file.scanResult === 'PENDING') throw Errors.unavailable('This file is still being scanned.')
    if (file.scanResult === 'FAILED') throw Errors.validation('This file could not be scanned, so it cannot be imported.')
    return { bytes: await this.storage.getBytes(file.bucket, file.storageKey, maxBytes), fileName: file.originalFileName, mimeType: file.mimeType }
  }

  /** Read URLs for READY files the caller has already decided the reader may see; one access count update. */
  async readUrls(fileIds: string[], opts: { ttlSeconds?: number } = {}) {
    // `not: PENDING` would also drop SQL NULL (never scanned, or the local mode's give-up is ERROR). List the results that may be served.
    const files = fileIds.length
      ? await this.db.fileObject.findMany({
          where: { id: { in: [...new Set(fileIds)] }, status: 'READY', deletedAt: null, OR: [{ scanResult: null }, { scanResult: { in: ['CLEAN', 'ERROR'] } }] },
        })
      : []
    if (files.length) await this.db.fileObject.updateMany({ where: { id: { in: files.map((f) => f.id) } }, data: { accessCount: { increment: 1 }, lastAccessedAt: new Date() } })
    const ttl = opts.ttlSeconds ?? READ_URL_TTL_SECONDS
    const signed = await Promise.all(
      files.map(async (f) => {
        const { url, expiresAt } = await this.storage.presignGet(f.bucket, f.storageKey, { expiresInSeconds: ttl, downloadName: f.originalFileName })
        // Sizes, transcodes and posters made after the upload (ADR-0041), signed like the original.
        const variants: Record<string, string> = {}
        for (const [name, key] of Object.entries((f.variants ?? {}) as Record<string, string>)) {
          if (typeof key === 'string' && key) variants[name] = (await this.storage.presignGet(f.bucket, key, { expiresInSeconds: ttl })).url
        }
        return [f.id, { file: f, url, expiresAt, variants }] as const
      }),
    )
    return new Map(signed)
  }

  async delete(fileIds: string[]): Promise<void> {
    const files = await this.db.fileObject.findMany({ where: { id: { in: fileIds }, deletedAt: null } })
    await this.deleteStored(files)
  }

  /** A minor purge: every object this person still has, including sizes and posters made later (ADR-0110). */
  async purgeOwner(ownerId: string): Promise<{ objects: number }> {
    const files = await this.db.fileObject.findMany({ where: { ownerId, deletedAt: null } })
    return { objects: await this.deleteStored(files) }
  }

  /** Storage first, then the row. A retry deletes the same keys again; object storage treats that as gone. */
  private async deleteStored(files: { id: string; bucket: string; storageKey: string; variants: unknown }[]): Promise<number> {
    const byBucket = new Map<string, string[]>()
    const add = (bucket: string, key: string) => byBucket.set(bucket, [...(byBucket.get(bucket) ?? []), key])
    for (const f of files) {
      add(f.bucket, f.storageKey)
      if (f.variants && typeof f.variants === 'object') {
        for (const key of Object.values(f.variants as Record<string, unknown>)) {
          if (typeof key === 'string' && key) add(f.bucket, key)
        }
      }
    }
    let objects = 0
    for (const [bucket, keys] of byBucket) {
      const unique = [...new Set(keys)]
      for (let i = 0; i < unique.length; i += 1000) await this.storage.delete(bucket, unique.slice(i, i + 1000))
      objects += unique.length
    }
    if (files.length) await this.db.fileObject.updateMany({ where: { id: { in: files.map((f) => f.id) } }, data: { status: 'DELETED', deletedAt: new Date() } })
    return objects
  }

  async storageUsed(ownerId: string): Promise<bigint> {
    const used = await this.db.fileObject.aggregate({ where: { ownerId, deletedAt: null, status: { notIn: ['FAILED', 'DELETED'] } }, _sum: { sizeBytes: true } })
    return used._sum.sizeBytes ?? 0n
  }

  /** Leading bytes, plus a zip's central directory when the object is larger than that sample. */
  private async sniff(bucket: string, key: string, sizeBytes: number): Promise<{ detected: string | null; sample: Uint8Array }> {
    const sampleLen = Math.min(sizeBytes, MIME_SAMPLE_BYTES)
    const sample = sampleLen > 0 ? await this.storage.firstBytes(bucket, key, sampleLen) : new Uint8Array()
    const detected = await sniffBytes(sizeBytes, sample, (start, end) => this.storage.rangeBytes(bucket, key, start, end))
    return { detected, sample }
  }

  /** Storage comes from the plan's STORAGE_BYTES entitlement (ADR-0024). A null limit is unlimited. */
  private async assertQuota(ownerId: string, sizeBytes: number): Promise<void> {
    const limit = await this.entitlements.limit(ownerId, 'STORAGE_BYTES')
    assertWithinPlan('STORAGE_BYTES', limit, await this.storageUsed(ownerId), BigInt(sizeBytes))
  }

  /** Per-user and per-address windows, plus (for files that will be scanned) how many scans are already waiting. */
  private async assertUploadRate(ownerId: string, ip: string, sizeBytes: number, countPending: boolean): Promise<void> {
    const limits = this.uploadLimits()
    const pending = countPending && this.config.scan.mode === 'remote' ? await this.pendingScans(ownerId) : 0
    if (pending >= limits.pendingScans) {
      const refusal = uploadRefusal({ minute: open, day: open, bytes: open, ip: open, pending }, limits)
      if (refusal) throw Errors.rateLimited(refusal.retryAfter, refusal.message)
    }
    const minute = await this.limiter.hit(`upload:user:m:${ownerId}`, { max: limits.perMinute, windowSeconds: 60 })
    if (!minute.allowed) throw Errors.rateLimited(minute.retryAfter, `You can upload ${limits.perMinute} files a minute. Try again in ${minute.retryAfter} seconds.`)
    const day = await this.limiter.hit(`upload:user:d:${ownerId}`, { max: limits.perDay, windowSeconds: 24 * 3600 })
    if (!day.allowed) throw Errors.rateLimited(day.retryAfter, `You can upload ${limits.perDay} files a day. Try again in ${day.retryAfter} seconds.`)
    const bytes = await this.limiter.charge(`upload:user:b:${ownerId}`, sizeBytes, { max: limits.bytesPerDay, windowSeconds: 24 * 3600 })
    if (!bytes.allowed) throw Errors.rateLimited(bytes.retryAfter, `You can upload ${Math.round(limits.bytesPerDay / (1024 * 1024))} MB a day. Try again in ${bytes.retryAfter} seconds.`)
    if (!ip) return
    const network = await this.limiter.hit(`upload:ip:m:${ip}`, { max: limits.perIpPerMinute, windowSeconds: 60 })
    if (!network.allowed) throw Errors.rateLimited(network.retryAfter, `Too many uploads from this network. Try again in ${network.retryAfter} seconds.`)
  }

  private async assertPendingScans(ownerId: string): Promise<void> {
    const limits = this.uploadLimits()
    const pending = await this.pendingScans(ownerId)
    const refusal = uploadRefusal({ minute: open, day: open, bytes: open, ip: open, pending }, limits)
    if (refusal) throw Errors.rateLimited(refusal.retryAfter, refusal.message)
  }

  private pendingScans(ownerId: string): Promise<number> {
    return this.db.fileObject.count({ where: { ownerId, deletedAt: null, scanResult: 'PENDING' } })
  }

  private uploadLimits(): UploadLimitConfig {
    const base = this.config.uploadLimits
    const number = (key: string, fallback: number) => {
      const saved = this.settings.integer(key, fallback)
      return saved ?? fallback
    }
    return {
      perMinute: number('uploads_per_minute', base.perMinute),
      perDay: number('uploads_per_day', base.perDay),
      bytesPerDay: number('upload_bytes_per_day', base.bytesPerDay),
      pendingScans: number('upload_pending_scans', base.pendingScans),
      perIpPerMinute: number('uploads_per_ip_per_minute', base.perIpPerMinute),
    }
  }
}

const open: WindowResult = { allowed: true, retryAfter: 0 }

function unserved(result: string | null): boolean {
  return result === 'PENDING' || result === 'FAILED'
}
