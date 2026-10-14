import { UseGuards } from '@nestjs/common'
import { Args, Mutation, Parent, Query, ResolveField, Resolver, ResolveReference } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { withUserErrors, type UserError } from '@lvn-backend/errors'
import { connection, decodeCursor, pageSize } from '@lvn-backend/graphql'
import { AchievementsService } from '../application/achievements.service'
import { PointsService } from '../application/points.service'

type SettingsPayload = { settings: { showAchievements: boolean; canShow: boolean } | null; userErrors: UserError[] }

/** A person's achievements and contribution (ADR-0080), added to User: theirs alone unless an adult shows them. */
@Resolver('User')
export class EngagementUserResolver {
  constructor(private readonly achievements: AchievementsService) {}

  // Apollo calls this with (reference, context, info); see UserReferenceResolver in users for why there are no decorators.
  @ResolveReference()
  resolveReference(reference: { id: string }) {
    return { id: reference.id }
  }

  @ResolveField('achievements')
  achievementsOf(@Parent() user: { id: string }, @CurrentViewer() viewer: Viewer | null) {
    return this.achievements.of(viewer?.userId ?? null, user.id)
  }

  @ResolveField('contribution')
  contribution(@Parent() user: { id: string }, @CurrentViewer() viewer: Viewer | null) {
    return this.achievements.contributionOf(viewer?.userId ?? null, user.id)
  }
}

@Resolver()
@UseGuards(SignedInGuard)
export class EngagementResolver {
  constructor(
    private readonly achievements: AchievementsService,
    private readonly points: PointsService,
  ) {}

  @Query('myPoints')
  async myPoints(@Args('first') first: number | null, @Args('after') after: string | null, @CurrentViewer() viewer: Viewer) {
    const size = pageSize(first)
    const cursor = decodeCursor(after, 2) as [string, string] | null
    const rows = await this.points.history(viewer.userId, cursor ? { at: new Date(cursor[0]), id: cursor[1] } : null, size + 1)
    return connection(
      rows,
      size,
      (r) => [r.createdAt.toISOString(), r.id],
      (r) => r,
    )
  }

  @Query('achievementSettings')
  achievementSettings(@CurrentViewer() viewer: Viewer) {
    return this.achievements.settings(viewer.userId)
  }

  @Mutation('setAchievementsShown')
  setAchievementsShown(@Args('input') input: { show: boolean }, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<SettingsPayload>(async () => ({ settings: await this.achievements.setShown(viewer.userId, input.show) }), { settings: null })
  }
}
