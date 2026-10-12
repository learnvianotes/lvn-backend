import { UseGuards } from '@nestjs/common'
import { Args, Query, Resolver } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { connection } from '@lvn-backend/graphql'
import { FollowingFeedService } from '../application/following-feed.service'
import { toNote } from './notes.resolver'

@Resolver()
@UseGuards(SignedInGuard)
export class FeedsResolver {
  constructor(private readonly feed: FollowingFeedService) {}

  @Query('followingFeed')
  async followingFeed(@Args('first') first: number | null, @Args('after') after: string | null, @CurrentViewer() viewer: Viewer) {
    const { rows, size } = await this.feed.page(viewer.userId, first, after)
    // Everything here is public: readers see the published version, like the public pages.
    return connection(rows, size, (n) => [n.publishedAt!.toISOString(), n.id], (n) => toNote({ note: n, access: 'READER', shareRole: null, actor: null }))
  }
}
