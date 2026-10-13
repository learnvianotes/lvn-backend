import { Inject, Injectable, Logger } from '@nestjs/common'
import { CardType, DERIVATIVE_AI_TASKS, type AiTaskType } from '@lvn/contracts/domain'
import { LiveEventKind } from '@lvn/contracts/notifications'
import { AppError, Errors } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { LIVE, NOTE_AI, type Live, type NoteAi, type NoteAiSource } from '@lvn-backend/facades'
import { newId, PrismaService, type Prisma } from '@lvn-backend/prisma-base'
import { Queues } from '@lvn-backend/queue'
import { LANGUAGE_NAMES, SOURCE_CHARS, TASKS, type AiLanguage, type TaskResult } from '../domain/tasks'
import { AiGateway } from './ai-gateway'
import { MediaInput } from './media-input'

/** The `ai` context's task queue (§9.1 `ai`), run one at a time by apps/worker: one GPU serves one model. */
export const AI_TASKS_QUEUE = 'ai.tasks'

export interface RunTaskInput {
  noteId: string
  task: AiTaskType
  language?: AiLanguage | null
  cardIds?: string[] | null
}

interface Options {
  language: AiLanguage
  cardIds: string[] | null
  /** The note's words were cut at SOURCE_CHARS */
  cut?: boolean
}

type ArtifactRow = Prisma.NoteArtifactGetPayload<object>

/**
 * AI tasks on notes (ADR-0025, ADR-0059). `run` checks the right and the day's allowance and queues the task; the
 * worker's `process` reads the note again as the person, asks the gateway and stores the result beside the note. Card
 * tasks wait in their artifact until the person keeps some cards — into the note if they may edit it, else into a new
 * private note of theirs. Nothing here changes a note except `keep`, through the notes context.
 */
@Injectable()
export class AiTasksService {
  private readonly log = new Logger('AiTasks')

  constructor(
    private readonly db: PrismaService,
    private readonly gateway: AiGateway,
    private readonly queues: Queues,
    @Inject(NOTE_AI) private readonly notes: NoteAi,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(LIVE) private readonly live: Live,
    private readonly media: MediaInput,
  ) {}

  async run(viewerId: string, input: RunTaskInput): Promise<ArtifactRow> {
    const def = TASKS[input.task]
    const status = await this.gateway.status()
    if (!status.available) throw Errors.unavailable(status.reason === 'BUDGET' ? 'AI is paused until next month: this month’s AI budget is used up.' : status.reason === 'PROVIDER_DOWN' ? 'AI is not answering right now. Try again in a minute.' : 'AI is not switched on here.')
    const source = await this.allowed(viewerId, input.noteId, input.task)
    if (def.editorsOnly && !source.canEdit) throw Errors.forbidden('Quick notes are made from your own notes.')
    const cards = this.pick(source, input.cardIds ?? null, def)
    if (def.input === 'AUDIO' && cards.length !== 1) throw Errors.validation('Choose one recording or video to transcribe.', ['input', 'cardIds'])
    if (!cards.length) throw Errors.validation(def.codeOnly ? 'This note has no code to explain.' : 'This note has nothing to work on yet.', ['input', 'noteId'])
    const { usedToday, limitToday, resetsAt } = await this.gateway.allowance(viewerId)
    if (limitToday !== null && usedToday >= limitToday) throw Errors.rateLimited(Math.ceil((resetsAt.getTime() - Date.now()) / 1000), 'You have used today’s AI allowance. It renews at midnight UTC.')
    const options: Options = { language: input.language ?? 'ENGLISH', cardIds: input.cardIds?.length ? input.cardIds : null }
    const artifact = await this.db.noteArtifact.create({
      data: { id: newId(), noteId: input.noteId, versionId: source.versionId, ownerId: viewerId, task: input.task, options: options as unknown as Prisma.InputJsonValue, status: 'QUEUED' },
    })
    await this.queues.queue(AI_TASKS_QUEUE).add('run', { artifactId: artifact.id }, { jobId: artifact.id })
    return artifact
  }

  /**
   * The worker's side: one queued artifact, start to finish. Failures end in FAILED with words for the person. An
   * artifact with no requester is a public note's study aid (ADR-0061): read as anyone reads the note, as the
   * platform's work, and announced to the note's owner and its public page.
   */
  async process(artifactId: string): Promise<void> {
    const claimed = await this.db.noteArtifact.updateMany({ where: { id: artifactId, status: 'QUEUED' }, data: { status: 'RUNNING' } })
    if (!claimed.count) return
    const artifact = await this.db.noteArtifact.findUniqueOrThrow({ where: { id: artifactId } })
    const options = artifact.options as unknown as Options
    let ownerOfNote: string | null = null
    try {
      const task = artifact.task as AiTaskType
      const def = TASKS[task]
      const source = artifact.ownerId ? await this.allowed(artifact.ownerId, artifact.noteId, task) : await this.publicVersion(artifact.noteId, artifact.versionId)
      ownerOfNote = source.ownerId
      const cards = this.pick(source, options.cardIds, def)
      const isPrivate = source.visibility !== 'PUBLIC'
      let result: TaskResult
      let cut = false
      if (def.input === 'AUDIO') {
        // TRANSCRIBE: the recording, heard piece by piece (ADR-0062).
        const heard = await this.media.transcribe(fileOf(cards[0]!)!, { userId: artifact.ownerId, private: isPrivate })
        cut = heard.cut
        result = def.result(heard, source.title)
      } else {
        const words = def.input === 'IMAGES' ? cards.filter((c) => c.type !== CardType.IMAGE) : cards
        let body = words.map((c) => (c.type === CardType.CODE ? `\`\`\`${(c.content as { language?: string }).language ?? ''}\n${c.text}\n\`\`\`` : c.text)).join('\n\n')
        cut = body.length > SOURCE_CHARS
        if (cut) body = body.slice(0, SOURCE_CHARS)
        // QUICK_NOTE also sees the note's photos (ADR-0062).
        const images = def.input === 'IMAGES' ? await this.media.images(cards.filter((c) => c.type === CardType.IMAGE).map((c) => fileOf(c)!)) : undefined
        const language = LANGUAGE_NAMES[options.language] ?? 'English'
        const generated = await this.gateway.generate({
          task,
          userId: artifact.ownerId,
          private: isPrivate,
          prompt: def.prompt,
          vars: { language, target: language, sentences: 5 },
          content: { title: source.title || 'Untitled note', body: body || '(Only the photos.)' },
          schema: def.schema,
          ...(images?.length ? { images } : {}),
        })
        result = def.result(generated.output, source.title)
      }
      if ('cards' in result && !result.cards.length) throw Errors.unavailable('The AI made nothing that could be kept. Try again.')
      await this.db.noteArtifact.update({ where: { id: artifactId }, data: { status: 'READY', payload: result as unknown as Prisma.InputJsonValue, options: { ...options, cut } as unknown as Prisma.InputJsonValue } })
      if (!artifact.ownerId) await this.events.publish('NoteArtifactReady', { artifactId, noteId: artifact.noteId, versionId: artifact.versionId!, artifactType: task })
    } catch (e) {
      const message = e instanceof AppError ? e.message : 'Something went wrong. Try again.'
      if (!(e instanceof AppError)) this.log.error(`AI task ${artifactId} failed: ${(e as Error).message}`)
      await this.db.noteArtifact.update({ where: { id: artifactId }, data: { status: 'FAILED', error: message } })
    }
    // The owner's note page follows its study aids' progress (ADR-0061).
    if (!artifact.ownerId && ownerOfNote) await this.live.notify(ownerOfNote, LiveEventKind.NOTE_PROCESSING, artifact.noteId).catch(() => undefined)
  }

  /** A public note's published version, as anyone reads it; gone when it is no longer public or has a newer version. */
  private async publicVersion(noteId: string, versionId: string | null): Promise<NoteAiSource> {
    const source = await this.notes.publicSource(noteId)
    if (!source || source.versionId !== versionId) throw Errors.notFound('This note is no longer public in this version.')
    return source
  }

  /**
   * Keeps chosen cards of a card task: into the note (who may edit it), or a new private note of the person's. The
   * cards may be the person's own result, or a public note's study aid they can see (ADR-0061).
   */
  async keep(viewerId: string, input: { artifactId: string; cardIndexes: number[]; into: 'NOTE' | 'NEW_NOTE' }): Promise<string> {
    const artifact = await this.keepable(viewerId, input.artifactId)
    const payload = artifact.payload as { title?: string; cards?: { type: CardType; content: unknown }[] } | null
    if (artifact.status !== 'READY' || !payload?.cards) throw Errors.validation('There are no cards to keep here.')
    const picked = [...new Set(input.cardIndexes)].filter((i) => i >= 0 && i < payload.cards!.length).map((i) => payload.cards![i]!)
    if (!picked.length) throw Errors.validation('Choose at least one card.', ['input', 'cardIndexes'])
    let noteId: string
    if (input.into === 'NOTE') {
      if (DERIVATIVE_AI_TASKS.has(artifact.task as AiTaskType)) throw Errors.validation('New notes are kept as a note of your own.', ['input', 'into'])
      const source = await this.notes.source(viewerId, artifact.noteId)
      if (!source) throw Errors.notFound('Note not found.')
      if (!source.canEdit) throw Errors.forbidden('Only people who can edit the note add cards to it. Keep them as a note of your own.')
      await this.notes.appendCards(viewerId, artifact.noteId, picked)
      noteId = artifact.noteId
    } else {
      noteId = await this.notes.createNote(viewerId, { title: payload.title ?? 'From AI', cards: picked, copiedFrom: DERIVATIVE_AI_TASKS.has(artifact.task as AiTaskType) ? artifact.noteId : null })
    }
    // A study aid is shared: nothing of one reader's keeping is recorded on it.
    if (artifact.ownerId) await this.db.noteArtifact.update({ where: { id: artifact.id }, data: { keptAt: new Date() } })
    return noteId
  }

  /** The person's results for a note, newest first, while they can still read it. */
  async list(viewerId: string, noteId: string): Promise<ArtifactRow[]> {
    if (!(await this.notes.source(viewerId, noteId))) return []
    return this.db.noteArtifact.findMany({ where: { ownerId: viewerId, noteId }, orderBy: { createdAt: 'desc' }, take: 30 })
  }

  async get(viewerId: string, id: string): Promise<ArtifactRow | null> {
    const artifact = await this.db.noteArtifact.findFirst({ where: { id, ownerId: viewerId } })
    if (!artifact || !(await this.notes.source(viewerId, artifact.noteId))) return null
    return artifact
  }

  async remove(viewerId: string, id: string): Promise<void> {
    const { count } = await this.db.noteArtifact.deleteMany({ where: { id, ownerId: viewerId } })
    if (!count) throw Errors.notFound('Not found.')
  }

  /** The person's own result, or a study aid of a note they may read that they may see (READY; hidden ones the owner's). */
  private async keepable(viewerId: string, id: string): Promise<ArtifactRow> {
    const aid = await this.db.noteArtifact.findFirst({ where: { id, ownerId: null, status: 'READY' } })
    if (!aid) return this.mine(viewerId, id)
    const source = await this.notes.source(viewerId, aid.noteId)
    if (!source || (aid.hidden && source.ownerId !== viewerId)) throw Errors.notFound('Not found.')
    return aid
  }

  private async mine(viewerId: string, id: string): Promise<ArtifactRow> {
    const artifact = await this.get(viewerId, id)
    if (!artifact) throw Errors.notFound('Not found.')
    return artifact
  }

  /** The note as the person reads it, if they may run this task on it (ADR-0025: Ask-AI, or fork for new notes). */
  private async allowed(viewerId: string, noteId: string, task: AiTaskType): Promise<NoteAiSource> {
    const source = await this.notes.source(viewerId, noteId)
    if (!source) throw Errors.notFound('Note not found.')
    if (DERIVATIVE_AI_TASKS.has(task) ? !source.mayFork : !source.mayAskAi) throw Errors.forbidden(DERIVATIVE_AI_TASKS.has(task) ? 'The owner does not allow copies of this note.' : 'You cannot use AI on this note.')
    return source
  }

  /** The cards a task reads: code (EXPLAIN_CODE), one recording (TRANSCRIBE), words and photos (QUICK_NOTE), else words. */
  private pick(source: NoteAiSource, cardIds: string[] | null, def: (typeof TASKS)[AiTaskType]) {
    const chosen = cardIds?.length ? source.cards.filter((c) => cardIds.includes(c.id)) : source.cards
    if (def.codeOnly) return chosen.filter((c) => c.type === CardType.CODE)
    if (def.input === 'AUDIO') return chosen.filter((c) => (c.type === CardType.AUDIO || c.type === CardType.VIDEO) && !!fileOf(c))
    if (def.input === 'IMAGES') return chosen.filter((c) => c.text.trim().length > 0 || (c.type === CardType.IMAGE && !!fileOf(c)))
    return chosen.filter((c) => c.text.trim().length > 0)
  }
}

/** A media card's file. */
const fileOf = (c: { content: unknown }) => (c.content as { fileId?: string } | null)?.fileId ?? null
