import { Inject, Injectable, type OnModuleInit } from '@nestjs/common'
import type { AiTaskType } from '@lvn/contracts/domain'
import { Errors } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { NOTE_AI, PLATFORM_SETTINGS, type NoteAi, type PlatformSettings } from '@lvn-backend/facades'
import { newId, PrismaService, type Prisma } from '@lvn-backend/prisma-base'
import { Queues } from '@lvn-backend/queue'
import { AI_CONFIG, type AiConfig } from '../ai.config'
import { AiGateway } from './ai-gateway'
import { AI_TASKS_QUEUE } from './ai-tasks.service'

/** The study aids a public note gets (§10.3, ADR-0061), in the order readers see them. */
export const PIPELINE_TASKS: AiTaskType[] = ['SUMMARIZE', 'KEY_CONCEPTS', 'PRACTICE_QUESTIONS', 'QUIZ', 'FLASHCARDS']

type ArtifactRow = Prisma.NoteArtifactGetPayload<object>
const order = (a: ArtifactRow, b: ArtifactRow) => PIPELINE_TASKS.indexOf(a.task as AiTaskType) - PIPELINE_TASKS.indexOf(b.task as AiTaskType)

/**
 * The public-note pipeline (§10.3, ADR-0061): a PUBLIC publish that passed moderation queues one AI task per study aid
 * for that version, with no requester (the platform's work), on the AI tasks' lane; AiTasksService runs them from the
 * published words. A new version replaces the aids, keeping what the owner hid. Readers see the READY, unhidden aids
 * while they may read the note; the owner sees every step and hides what they do not want.
 */
@Injectable()
export class PublicPipeline implements OnModuleInit {
  constructor(
    private readonly db: PrismaService,
    private readonly gateway: AiGateway,
    private readonly queues: Queues,
    @Inject(AI_CONFIG) private readonly config: AiConfig,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(NOTE_AI) private readonly notes: NoteAi,
    @Inject(PLATFORM_SETTINGS) private readonly settings: PlatformSettings,
  ) {}

  onModuleInit(): void {
    this.events.subscribe('NotePublished', (e) => (e.payload.visibility === 'PUBLIC' ? this.start(e.payload.noteId, e.payload.versionId).then(() => undefined) : undefined))
  }

  /** Queues the version's aids, once; the number queued. Nothing with AI off or the pipeline switched off. */
  async start(noteId: string, versionId: string): Promise<number> {
    if (!this.settings.boolean('ai_public_pipeline', this.config.publicPipeline) || !(await this.gateway.status()).available) return 0
    const queued = await this.db.$transaction(async (tx) => {
      // One start per note at a time: a publish and a change to PUBLIC may announce the same version together.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pipeline:${noteId}`}))`
      const previous = await tx.noteArtifact.findMany({ where: { noteId, ownerId: null }, select: { versionId: true, task: true, hidden: true } })
      if (previous.some((p) => p.versionId === versionId)) return []
      const hidden = new Set(previous.filter((p) => p.hidden).map((p) => p.task))
      await tx.noteArtifact.deleteMany({ where: { noteId, ownerId: null } })
      const rows = PIPELINE_TASKS.map((task) => ({ id: newId(), noteId, versionId, ownerId: null, task, options: { language: 'ENGLISH', cardIds: null }, status: 'QUEUED' as const, hidden: hidden.has(task) }))
      await tx.noteArtifact.createMany({ data: rows })
      return rows.map((r) => r.id)
    })
    for (const id of queued) await this.queues.queue(AI_TASKS_QUEUE).add('run', { artifactId: id }, { jobId: id })
    return queued.length
  }

  /** The aids `viewerId` (null: not signed in) may see on a note: the owner every step, readers the READY unhidden ones. */
  async insights(viewerId: string | null, noteId: string): Promise<ArtifactRow[]> {
    const source = viewerId ? await this.notes.source(viewerId, noteId) : await this.notes.publicSource(noteId)
    if (!source) return []
    const owner = source.ownerId === viewerId
    const rows = await this.db.noteArtifact.findMany({ where: { noteId, ownerId: null, ...(owner ? {} : { status: 'READY', hidden: false }) } })
    return rows.sort(order)
  }

  /** The owner's view of the aids' progress for the current version; null for anyone else, or before any. */
  async status(viewerId: string | null, noteId: string): Promise<{ versionId: string; steps: { task: string; status: string }[]; done: boolean } | null> {
    if (!viewerId) return null
    const source = await this.notes.source(viewerId, noteId)
    if (!source || source.ownerId !== viewerId) return null
    const rows = (await this.db.noteArtifact.findMany({ where: { noteId, ownerId: null } })).sort(order)
    if (!rows.length) return null
    return { versionId: rows[0]!.versionId!, steps: rows.map((r) => ({ task: r.task, status: r.status })), done: rows.every((r) => r.status === 'READY' || r.status === 'FAILED') }
  }

  async setHidden(viewerId: string, id: string, hidden: boolean): Promise<void> {
    const artifact = await this.db.noteArtifact.findFirst({ where: { id, ownerId: null } })
    const source = artifact ? await this.notes.source(viewerId, artifact.noteId) : null
    if (!artifact || !source || source.ownerId !== viewerId) throw Errors.notFound('Not found.')
    await this.db.noteArtifact.update({ where: { id }, data: { hidden } })
  }
}
