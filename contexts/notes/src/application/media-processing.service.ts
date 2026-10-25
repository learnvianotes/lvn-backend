import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { metrics } from '@opentelemetry/api'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { PLATFORM_SETTINGS, type PlatformSettings } from '@lvn-backend/facades'
import { PrismaService, type Prisma } from '@lvn-backend/prisma-base'
import { DelayJobError, Queues } from '@lvn-backend/queue'
import { Storage } from '@lvn-backend/storage'
import { PDFDocument } from 'pdf-lib'
import sharp from 'sharp'
import { NOTES_CONFIG, type NotesConfig } from '../notes.config'
import { clamdScan } from './clamav'
import { FileScanQueue } from './file-scan-queue'
import { RemoteScanClient, ScanNotReadyError, ScanUnavailableError } from './remote-scan'
import { FILE_SCAN_QUEUE, ScanCircuitGate } from './scan-policy'

const scanMeter = metrics.getMeter('lvn-notes')
const scanWait = scanMeter.createHistogram('lvn.scan.wait', { unit: 'ms', description: 'How long a file-scan job waited before it started' })
const scanDuration = scanMeter.createHistogram('lvn.scan.duration', { unit: 'ms', description: 'How long one scan attempt took' })
const scanFailures = scanMeter.createCounter('lvn.scan.failures', { description: 'Scan attempts that did not return a verdict' })

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
 * it here and still serves it if the scanner fails on the last attempt. Remote mode queues `file-scan` instead. That
 * job streams the file to the scan service. A failure leaves it pending and unserved; the last attempt marks it
 * FAILED, which is also unserved. Infected and unsafe files are quarantined. Variants run on the media queue only
 * after a clean verdict. Runs in apps/worker; FileReady queues it.
 */
@Injectable()
export class MediaProcessingService implements OnModuleInit {
  private readonly log = new Logger('Media')
  /** One client per process so the circuit breaker survives from one file to the next. */
  private remote: RemoteScanClient | null = null
  private gate: ScanCircuitGate | null = null

  constructor(
    private readonly db: PrismaService,
    private readonly storage: Storage,
    private readonly queues: Queues,
    private readonly scans: FileScanQueue,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(NOTES_CONFIG) private readonly config: NotesConfig,
    @Inject(PLATFORM_SETTINGS) private readonly settings: PlatformSettings,
  ) {}

  onModuleInit(): void {
    this.events.subscribe('FileReady', async ({ payload: { fileId, ownerId } }) => {
      if (this.config.scan.mode === 'remote') {
        await this.scans.enqueue(fileId, ownerId)
        return
      }
      await this.queues.queue(NOTES_MEDIA_QUEUE).add('process-file', { fileId }, { jobId: `${fileId}.process`, attempts: 3, backoff: { type: 'exponential', delay: 30_000 } })
    })
  }

  /** How many scan jobs this worker runs at once. An admin setting overrides the environment until the process restarts. */
  scanConcurrency(): number {
    const saved = this.settings.integer('scan_queue_concurrency', this.config.scanQueue.concurrency)
    const n = saved ?? this.config.scanQueue.concurrency
    return Math.min(8, Math.max(1, n))
  }

  /**
   * One file-scan job. An open circuit pauses the queue and puts the job back without using an attempt. A user who
   * already has a scan in flight waits the same way, so one bulk upload cannot take both worker slots.
   */
  async handleScanJob(data: { fileId?: string; userId?: string }, lastAttempt: boolean, waitMs = 0): Promise<void> {
    const fileId = data.fileId ?? ''
    const userId = data.userId ?? ''
    if (!fileId) throw new Error('scan job is missing a file id')
    if (this.config.scan.mode !== 'remote') {
      await this.process(fileId, lastAttempt)
      return
    }
    const client = this.scanner()
    if (Date.now() < client.circuitOpenUntil) {
      await this.circuitGate().sync(client.circuitOpenUntil)
      throw new DelayJobError(client.circuitOpenUntil)
    }
    const locked = await this.scans.tryLock(userId, fileId, clientTimeout(this.config) + 30_000)
    if (!locked) throw new DelayJobError(Date.now() + 2_000)
    const started = Date.now()
    try {
      const outcome = await this.scanQueued(fileId, lastAttempt)
      await this.observe(waitMs, Date.now() - started, outcome)
    } catch (e) {
      if (e instanceof ScanNotReadyError) {
        const until = Date.now() + Math.max(1_000, e.retryAfterMs)
        await this.circuitGate().sync(until)
        await this.observe(waitMs, Date.now() - started, 'not-ready')
        throw new DelayJobError(until)
      }
      if (Date.now() < client.circuitOpenUntil) await this.circuitGate().sync(client.circuitOpenUntil)
      await this.observe(waitMs, Date.now() - started, 'failed')
      throw e
    } finally {
      await this.scans.unlock(userId, fileId)
    }
  }

  /** One uploaded file; `lastAttempt` decides what a scanner error leaves behind. */
  async process(fileId: string, lastAttempt = true): Promise<{ status: string; variants: Variants }> {
    const file = await this.db.fileObject.findUnique({ where: { id: fileId } })
    if (!file || file.deletedAt || file.status !== 'READY') return { status: file?.status ?? 'MISSING', variants: {} }
    // Remote scans run on file-scan. Variants wait until that job has recorded a clean verdict.
    if (this.config.scan.mode === 'remote' && file.scanResult !== 'CLEAN') return { status: file.status, variants: {} }
    const dir = await mkdtemp(path.join(tmpdir(), 'lvn-media-'))
    try {
      const original = path.join(dir, 'original')
      await this.storage.download(file.bucket, file.storageKey, original)
      const data: Prisma.FileObjectUpdateInput = { checksumSha256: await sha256(original) }

      if (this.config.scan.mode === 'local') {
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
   * The file-scan job. A clean verdict queues media processing. The last failed attempt marks the file FAILED, copies
   * the job to the dead-letter queue, and still throws so the failure is reported with the owner's user id.
   */
  async scanQueued(fileId: string, lastAttempt: boolean): Promise<'clean' | 'quarantined'> {
    const file = await this.db.fileObject.findUnique({ where: { id: fileId } })
    if (!file || file.deletedAt || file.status !== 'READY' || file.scanResult === 'FAILED') return 'clean'
    if (file.scanResult === 'CLEAN') return 'clean'
    if (file.scanResult === 'INFECTED' || file.status === 'QUARANTINED') return 'quarantined'
    if (this.config.scan.mode !== 'remote') return 'clean'
    if (file.scanResult !== 'PENDING') await this.db.fileObject.update({ where: { id: fileId }, data: { scanResult: 'PENDING' } })
    const dir = await mkdtemp(path.join(tmpdir(), 'lvn-scan-'))
    try {
      const original = path.join(dir, 'original')
      await this.storage.download(file.bucket, file.storageKey, original)
      let verdict
      try {
        verdict = await this.scanner().scan(original, file.mimeType, file.ownerId)
      } catch (e) {
        if (e instanceof ScanNotReadyError) throw e
        if (lastAttempt) await this.exhaust(file.id, file.ownerId, e)
        throw e instanceof ScanUnavailableError ? e : new ScanUnavailableError('scan service did not return a verdict', { userId: file.ownerId, cause: e })
      }
      if (verdict.result === 'infected' || verdict.result === 'unsafe') {
        await this.quarantine(file, verdict.signature)
        await this.scans.release(file.ownerId)
        await this.scans.forget(file.id)
        return 'quarantined'
      }
      await this.db.fileObject.update({
        where: { id: fileId },
        data: { scanResult: 'CLEAN', scannedAt: new Date(), ...(verdict.pageCount != null ? { pageCount: verdict.pageCount } : {}) },
      })
      await this.queues.queue(NOTES_MEDIA_QUEUE).add('process-file', { fileId }, { jobId: `${fileId}.process`, attempts: 3, backoff: { type: 'exponential', delay: 30_000 } })
      await this.scans.release(file.ownerId)
      await this.scans.forget(file.id)
      return 'clean'
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  }

  /**
   * Files still waiting on the scan service whose job is not queued. The worker runs this every ten minutes so an
   * outage does not leave an upload pending after the service is back. A job that already failed stays failed.
   * No-op unless SCAN_MODE=remote.
   */
  async requeuePending(): Promise<number> {
    if (this.config.scan.mode !== 'remote') return 0
    const rows = await this.db.fileObject.findMany({
      where: { status: 'READY', scanResult: 'PENDING', deletedAt: null },
      select: { id: true, ownerId: true },
      orderBy: { createdAt: 'asc' },
      take: 50,
    })
    const queue = this.queues.queue(FILE_SCAN_QUEUE)
    const busy = new Set(['active', 'waiting', 'delayed', 'prioritized', 'waiting-children', 'paused'])
    let n = 0
    for (const row of rows) {
      const existing = await queue.getJob(row.id)
      if (existing) {
        const state = await existing.getState()
        if (busy.has(state) || state === 'failed') continue
        await existing.remove()
      }
      await this.scans.release(row.ownerId)
      await this.scans.forget(row.id)
      if ((await this.scans.enqueue(row.id, row.ownerId)) === 'added') n += 1
    }
    return n
  }

  private async exhaust(fileId: string, userId: string, error: unknown): Promise<void> {
    await this.db.fileObject.updateMany({ where: { id: fileId, scanResult: 'PENDING' }, data: { scanResult: 'FAILED', scannedAt: new Date() } })
    await this.scans.deadLetter(fileId, userId, error instanceof Error ? error.message : 'scan failed')
    await this.scans.release(userId)
    await this.scans.forget(fileId)
    this.log.error(`${fileId}: scan gave up: ${error instanceof Error ? error.message : 'scan failed'}`)
  }

  private async observe(waitMs: number, scanMs: number, result: string): Promise<void> {
    scanWait.record(waitMs)
    scanDuration.record(scanMs)
    if (result === 'failed') scanFailures.add(1)
    const depth = await this.scans.counts().catch(() => null)
    this.log.log(`scan result=${result} waitMs=${waitMs} scanMs=${scanMs} waiting=${depth?.waiting ?? '?'} delayed=${depth?.delayed ?? '?'} active=${depth?.active ?? '?'} failed=${depth?.failed ?? '?'}`)
  }

  private circuitGate(): ScanCircuitGate {
    this.gate ??= new ScanCircuitGate({ pause: () => this.scans.pause(), resume: () => this.scans.resume(), isPaused: () => this.scans.paused() })
    return this.gate
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

function clientTimeout(config: NotesConfig): number {
  return config.scan.mode === 'remote' ? config.scan.timeoutMs : 180_000
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
