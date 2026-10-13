import { UseGuards } from '@nestjs/common'
import { Args, Mutation, Resolver } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { withUserErrors, type UserError } from '@lvn-backend/errors'
import { LearningEventsService, type TrackResult } from '../application/learning-events.service'

/** `trackEvents` (ADR-0067). */
@Resolver()
@UseGuards(SignedInGuard)
export class LearningResolver {
  constructor(private readonly learning: LearningEventsService) {}

  @Mutation('trackEvents')
  trackEvents(@Args('input') input: { events: unknown[]; timeZone?: string | null }, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<TrackResult & { userErrors: UserError[] }>(() => this.learning.track(viewer.userId, input), { accepted: 0, duplicates: 0, rejected: [] })
  }
}
