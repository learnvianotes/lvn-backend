import { UseGuards } from '@nestjs/common'
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { withUserErrors, type UserError } from '@lvn-backend/errors'
import { RecommendationsService, type RecommendationKind } from '../application/recommendations.service'

type Ok = { ok: boolean; userErrors: UserError[] }

/** Recommendations (ADR-0071). */
@Resolver()
@UseGuards(SignedInGuard)
export class RecommendationsResolver {
  constructor(private readonly recommendations: RecommendationsService) {}

  @Query('recommendations')
  async list(@Args('limit') limit: number | null, @CurrentViewer() viewer: Viewer) {
    return (await this.recommendations.list(viewer.userId, limit ?? 10)).map((r) => ({
      ...r,
      note: r.noteId ? { __typename: 'Note', id: r.noteId } : null,
      topic: r.topicId ? { __typename: 'Topic', id: r.topicId } : null,
    }))
  }

  @Mutation('dismissRecommendation')
  dismiss(@Args('input') input: { kind: RecommendationKind; entityId: string }, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<Ok>(async () => (await this.recommendations.dismiss(viewer.userId, input.kind, input.entityId), { ok: true }), { ok: false })
  }
}
