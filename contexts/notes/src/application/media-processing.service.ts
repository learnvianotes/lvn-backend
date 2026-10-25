import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { PrismaService, type Prisma } from '@lvn-backend/prisma-base'
import { Queues } from '@lvn-backend/queue'
import { Storage } from '@lvn-backend/storage'
import { PDFDocument } from 'pdf-lib'
import sharp from 'sharp'
import { NOTES_CONFIG, type NotesConfig } from '../notes.config'
import { clamdScan } from './clamav'
import { RemoteScanClient } from './remote-scan'

const run = promisify(execFile)

/** The notes context's media queue (§9.1 `media`): one job per uploaded file. */
export const NOTES_MEDIA_QUEUE = 'notes.media'

/** Picture sizes by width (§8.1: three sizes), never larger than the original. */
export const IMAGE_SIZES = { thumb: 320, medium: 960, large: 1920 } as const
/** Transcodes and probes give up after this */
const FFMPEG_TIMEOUT_MS = 20 * 60 * 1000

export type Variants = Partial<Record<keyof typeof IMAGE_SIZES | 'video720' | 'poster' | 'audio', string>>

/** The key of a variant next to its original (`{env}/{owner}/{file}/original` → `…/{variant}`). */
export const variantKey = (storageKey: string, name: string) => storageKey.replace(/\/original$/, `/${name}`)

/**
 * Media processing after an upload (§8.1, §8.2, ADR-0041, ADR-0102): the original is already READY. Local mode scans
 * it here and still serves it if the scanner fails on the last attempt. Remote mode has already marked it pending, and
 * this streams it to the scan service: a failure leaves it pending and unserved. Infected and unsafe files are
 * quarantined. What makes it better to show — three picture sizes, a 720p transcode and a poster for video, normalised
 * audio — and the facts §8.2 keeps (size, length, pages, SHA-256) are written only after a clean scan. Runs in
 * apps/worker; FileReady queues it.
 */
@Injectable()
export class MediaProcessingService implements OnModuleInit {
  private readonly log = new Logger('Media')
  /** One client per process so the circuit breaker survives from one file to the next. */
  private remote: RemoteScanClient | null = null

  constructor(
    private readonly db: PrismaService,
    private readonly storage: Storage,
    private readonly queues: Queues,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(NOTES_CONFIG) private readonly config: NotesConfig,
  ) {}

  onModuleInit(): void {
    this.events.subscribe('FileReady', async ({ payload: { fileId } }) => {
      await this.queues.queue(NOTES_MEDIA_QUEUE).add('process-file', { fileId }, { jobId: `${fileId}.process`, attempts: 3, backoff: { type: 'exponential', delay: 30_000 } })
    })
  }

  /** One uploaded file; `lastAttempt` decides what a scanner error leaves behind. */
  async process(fileId: string, lastAttempt = true): Promise<{ status: string; variants: Variants }> {
    const file = await this.db.fileObject.findUnique({ where: { id: fileId } })
    if (!file || file.deletedAt || file.status !== 'READY') return { status: file?.status ?? 'MISSING', variants: {} }
    const dir = await mkdtemp(path.join(tmpdir(), 'lvn-media-'))
    try {
      const original = path.join(dir, 'original')
      await this.storage.download(file.bucket, file.storageKey, original)
      const data: Prisma.FileObjectUpdateInput = { checksumSha256: await sha256(original) }

      if (this.config.scan.mode === 'remote') {
        // Closed before the body is scanned, so a crash here cannot leave a READY file with no scan result.
        if (file.scanResult !== 'PENDING') await this.db.fileObject.update({ where: { id: fileId }, data: { scanResult: 'PENDING' } })
        // Always thrown: a remote failure is never recorded as ERROR and the file is never served unscanned.
        const verdict = await this.scanner().scan(original, file.mimeType, file.ownerId)
        data.scannedAt = new Date()
        if (verdict.result === 'infected' || verdict.result === 'unsafe') {
          await this.quarantine(file, verdict.signature)
          return { status: 'QUARANTINED', variants: {} }
        }
        data.scanResult = 'CLEAN'
        if (verdict.pageCount != null) data.pageCount = verdict.pageCount
      } else if (this.config.scan.mode === 'local') {
        try {
          const scan = await clamdScan(this.config.scan.clamav, original)
          data.scannedAt = new Date()
          if (scan.result === 'INFECTED') {
            await this.quarantine(file, scan.signature)
            return { status: 'QUARANTINED', variants: {} }
          }
          data.scanResult = 'CLEAN'
        } catch (e) {
          // The scanner was unreachable or refused the file (too large): retried, then left served and reported.
          if (!lastAttempt) throw e
          this.log.error(`${fileId}: not scanned: ${(e as Error).message}`)
          data.scanResult = 'ERROR'
          data.scannedAt = new Date()
        }
      }

      const variants: Variants = {}
      const kind = file.mimeType.split('/')[0]
      try {
        if (kind === 'image') {
          const meta = await sharp(original, { animated: false }).rotate().metadata()
          const upright = (meta.orientation ?? 1) >= 5
          data.width = (upright ? meta.height : meta.width) ?? null
          data.height = (upright ? meta.width : meta.height) ?? null
          for (const [name, width] of Object.entries(IMAGE_SIZES) as [keyof typeof IMAGE_SIZES, number][]) {
            const out = path.join(dir, `${name}.webp`)
            await sharp(original, { animated: false }).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toFile(out)
            variants[name] = await this.store(file.bucket, variantKey(file.storageKey, name), out, 'image/webp')
          }
        } else if (kind === 'video') {
          const probe = await ffprobe(original)
          data.durationMs = probe.durationMs
          data.width = probe.width
          data.height = probe.height
          const video = path.join(dir, 'video720.mp4')
          await run('ffmpeg', ['-v', 'error', '-y', '-i', original, '-vf', "scale=-2:'min(720,ih)'", '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', video], { timeout: FFMPEG_TIMEOUT_MS })
          variants.video720 = await this.store(file.bucket, variantKey(file.storageKey, 'video720'), video, 'video/mp4')
          const frame = path.join(dir, 'poster.png')
          const at = probe.durationMs ? Math.min(1, probe.durationMs / 2000) : 0
          await run('ffmpeg', ['-v', 'error', '-y', '-ss', String(at), '-i', original, '-frames:v', '1', frame], { timeout: FFMPEG_TIMEOUT_MS })
          const poster = path.join(dir, 'poster.webp')
          await sharp(frame).resize({ height: 720, withoutEnlargement: true }).webp({ quality: 80 }).toFile(poster)
          variants.poster = await this.store(file.bucket, variantKey(file.storageKey, 'poster'), poster, 'image/webp')
        } else if (kind === 'audio') {
          data.durationMs = (await ffprobe(original)).durationMs
          const audio = path.join(dir, 'audio.m4a')
          await run('ffmpeg', ['-v', 'error', '-y', '-i', original, '-vn', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '128k', audio], { timeout: FFMPEG_TIMEOUT_MS })
          variants.audio = await this.store(file.bucket, variantKey(file.storageKey, 'audio'), audio, 'audio/mp4')
        } else if (file.mimeType === 'application/pdf' && this.config.scan.mode !== 'remote') {
          try {
            const pdf = await PDFDocument.load(await readFile(original), { ignoreEncryption: true, updateMetadata: false })
            data.pageCount = pdf.getPageCount()
          } catch (e) {
            this.log.warn(`${fileId}: pages not counted: ${(e as Error).message}`)
          }
        }
      } catch (e) {
        // A file its tools cannot read (a damaged picture or video) is retried, then stays served as uploaded.
        if (!lastAttempt) throw e
        this.log.warn(`${fileId}: not processed: ${(e as Error).message}`)
      }
      if (Object.keys(variants).length) data.variants = variants
      await this.db.fileObject.update({ where: { id: fileId }, data })
      return { status: 'READY', variants }
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  }

  /** §8.2: kept 90 days under quarantine/ in the restricted bucket; gone from where it was served. */
  private async quarantine(file: Prisma.FileObjectGetPayload<object>, signature: string): Promise<void> {
    await this.storage.copy({ bucket: file.bucket, key: file.storageKey }, { bucket: this.config.restrictedBucket, key: `quarantine/${file.storageKey}` })
    const variants = Object.values((file.variants ?? {}) as Variants).filter((k): k is string => !!k)
    await this.storage.delete(file.bucket, [file.storageKey, ...variants])
    await this.db.fileObject.update({ where: { id: file.id }, data: { status: 'QUARANTINED', scanResult: 'INFECTED', scannedAt: new Date(), variants: undefined } })
    this.log.warn(`${file.id}: quarantined (${signature})`)
    await this.events.publish('FileQuarantined', { fileId: file.id, ownerId: file.ownerId, signature: signature.slice(0, 200) })
  }

  private async store(bucket: string, key: string, file: string, contentType: string): Promise<string> {
    await this.storage.putFile(bucket, key, file, { contentType })
    return key
  }

  /**
   * Files still waiting on the scan service whose job is not queued. The worker runs this every ten minutes so an
   * outage does not leave an upload pending after the service is back. No-op unless SCAN_MODE=remote.
   */
  async requeuePending(): Promise<number> {
    if (this.config.scan.mode !== 'remote') return 0
    const rows = await this.db.fileObject.findMany({
      where: { status: 'READY', scanResult: 'PENDING', deletedAt: null },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: 50,
    })
    const queue = this.queues.queue(NOTES_MEDIA_QUEUE)
    const busy = new Set(['active', 'waiting', 'delayed', 'prioritized', 'waiting-children', 'paused'])
    let n = 0
    for (const row of rows) {
      const jobId = `${row.id}.process`
      const existing = await queue.getJob(jobId)
      if (existing) {
        const state = await existing.getState()
        if (busy.has(state)) continue
        await existing.remove()
      }
      await queue.add('process-file', { fileId: row.id }, { jobId, attempts: 3, backoff: { type: 'exponential', delay: 30_000 } })
      n += 1
    }
    return n
  }

  private scanner(): RemoteScanClient {
    if (this.config.scan.mode !== 'remote') throw new Error('the scan service is not configured')
    this.remote ??= new RemoteScanClient(this.config.scan)
    return this.remote
  }

  /**
   * §8.2 reconciliation: objects in the files bucket without a row, and READY rows without their object. Reported,
   * never deleted — drift is for a person to look at.
   */
  async reconcile(): Promise<{ objects: number; orphanObjects: string[]; missingObjects: string[] }> {
    const prefix = `${this.config.env}/`
    const keys = new Set<string>()
    for await (const key of this.storage.list(this.config.bucket, prefix)) keys.add(key)
    const rows = await this.db.fileObject.findMany({ where: { bucket: this.config.bucket, storageKey: { startsWith: prefix } }, select: { storageKey: true, status: true, variants: true, deletedAt: true } })
    const known = new Set<string>()
    const missingObjects: string[] = []
    for (const r of rows) {
      known.add(r.storageKey)
      for (const v of Object.values((r.variants ?? {}) as Variants)) if (v) known.add(v)
      if (r.status === 'READY' && !r.deletedAt && !keys.has(r.storageKey)) missingObjects.push(r.storageKey)
    }
    const orphanObjects = [...keys].filter((k) => !known.has(k))
    if (orphanObjects.length || missingObjects.length) this.log.warn(`storage drift: ${orphanObjects.length} objects without a row, ${missingObjects.length} rows without their object`)
    return { objects: keys.size, orphanObjects: orphanObjects.slice(0, 100), missingObjects: missingObjects.slice(0, 100) }
  }
}

async function sha256(file: string): Promise<string> {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(file)) hash.update(chunk as Buffer)
  return hash.digest('hex')
}

async function ffprobe(file: string): Promise<{ durationMs: number | null; width: number | null; height: number | null }> {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file], { timeout: 60_000 })
  const info = JSON.parse(stdout) as { format?: { duration?: string }; streams?: { codec_type?: string; width?: number; height?: number; tags?: { rotate?: string }; side_data_list?: { rotation?: number }[] }[] }
  const video = info.streams?.find((s) => s.codec_type === 'video')
  const turned = Math.abs(Number(video?.tags?.rotate ?? video?.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ?? 0)) % 180 === 90
  const seconds = Number(info.format?.duration)
  return {
    durationMs: Number.isFinite(seconds) ? Math.round(seconds * 1000) : null,
    width: (turned ? video?.height : video?.width) ?? null,
    height: (turned ? video?.width : video?.height) ?? null,
  }
}
