import { UseGuards } from '@nestjs/common'
import { Args, Query, Resolver } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { CommunityFeedsService, type CommunityItem } from '../application/community-feeds.service'
import type { QueryForYouFeedArgs, QueryTrendingFeedArgs } from './schema.types'

const edge = (i: CommunityItem) => ({ cursor: i.cursor, node: { __typename: 'Note', id: i.noteId }, topic: i.topicId ? { __typename: 'Topic', id: i.topicId } : null })

/** For You and Trending (ADR-0076): ids here; `notes` resolves each note for the viewer, through its read rule. */
@Resolver()
@UseGuards(SignedInGuard)
export class CommunityResolver {
  constructor(private readonly feeds: CommunityFeedsService) {}

  @Query('forYouFeed')
  async forYouFeed(@Args() { first, after }: QueryForYouFeedArgs, @CurrentViewer() viewer: Viewer) {
    const { items, hasNextPage, basedOn } = await this.feeds.forYou(viewer.userId, first, after)
    return { edges: items.map(edge), pageInfo: { hasNextPage, endCursor: items.at(-1)?.cursor ?? null }, basedOn: basedOn.map((id) => ({ __typename: 'Topic', id })) }
  }

  @Query('trendingFeed')
  async trendingFeed(@Args() { first, after }: QueryTrendingFeedArgs, @CurrentViewer() viewer: Viewer) {
    const { items, hasNextPage } = await this.feeds.trending(viewer.userId, first, after)
    return { edges: items.map(edge), pageInfo: { hasNextPage, endCursor: items.at(-1)?.cursor ?? null }, basedOn: [] }
  }
}
