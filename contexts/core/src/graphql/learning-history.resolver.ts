import { UseGuards } from '@nestjs/common'
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql'
import { isTimeZone } from '@lvn/contracts/validation'
import { CurrentViewer, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { Errors, withUserErrors, type UserError } from '@lvn-backend/errors'
import { LearningEventsService } from '../application/learning-events.service'
import { LearningHistoryService } from '../application/learning-history.service'

const TOPIC = /^topic:([0-9a-f-]{36})$/i

/** Learning history (ADR-0067). Notes and topics are references the notes subgraph resolves as the viewer sees them. */
@Resolver()
@UseGuards(SignedInGuard)
export class LearningHistoryResolver {
  constructor(
    private readonly history: LearningHistoryService,
    private readonly learning: LearningEventsService,
  ) {}

  @Query('learningHistory')
  async learningHistory(@Args('before') before: string | null, @Args('days') days: number | null, @CurrentViewer() viewer: Viewer) {
    const found = await this.history.history(viewer.userId, before ?? null, days ?? undefined)
    return {
      ...found,
      days: found.days.map((d) => ({
        ...d,
        topics: d.topics.map((t) => {
          const id = TOPIC.exec(t.key)?.[1]
          return { key: t.key, seconds: t.seconds, topic: id ? { __typename: 'Topic', id } : null }
        }),
        notes: d.noteIds.map((id) => ({ __typename: 'Note', id })),
      })),
    }
  }

  @Mutation('setLearningTimeZone')
  setLearningTimeZone(@Args('input') input: { timeZone: string }, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<{ ok: boolean; userErrors: UserError[] }>(async () => {
      if (!isTimeZone(input.timeZone)) throw Errors.validation('That is not a time zone this server knows.', ['input', 'timeZone'])
      await this.learning.setTimeZone(viewer.userId, input.timeZone)
      return { ok: true }
    }, { ok: false })
  }
}
