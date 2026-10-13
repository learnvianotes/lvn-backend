import { UseGuards } from '@nestjs/common'
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { withUserErrors, type UserError } from '@lvn-backend/errors'
import { ExamsService } from '../application/exams.service'

type Ok = { ok: boolean; userErrors: UserError[] }
type Shaped = NonNullable<Awaited<ReturnType<ExamsService['one']>>>
/** A notes topic as a federation reference: the notes subgraph answers null for one the viewer may no longer use. */
const topicRef = (topicId: string | null) => (topicId ? { __typename: 'Topic', id: topicId } : null)
const exam = (e: Shaped) => ({ ...e, topics: e.topics.map((t) => ({ ...t, topic: topicRef(t.topicId) })) })

/** Exams, weak topics and Exam Readiness (ADR-0070). */
@Resolver()
@UseGuards(SignedInGuard)
export class ExamsResolver {
  constructor(private readonly exams: ExamsService) {}

  @Query('exams')
  async list(@CurrentViewer() viewer: Viewer) {
    return (await this.exams.list(viewer.userId)).map(exam)
  }

  @Query('exam')
  async one(@Args('id') id: string, @CurrentViewer() viewer: Viewer) {
    const found = await this.exams.one(viewer.userId, id)
    return found ? exam(found) : null
  }

  @Query('weakTopics')
  async weakTopics(@CurrentViewer() viewer: Viewer) {
    return (await this.exams.weakTopics(viewer.userId)).map((w) => ({ ...w, topic: topicRef(w.topicId) }))
  }

  @Query('examTopicOptions')
  examTopicOptions(@Args('query') query: string, @CurrentViewer() viewer: Viewer) {
    return this.exams.topicOptions(viewer.userId, query)
  }

  @Mutation('createExam')
  createExam(@Args('input') input: { name: string; date: string; topicIds: string[] }, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<{ exam: ReturnType<typeof exam> | null; userErrors: UserError[] }>(async () => {
      const id = await this.exams.create(viewer.userId, input)
      return { exam: exam((await this.exams.one(viewer.userId, id))!) }
    }, { exam: null })
  }

  @Mutation('updateExam')
  updateExam(@Args('input') input: { id: string; name?: string | null; date?: string | null; topicIds?: string[] | null }, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<{ exam: ReturnType<typeof exam> | null; userErrors: UserError[] }>(async () => {
      await this.exams.update(viewer.userId, input)
      return { exam: exam((await this.exams.one(viewer.userId, input.id))!) }
    }, { exam: null })
  }

  @Mutation('deleteExam')
  deleteExam(@Args('input') input: { id: string }, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<Ok>(async () => (await this.exams.remove(viewer.userId, input.id), { ok: true }), { ok: false })
  }
}
