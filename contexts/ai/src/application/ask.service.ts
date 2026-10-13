import { Inject, Injectable, Logger } from '@nestjs/common'
import { AskAiScope, LearningEventType } from '@lvn/contracts/domain'
import { LiveEventKind } from '@lvn/contracts/notifications'
import { AppError, Errors } from '@lvn-backend/errors'
import { DOUBTS, LEARNING, LIVE, NOTE_AI, NOTE_RETRIEVAL, type Doubts, type Learning, type Live, type NoteAi, type NoteRetrieval, type RetrievalScope } from '@lvn-backend/facades'
import { newId, PrismaService, type Prisma } from '@lvn-backend/prisma-base'
import { Queues } from '@lvn-backend/queue'
import { ASK_CANDIDATES, citedSources, passagesOf, QUESTION_CHARS, rerank, sourcesBlock, type AnswerSource, type Passage } from '../domain/ask'
import { AiGateway } from './ai-gateway'
import { AI_TASKS_QUEUE } from './ai-tasks.service'

type AnswerRow = Prisma.AiAnswerGetPayload<object>

/** How often a growing answer is written and announced */
const FLUSH_MS = 400
const EMBEDDING_DIMENSIONS = 768

const NOTHING: Record<AskAiScope, string> = {
  THIS_NOTE: 'This note does not have anything to answer that with yet.',
  MY_NOTES: 'I could not find this in your notes. Ask AI reads the notes you have published: publish a note to include it.',
  MY_PLACES: 'I could not find this in the notes shared with your groups and classes.',
  PUBLIC: 'I could not find this in the public notes.',
  WORKSPACE: 'I could not find this in the notes shared with this workspace.',
}

/**
 * Ask AI (§10.2, ADR-0060). `ask` checks the scope's right and the day's allowance and queues the question on the GPU's
 * one lane; the worker's `process` finds the passages the asker may read — one note as they read it, or the nearest
 * chunks through NOTE_RETRIEVAL, which applies the read rule in Postgres — reranks them, and streams the model's answer
 * into the row, telling the asker's sockets as it grows. An answer's sources are the passages it cites.
 */
@Injectable()
export class AskService {
  private readonly log = new Logger('AskAi')

  constructor(
    private readonly db: PrismaService,
    private readonly gateway: AiGateway,
    private readonly queues: Queues,
    @Inject(NOTE_AI) private readonly notes: NoteAi,
    @Inject(NOTE_RETRIEVAL) private readonly retrieval: NoteRetrieval,
    @Inject(DOUBTS) private readonly doubts: Doubts,
    @Inject(LIVE) private readonly live: Live,
    @Inject(LEARNING) private readonly learning: Learning,
  ) {}

  async ask(viewerId: string, input: { question: string; scope: AskAiScope; noteId?: string | null }): Promise<AnswerRow> {
    const question = this.question(input.question)
    if (input.scope === AskAiScope.WORKSPACE) throw Errors.validation('Ask about a workspace from one of its doubts.', ['input', 'scope'])
    await this.ready(viewerId)
    let noteId: string | null = null
    if (input.scope === AskAiScope.THIS_NOTE) {
      if (!input.noteId) throw Errors.validation('Which note?', ['input', 'noteId'])
      const source = await this.notes.source(viewerId, input.noteId)
      if (!source?.mayAskAi) throw Errors.notFound('Note not found.')
      noteId = input.noteId
    }
    const answer = await this.queue({ askerId: viewerId, question, scope: input.scope, noteId })
    await this.learning.record(viewerId, { type: LearningEventType.AI_REQUESTED, entityType: 'AI_ANSWER', entityId: answer.id, metadata: { task: 'ASK', scope: input.scope } })
    return answer
  }

  /** Ask AI on a workspace doubt (ADR-0015): the doubt and its thread as the question, over the workspace's notes. */
  async askAboutDoubt(viewerId: string, doubtId: string): Promise<AnswerRow> {
    await this.ready(viewerId)
    const doubt = await this.doubts.forAi(viewerId, doubtId)
    if (!doubt) throw Errors.notFound('Doubt not found.')
    const question = `${doubt.title}\n\n${doubt.text}`.trim().slice(0, QUESTION_CHARS * 2)
    const answer = await this.queue({ askerId: viewerId, question, scope: AskAiScope.WORKSPACE, groupId: doubt.groupId, doubtId })
    await this.learning.record(viewerId, { type: LearningEventType.AI_REQUESTED, entityType: 'AI_ANSWER', entityId: answer.id, metadata: { task: 'ASK', scope: AskAiScope.WORKSPACE } })
    return answer
  }

  /** The worker's side: one queued question, start to finish. Failures end in FAILED with words for the asker. */
  async process(answerId: string): Promise<void> {
    const claimed = await this.db.aiAnswer.updateMany({ where: { id: answerId, status: 'QUEUED' }, data: { status: 'RUNNING' } })
    if (!claimed.count) return
    const row = await this.db.aiAnswer.findUniqueOrThrow({ where: { id: answerId } })
    try {
      const passages = await this.passages(row)
      if (!passages.length) {
        await this.finish(row, { status: 'READY', text: NOTHING[row.scope as AskAiScope], sources: [] })
        return
      }
      let text = ''
      let flushedAt = 0
      let writing: Promise<unknown> = Promise.resolve()
      const flush = () => {
        flushedAt = Date.now()
        const snapshot = text
        writing = writing
          .then(async () => {
            await this.db.aiAnswer.updateMany({ where: { id: row.id, status: 'RUNNING' }, data: { text: snapshot } })
            await this.live.notify(row.askerId, LiveEventKind.AI_ANSWER, row.id)
          })
          .catch(() => undefined)
      }
      const generated = await this.gateway.generate({
        task: 'ASK',
        userId: row.askerId,
        private: passages.some((p) => !p.public),
        prompt: 'ask',
        content: { question: row.question, sources: sourcesBlock(passages) },
        temperature: 0.2,
        onDelta: (delta) => {
          text += delta
          if (Date.now() - flushedAt >= FLUSH_MS) flush()
        },
      })
      await writing
      const answer = (generated.output || text).trim()
      await this.finish(row, { status: 'READY', text: answer, sources: citedSources(answer, passages) })
    } catch (e) {
      const message = e instanceof AppError ? e.message : 'Something went wrong. Try again.'
      if (!(e instanceof AppError)) this.log.error(`Ask AI ${answerId} failed: ${(e as Error).message}`)
      await this.finish(row, { status: 'FAILED', error: message })
    }
  }

  async get(viewerId: string, id: string): Promise<AnswerRow | null> {
    const answer = await this.db.aiAnswer.findFirst({ where: { id, askerId: viewerId } })
    if (!answer) return null
    // About one note: shown only while the asker can still read it (ADR-0059's rule for results beside a note).
    if (answer.noteId && !(await this.notes.source(viewerId, answer.noteId))) return null
    return answer
  }

  /** The asker's recent answers, newest first: about one note, one doubt, or everything. */
  async list(viewerId: string, filter: { noteId?: string | null; doubtId?: string | null; first?: number | null }): Promise<AnswerRow[]> {
    if (filter.noteId && !(await this.notes.source(viewerId, filter.noteId))) return []
    if (filter.doubtId && !(await this.doubts.forAi(viewerId, filter.doubtId))) return []
    return this.db.aiAnswer.findMany({
      where: { askerId: viewerId, ...(filter.noteId ? { noteId: filter.noteId } : {}), ...(filter.doubtId ? { doubtId: filter.doubtId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(filter.first ?? 20, 1), 50),
    })
  }

  async remove(viewerId: string, id: string): Promise<void> {
    const { count } = await this.db.aiAnswer.deleteMany({ where: { id, askerId: viewerId } })
    if (!count) throw Errors.notFound('Not found.')
  }

  private question(text: string): string {
    const question = text.trim()
    if (question.length < 3) throw Errors.validation('Ask a question.', ['input', 'question'])
    if (question.length > QUESTION_CHARS) throw Errors.validation(`Keep the question under ${QUESTION_CHARS} characters.`, ['input', 'question'])
    return question
  }

  private async ready(viewerId: string): Promise<void> {
    const status = await this.gateway.status()
    if (!status.available) throw Errors.unavailable(status.reason === 'BUDGET' ? 'AI is paused until next month: this month’s AI budget is used up.' : status.reason === 'PROVIDER_DOWN' ? 'AI is not answering right now. Try again in a minute.' : 'AI is not switched on here.')
    const { usedToday, limitToday, resetsAt } = await this.gateway.allowance(viewerId)
    if (limitToday !== null && usedToday >= limitToday) throw Errors.rateLimited(Math.ceil((resetsAt.getTime() - Date.now()) / 1000), 'You have used today’s AI allowance. It renews at midnight UTC.')
  }

  private async queue(data: { askerId: string; question: string; scope: AskAiScope; noteId?: string | null; groupId?: string | null; doubtId?: string | null }): Promise<AnswerRow> {
    const answer = await this.db.aiAnswer.create({ data: { id: newId(), status: 'QUEUED', ...data } })
    await this.queues.queue(AI_TASKS_QUEUE).add('ask', { answerId: answer.id }, { jobId: answer.id })
    return answer
  }

  /** What the asker may read that bears on the question, best first. */
  private async passages(row: AnswerRow): Promise<Passage[]> {
    if (row.scope === AskAiScope.THIS_NOTE) {
      const source = await this.notes.source(row.askerId, row.noteId!)
      if (!source?.mayAskAi) throw Errors.notFound('Note not found.')
      const passages = passagesOf(source.cards.map((c) => ({ id: c.id, text: c.text }))).map((p) => ({ ...p, noteId: source.noteId, versionId: source.versionId, title: source.title, public: source.visibility === 'PUBLIC' }))
      // Kept in the note's order, so the answer reads it front to back.
      const best = new Set(rerank(row.question, passages, undefined, Infinity))
      return passages.filter((p) => best.has(p))
    }
    const [vector] = await this.gateway.embed([row.question], { userId: row.askerId, private: false, task: 'EMBED_QUERY' })
    if (!vector || vector.length !== EMBEDDING_DIMENSIONS) throw Errors.unavailable('AI cannot search the notes right now.')
    const scope: RetrievalScope = row.scope === AskAiScope.WORKSPACE ? { kind: 'WORKSPACE', groupId: row.groupId! } : { kind: row.scope as 'MY_NOTES' | 'MY_PLACES' | 'PUBLIC' }
    const found = await this.retrieval.nearest(row.askerId, vector, scope, ASK_CANDIDATES)
    return rerank(
      row.question,
      found.map((c) => ({ noteId: c.noteId, versionId: c.versionId, title: c.title, public: c.visibility === 'PUBLIC', cardIds: c.cardIds, text: c.text, similarity: c.similarity })),
    )
  }

  private async finish(row: AnswerRow, data: { status: 'READY' | 'FAILED'; text?: string; sources?: AnswerSource[]; error?: string }): Promise<void> {
    await this.db.aiAnswer.update({ where: { id: row.id }, data: { status: data.status, ...(data.text !== undefined ? { text: data.text } : {}), ...(data.sources ? { sources: data.sources as unknown as Prisma.InputJsonValue } : {}), error: data.error ?? null } })
    await this.live.notify(row.askerId, LiveEventKind.AI_ANSWER, row.id).catch(() => undefined)
  }
}
