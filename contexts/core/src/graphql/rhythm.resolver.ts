import { UseGuards } from '@nestjs/common'
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { withUserErrors, type UserError } from '@lvn-backend/errors'
import { RhythmService, type PauseReason } from '../application/rhythm.service'

type Ok = { ok: boolean; userErrors: UserError[] }

/** Rhythm (ADR-0069). */
@Resolver()
@UseGuards(SignedInGuard)
export class RhythmResolver {
  constructor(private readonly rhythm: RhythmService) {}

  @Query('rhythm')
  rhythmOf(@CurrentViewer() viewer: Viewer) {
    return this.rhythm.rhythm(viewer.userId)
  }

  @Mutation('setRhythmPlan')
  setRhythmPlan(@Args('input') input: { plannedDays: number[] }, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<Ok>(async () => (await this.rhythm.setPlan(viewer.userId, input.plannedDays), { ok: true }), { ok: false })
  }

  @Mutation('pauseRhythm')
  pauseRhythm(@Args('input') input: { from: string; to: string; reason: PauseReason }, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<Ok>(async () => (await this.rhythm.pause(viewer.userId, input), { ok: true }), { ok: false })
  }

  @Mutation('endRhythmPause')
  endRhythmPause(@Args('input') input: { id: string }, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<Ok>(async () => (await this.rhythm.endPause(viewer.userId, input.id), { ok: true }), { ok: false })
  }
}
