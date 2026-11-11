import { Inject, Injectable, Logger } from '@nestjs/common'
import { CardType, DERIVATIVE_AI_TASKS, LearningEventType, LimitKey, type AiTaskType } from '@lvn/contracts/domain'
import { LiveEventKind } from '@lvn/contracts/notifications'
import { AppError, Errors, planLimitError } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { LEARNING, LIVE, NOTE_AI, type Learning, type Live, type NoteAi, type NoteAiSource } from '@lvn-backend/facades'
import { newId, PrismaService, type Prisma } from '@lvn-backend/prisma-base'
import { Queues } from '@lvn-backend/queue'
import { batches, batchText, isRepair, type TextChange } from '../domain/clean-up'
import { LANGUAGE_NAMES, repairs, SOURCE_CHARS, TASKS, type AiLanguage, type TaskResult } from '../domain/tasks'
import { MIN_SCRIPT_SHARE, pieces, scriptShare } from '../domain/translate'
import { AiGateway } from './ai-gateway'
import { MediaInput } from './media-input'
import { fileOf, isRecording, MEDIA, NoteMaterial } from './note-material'

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
  /** The photos and PDFs it read (by file), so that once kept into the note they are not read again (ADR-0085) */
  read?: string[]
  /** Cards were kept into the note itself, not a new note */
  keptInNote?: boolean
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
    private readonly material: NoteMaterial,
    @Inject(LEARNING) private readonly learning: Learning,
  ) {}

  async run(viewerId: string, input: RunTaskInput): Promise<ArtifactRow> {
    const def = TASKS[input.task]
    const status = await this.gateway.status()
    if (!status.available) throw Errors.unavailable(status.reason === 'BUDGET' ? 'AI is paused until next month: this month’s AI budget is used up.' : status.reason === 'PROVIDER_DOWN' ? 'AI is not answering right now. Try again in a minute.' : 'AI is not switched on here.')
    const source = await this.allowed(viewerId, input.noteId, input.task)
    if (def.editorsOnly && !source.canEdit) throw Errors.forbidden(def.kind === 'CHANGES' ? 'Only people who can edit the note clean it up.' : 'Quick notes are made from your own notes.')
    const cards = this.pick(source, input.cardIds ?? null, def)
    if (def.input === 'AUDIO' && cards.length !== 1) throw Errors.validation('Choose one recording or video to transcribe.', ['input', 'cardIds'])
    if (!cards.length) throw Errors.validation(def.codeOnly ? 'This note has no code to explain.' : def.kind === 'CHANGES' ? 'This note has no text to clean up.' : 'This note has nothing to work on yet: write something, or add photos, PDFs or a recording.', ['input', 'noteId'])
    // A note of only recordings is read from their transcripts (ADR-0085): one must be made first.
    if (def.input !== 'AUDIO' && cards.every(isRecording) && !(await this.material.transcripts(input.noteId, viewerId, cards)).size) throw Errors.validation('Transcribe the recording first: AI tasks work on what it says.', ['input', 'noteId'])
    await this.gateway.assertDailyRequests(viewerId)
    const { usedToday, limitToday } = await this.gateway.allowance(viewerId)
    if (limitToday !== null && usedToday >= limitToday) throw planLimitError(LimitKey.AI_TOKENS_DAILY)
    await this.gateway.ensureRoutable(viewerId, def.input === 'AUDIO' ? 'TRANSCRIBE' : input.task, source.visibility !== 'PUBLIC')
    const options: Options = { language: input.language ?? 'ENGLISH', cardIds: input.cardIds?.length ? input.cardIds : null }
    const artifact = await this.db.noteArtifact.create({
      data: { id: newId(), noteId: input.noteId, versionId: source.versionId, ownerId: viewerId, task: input.task, options: options as unknown as Prisma.InputJsonValue, status: 'QUEUED' },
    })
    await this.queues.queue(AI_TASKS_QUEUE).add('run', { artifactId: artifact.id }, { jobId: artifact.id })
    await this.learning.record(viewerId, { type: LearningEventType.AI_REQUESTED, entityType: 'NOTE', entityId: input.noteId, metadata: { task: input.task } })
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
      if (def.editorsOnly && !source.canEdit) throw Errors.forbidden('You can no longer edit this note.')
      const cards = this.pick(source, options.cardIds, def)
      const isPrivate = source.visibility !== 'PUBLIC'
      const subjectId = artifact.ownerId ?? source.ownerId
      const reader = { noteId: artifact.noteId, ownerId: artifact.ownerId, private: isPrivate, subjectId }
      let result: TaskResult
      let cut = false
      let read: string[] = []
      if (def.input === 'AUDIO') {
        // TRANSCRIBE: the recording, heard piece by piece (ADR-0062).
        const heard = await this.media.transcribe(fileOf(cards[0]!)!, { userId: artifact.ownerId, private: isPrivate, subjectId })
        cut = heard.cut
        result = def.result(heard, source.title)
      } else if (task === 'TRANSLATE') {
        // In plain text, piece by piece, each checked to be in the language (ADR-0086).
        // The words alone: "Photo 1:" is not part of the note to translate.
        const material = await this.material.forTask(cards, { ...reader, attach: false, labels: false })
        read = material.read
        let body = material.parts.join('\n\n')
        if (!body.trim()) throw Errors.validation('Nothing in this note’s photos, PDFs or recordings could be read. A scanned PDF becomes notes with Convert PDF.')
        cut = body.length > SOURCE_CHARS
        if (cut) body = body.slice(0, SOURCE_CHARS)
        result = def.result(await this.translate(source.title, body, options.language, { userId: artifact.ownerId, private: isPrivate, subjectId }), source.title)
      } else if (def.kind === 'CHANGES') {
        // CLEAN_UP: the note's words, batch by batch, as the person's work (ADR-0063).
        const mended = await this.cleanUp(task, artifact.ownerId!, cards, isPrivate, subjectId)
        cut = mended.cut
        result = def.result({ changes: mended.changes }, source.title)
      } else {
        // The note's words, what its photos say, its PDFs' words and its recordings' transcripts (ADR-0084, ADR-0085).
        const material = await this.material.forTask(cards, { ...reader, attach: def.input === 'IMAGES' })
        read = material.read
        let body = material.parts.join('\n\n')
        if (!body.trim() && !material.images.length) throw Errors.validation('Nothing in this note’s photos, PDFs or recordings could be read. A scanned PDF becomes notes with Convert PDF.')
        cut = body.length > SOURCE_CHARS
        if (cut) body = body.slice(0, SOURCE_CHARS)
        const images = material.images
        const language = LANGUAGE_NAMES[options.language] ?? 'English'
        const generated = await this.gateway.generate({
          task,
          userId: artifact.ownerId,
          subjectId,
          private: isPrivate,
          prompt: def.prompt,
          vars: { language, target: language, sentences: 5 },
          content: { title: source.title || 'Untitled note', body: body || '(Only the photos.)' },
          schema: def.schema,
          ...(images.length ? { images } : {}),
        })
        result = def.result(generated.output, source.title)
      }
      if ('cards' in result && !result.cards.length) throw Errors.unavailable('The AI made nothing that could be kept. Try again.')
      await this.db.noteArtifact.update({ where: { id: artifactId }, data: { status: 'READY', payload: result as unknown as Prisma.InputJsonValue, options: { ...options, cut, ...(read.length ? { read } : {}) } as unknown as Prisma.InputJsonValue } })
      if (!artifact.ownerId) await this.events.publish('NoteArtifactReady', { artifactId, noteId: artifact.noteId, versionId: artifact.versionId!, artifactType: task })
    } catch (e) {
      const message = e instanceof AppError ? e.message : 'Something went wrong. Try again.'
      if (!(e instanceof AppError)) this.log.error(`AI task ${artifactId} failed: ${(e as Error).message}`)
      await this.db.noteArtifact.update({ where: { id: artifactId }, data: { status: 'FAILED', error: message } })
    }
    // The owner's note page follows its study aids' progress (ADR-0061).
    if (!artifact.ownerId && ownerOfNote) await this.live.notify(ownerOfNote, LiveEventKind.NOTE_PROCESSING, artifact.noteId).catch(() => undefined)
  }

  /**
   * A note translated (ADR-0086): its pieces of at most TRANSLATE_PIECE_CHARS in order, each in plain text at a low
   * temperature; a piece whose letters are not mostly in the language's script is asked again once, insisting, and the
   * answer more in the language is kept. The first piece carries the title, answered as its first line ("# Title").
   */
  private async translate(title: string, body: string, language: AiLanguage, who: { userId: string | null; private: boolean; subjectId: string | null }): Promise<string> {
    const target = LANGUAGE_NAMES[language] ?? 'English'
    const out: string[] = []
    for (const [i, piece] of pieces(body).entries()) {
      const ask = async (insist: string) =>
        (
          await this.gateway.generate({
            task: 'TRANSLATE',
            userId: who.userId,
            subjectId: who.subjectId,
            private: who.private,
            prompt: i === 0 ? 'translate' : 'translate-more',
            vars: { target, insist },
            content: i === 0 ? { title: title || 'Untitled note', body: piece } : { body: piece },
            temperature: 0.2,
          })
        ).output.replace(/<\/?content>/g, '').trim()
      let text = await ask('')
      const share = scriptShare(text, language)
      if (share !== null && share < MIN_SCRIPT_SHARE && (scriptShare(piece, language) ?? 0) < MIN_SCRIPT_SHARE) {
        const again = await ask(`\nYour last answer left much of it untranslated. Translate every sentence, heading and list item into ${target}.`)
        if ((scriptShare(again, language) ?? 0) > share) text = again
      }
      out.push(text)
    }
    return out.join('\n\n')
  }

  /**
   * The changes the model proposes for the cards' words, checked one by one (`isRepair`). Batches run in order; when the
   * allowance or the model gives out after the first, what was found so far is kept and the rest counts as cut.
   */
  private async cleanUp(task: AiTaskType, userId: string, cards: NoteAiSource['cards'], isPrivate: boolean, subjectId: string | null): Promise<{ changes: TextChange[]; cut: boolean }> {
    const plan = batches(cards)
    const changes: TextChange[] = []
    for (const [i, batch] of plan.batches.entries()) {
      try {
        const generated = await this.gateway.generate({ task, userId, subjectId, private: isPrivate, prompt: 'clean-up', content: { passages: batchText(batch) }, schema: repairs, temperature: 0 })
        for (const { n, text } of generated.output.changes) {
          const card = batch[n - 1]
          if (card && !changes.some((c) => c.cardId === card.id) && isRepair(card.text, text)) changes.push({ cardId: card.id, before: card.text, after: text.trim() })
        }
      } catch (e) {
        if (i === 0) throw e
        return { changes, cut: true }
      }
    }
    return { changes, cut: plan.cut }
  }

  /**
   * Applies chosen changes of the person's CLEAN_UP result to the note, through the notes context (ADR-0063). A card
   * edited since the change was proposed is left as it is. Returns the cards changed.
   */
  async apply(viewerId: string, input: { artifactId: string; cardIds: string[] }): Promise<string[]> {
    const artifact = await this.mine(viewerId, input.artifactId)
    const payload = artifact.payload as { changes?: TextChange[]; applied?: string[] } | null
    if (artifact.status !== 'READY' || !payload?.changes) throw Errors.validation('There are no changes to apply here.')
    const picked = payload.changes.filter((c) => input.cardIds.includes(c.cardId))
    if (!picked.length) throw Errors.validation('Choose at least one change.', ['input', 'cardIds'])
    const applied = await this.notes.rewriteText(viewerId, artifact.noteId, picked.map((c) => ({ cardId: c.cardId, before: c.before, text: c.after })))
    const all = [...new Set([...(payload.applied ?? []), ...applied])]
    await this.db.noteArtifact.update({ where: { id: artifact.id }, data: { payload: { ...payload, applied: all } as unknown as Prisma.InputJsonValue, ...(applied.length ? { keptAt: new Date() } : {}) } })
    return applied
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
    if (artifact.ownerId) await this.db.noteArtifact.update({ where: { id: artifact.id }, data: { keptAt: new Date(), ...(input.into === 'NOTE' ? { options: { ...(artifact.options as object), keptInNote: true } as Prisma.InputJsonValue } : {}) } })
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
    if (DERIVATIVE_AI_TASKS.has(task)) {
      if (!source.mayFork) throw Errors.forbidden('The owner does not allow copies of this note.')
      if (!source.mayBulkAi) throw Errors.forbidden('Verify your account before AI writes notes for you.')
    } else if (!source.mayAskAi) throw Errors.forbidden('You cannot use AI on this note.')
    return source
  }

  /**
   * The cards a task reads: code (EXPLAIN_CODE), one recording (TRANSCRIBE), text, heading and quote cards (CLEAN_UP),
   * else words with the photos, PDFs and recordings (ADR-0085).
   */
  private pick(source: NoteAiSource, cardIds: string[] | null, def: (typeof TASKS)[AiTaskType]) {
    const chosen = cardIds?.length ? source.cards.filter((c) => cardIds.includes(c.id)) : source.cards
    if (def.codeOnly) return chosen.filter((c) => c.type === CardType.CODE)
    if (def.kind === 'CHANGES') return chosen.filter((c) => MENDABLE.has(c.type) && c.text.trim().length > 0)
    if (def.input === 'AUDIO') return chosen.filter((c) => (c.type === CardType.AUDIO || c.type === CardType.VIDEO) && !!fileOf(c))
    return chosen.filter((c) => (MEDIA.has(c.type) ? !!fileOf(c) : c.text.trim().length > 0))
  }
}

/** The cards whose words clean-up mends (ADR-0063), as the notes context rewrites them. */
const MENDABLE: ReadonlySet<string> = new Set([CardType.TEXT, CardType.HEADING, CardType.QUOTE])
