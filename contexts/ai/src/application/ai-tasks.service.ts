import { Inject, Injectable, Logger } from '@nestjs/common'
import { CardType, DERIVATIVE_AI_TASKS, type AiTaskType } from '@lvn/contracts/domain'
import { AppError, Errors } from '@lvn-backend/errors'
import { NOTE_AI, type NoteAi, type NoteAiSource } from '@lvn-backend/facades'
import { newId, PrismaService, type Prisma } from '@lvn-backend/prisma-base'
import { Queues } from '@lvn-backend/queue'
import { LANGUAGE_NAMES, SOURCE_CHARS, TASKS, type AiLanguage, type TaskResult } from '../domain/tasks'
import { AiGateway } from './ai-gateway'

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
  ) {}

  async run(viewerId: string, input: RunTaskInput): Promise<ArtifactRow> {
    const def = TASKS[input.task]
    const status = await this.gateway.status()
    if (!status.available) throw Errors.unavailable(status.reason === 'BUDGET' ? 'AI is paused until next month: this month’s AI budget is used up.' : status.reason === 'PROVIDER_DOWN' ? 'AI is not answering right now. Try again in a minute.' : 'AI is not switched on here.')
    const source = await this.allowed(viewerId, input.noteId, input.task)
    const cards = this.pick(source, input.cardIds ?? null, !!def.codeOnly)
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

  /** The worker's side: one queued artifact, start to finish. Failures end in FAILED with words for the person. */
  async process(artifactId: string): Promise<void> {
    const claimed = await this.db.noteArtifact.updateMany({ where: { id: artifactId, status: 'QUEUED' }, data: { status: 'RUNNING' } })
    if (!claimed.count) return
    const artifact = await this.db.noteArtifact.findUniqueOrThrow({ where: { id: artifactId } })
    const options = artifact.options as unknown as Options
    try {
      const task = artifact.task as AiTaskType
      const def = TASKS[task]
      const source = await this.allowed(artifact.ownerId!, artifact.noteId, task)
      const cards = this.pick(source, options.cardIds, !!def.codeOnly)
      let body = cards.map((c) => (c.type === CardType.CODE ? `\`\`\`${(c.content as { language?: string }).language ?? ''}\n${c.text}\n\`\`\`` : c.text)).join('\n\n')
      const cut = body.length > SOURCE_CHARS
      if (cut) body = body.slice(0, SOURCE_CHARS)
      const language = LANGUAGE_NAMES[options.language] ?? 'English'
      const generated = await this.gateway.generate({
        task,
        userId: artifact.ownerId,
        private: source.visibility !== 'PUBLIC',
        prompt: def.prompt,
        vars: { language, target: language, sentences: 5 },
        content: { title: source.title || 'Untitled note', body },
        schema: def.schema,
      })
      const result: TaskResult = def.result(generated.output, source.title)
      if ('cards' in result && !result.cards.length) throw Errors.unavailable('The AI made nothing that could be kept. Try again.')
      await this.db.noteArtifact.update({ where: { id: artifactId }, data: { status: 'READY', payload: result as unknown as Prisma.InputJsonValue, options: { ...options, cut } as unknown as Prisma.InputJsonValue } })
    } catch (e) {
      const message = e instanceof AppError ? e.message : 'Something went wrong. Try again.'
      if (!(e instanceof AppError)) this.log.error(`AI task ${artifactId} failed: ${(e as Error).message}`)
      await this.db.noteArtifact.update({ where: { id: artifactId }, data: { status: 'FAILED', error: message } })
    }
  }

  /** Keeps chosen cards of a card task: into the note (who may edit it), or a new private note of the person's. */
  async keep(viewerId: string, input: { artifactId: string; cardIndexes: number[]; into: 'NOTE' | 'NEW_NOTE' }): Promise<string> {
    const artifact = await this.mine(viewerId, input.artifactId)
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
    await this.db.noteArtifact.update({ where: { id: artifact.id }, data: { keptAt: new Date() } })
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

  private pick(source: NoteAiSource, cardIds: string[] | null, codeOnly: boolean) {
    const chosen = cardIds?.length ? source.cards.filter((c) => cardIds.includes(c.id)) : source.cards
    return chosen.filter((c) => (codeOnly ? c.type === CardType.CODE : c.text.trim().length > 0))
  }
}
