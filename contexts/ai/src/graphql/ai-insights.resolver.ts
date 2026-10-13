import { UseGuards } from '@nestjs/common'
import { Args, Mutation, Parent, ResolveField, Resolver } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { withUserErrors, type UserError } from '@lvn-backend/errors'
import type { Prisma } from '@lvn-backend/prisma-base'
import { PublicPipeline } from '../application/public-pipeline'

type ArtifactRow = Prisma.NoteArtifactGetPayload<object>

/** A study aid as GraphQL shows it: its payload spread into `markdown` or `title` and `cards` once READY. */
const toInsight = (a: ArtifactRow) => {
  const payload = (a.status === 'READY' ? a.payload : null) as { markdown?: string; title?: string; cards?: unknown[] } | null
  return { id: a.id, task: a.task, status: a.status, markdown: payload?.markdown ?? null, title: payload?.title ?? null, cards: payload?.cards ?? null, hidden: a.hidden, versionId: a.versionId }
}

/** ai's part of the notes subgraph's Note: a public note's study aids and their progress (ADR-0061). */
@Resolver('Note')
export class NoteInsightsResolver {
  constructor(private readonly pipeline: PublicPipeline) {}

  @ResolveField('aiInsights')
  async aiInsights(@Parent() note: { id: string }, @CurrentViewer() viewer: Viewer | null) {
    return (await this.pipeline.insights(viewer?.userId ?? null, note.id)).map(toInsight)
  }

  @ResolveField('noteProcessingStatus')
  noteProcessingStatus(@Parent() note: { id: string }, @CurrentViewer() viewer: Viewer | null) {
    return this.pipeline.status(viewer?.userId ?? null, note.id)
  }
}

@Resolver()
export class InsightsResolver {
  constructor(private readonly pipeline: PublicPipeline) {}

  @Mutation('setAiInsightHidden')
  @UseGuards(SignedInGuard)
  setAiInsightHidden(@Args('id') id: string, @Args('hidden') hidden: boolean, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<{ ok: boolean; userErrors: UserError[] }>(async () => (await this.pipeline.setHidden(viewer.userId, id, hidden), { ok: true }), { ok: false })
  }
}
