import { UseGuards } from '@nestjs/common'
import { Args, Context, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type RequestContext, type Viewer } from '@lvn-backend/auth-guard'
import { withUserErrors } from '@lvn-backend/errors'
import { connection, decodeCursor, encodeCursor, pageSize } from '@lvn-backend/graphql'
import { SocialService, type Listed } from '../application/social.service'
import { UsersService } from '../application/users.service'
import type { PersonPayload, QueryMyFollowersArgs, QueryMyFollowingArgs, QueryUserByHandleArgs, Relation, User } from './schema.types'

type PersonArgs = { input: { userId: string } }

/** Follows, blocks and restrictions (ADR-0043): mutations and the viewer's own lists. */
@Resolver('User')
@UseGuards(SignedInGuard)
export class SocialResolver {
  constructor(
    private readonly social: SocialService,
    private readonly users: UsersService,
  ) {}

  /** The people of a list as Users, in the list's order; anyone deleted meanwhile is left out. */
  private async people(rows: Listed[]) {
    const byId = new Map((await this.users.publicProfiles(rows.map((r) => r.id))).map((u) => [u.id, u]))
    return rows.filter((r) => byId.has(r.id)).map((r) => ({ row: r, user: byId.get(r.id)! }))
  }

  private async page(rows: Listed[], size: number) {
    const people = await this.people(rows)
    return connection(people, size, (p) => [p.row.since.toISOString(), p.row.id], (p) => p.user)
  }

  @Query('myFollowers')
  async myFollowers(@Args() { first, after }: QueryMyFollowersArgs, @CurrentViewer() viewer: Viewer) {
    const size = pageSize(first)
    const rows = await this.social.followers(viewer.userId, size, decodeCursor(after, 2) as [string, string] | null)
    return this.withSince(await this.page(rows, size), rows)
  }

  @Query('myFollowing')
  async myFollowing(@Args() { first, after }: QueryMyFollowingArgs, @CurrentViewer() viewer: Viewer) {
    const size = pageSize(first)
    const rows = await this.social.following(viewer.userId, size, decodeCursor(after, 2) as [string, string] | null)
    return this.withSince(await this.page(rows, size), rows)
  }

  @Query('myBlocked')
  async myBlocked(@CurrentViewer() viewer: Viewer) {
    return (await this.people(await this.social.blocked(viewer.userId))).map((p) => ({ cursor: encodeCursor([p.row.id]), node: p.user, since: p.row.since }))
  }

  @Query('myRestricted')
  async myRestricted(@CurrentViewer() viewer: Viewer) {
    return (await this.people(await this.social.restricted(viewer.userId))).map((p) => ({ cursor: encodeCursor([p.row.id]), node: p.user, since: p.row.since }))
  }

  /** Adds each edge's `since` from the rows the page was built from. */
  private withSince<T extends { edges: { node: User }[] }>(page: T, rows: Listed[]) {
    const since = new Map(rows.map((r) => [r.id, r.since]))
    return { ...page, edges: page.edges.map((e) => ({ ...e, since: since.get(e.node.id)! })) }
  }

  private act(run: () => Promise<void>, userId: string): Promise<PersonPayload> {
    return withUserErrors<PersonPayload>(
      async () => {
        await run()
        return { user: await this.users.publicProfile(userId) }
      },
      { user: null },
    )
  }

  @Mutation('followUser')
  followUser(@Args() { input }: PersonArgs, @CurrentViewer() viewer: Viewer) {
    return this.act(() => this.social.follow(viewer.userId, input.userId), input.userId)
  }

  @Mutation('unfollowUser')
  unfollowUser(@Args() { input }: PersonArgs, @CurrentViewer() viewer: Viewer) {
    return this.act(() => this.social.unfollow(viewer.userId, input.userId), input.userId)
  }

  @Mutation('removeFollower')
  removeFollower(@Args() { input }: PersonArgs, @CurrentViewer() viewer: Viewer) {
    return this.act(() => this.social.removeFollower(viewer.userId, input.userId), input.userId)
  }

  @Mutation('blockUser')
  blockUser(@Args() { input }: PersonArgs, @CurrentViewer() viewer: Viewer) {
    return this.act(() => this.social.block(viewer.userId, input.userId), input.userId)
  }

  @Mutation('unblockUser')
  unblockUser(@Args() { input }: PersonArgs, @CurrentViewer() viewer: Viewer) {
    return this.act(() => this.social.unblock(viewer.userId, input.userId), input.userId)
  }

  @Mutation('restrictUser')
  restrictUser(@Args() { input }: PersonArgs, @CurrentViewer() viewer: Viewer) {
    return this.act(() => this.social.restrict(viewer.userId, input.userId), input.userId)
  }

  @Mutation('unrestrictUser')
  unrestrictUser(@Args() { input }: PersonArgs, @CurrentViewer() viewer: Viewer) {
    return this.act(() => this.social.unrestrict(viewer.userId, input.userId), input.userId)
  }
}

/** Public profiles and the people fields of User, for anyone (anonymous visitors included). */
@Resolver('User')
export class PeopleResolver {
  constructor(
    private readonly social: SocialService,
    private readonly users: UsersService,
  ) {}

  @Query('userByHandle')
  async userByHandle(@Args() { handle }: QueryUserByHandleArgs, @Context() ctx: RequestContext): Promise<User | null> {
    const viewerId = ctx.viewer?.userId ?? null
    const id = await this.social.byHandleOrId(handle)
    if (!id || !(await this.social.profileVisible(viewerId, id))) return null
    return id === viewerId ? this.users.viewerProfile(id) : this.users.publicProfile(id)
  }

  @ResolveField('followerCount')
  async followerCount(@Parent() u: { id: string }, @Context() ctx: RequestContext): Promise<number | null> {
    return ctx.viewer?.userId === u.id ? (await this.social.counts(u.id)).followers : null
  }

  @ResolveField('followingCount')
  async followingCount(@Parent() u: { id: string }, @Context() ctx: RequestContext): Promise<number | null> {
    return ctx.viewer?.userId === u.id ? (await this.social.counts(u.id)).following : null
  }

  @ResolveField('followerMilestone')
  followerMilestone(@Parent() u: { id: string }): Promise<number | null> {
    return this.social.followerMilestone(u.id)
  }

  @ResolveField('relation')
  async relation(@Parent() u: { id: string }, @Context() ctx: RequestContext): Promise<Relation | null> {
    const r = await this.social.relation(ctx.viewer?.userId ?? null, u.id)
    if (!r) return null
    return { following: r.following, followedBy: r.followedBy, blocked: r.blocked, restricted: r.restricted, viewerCan: r.can }
  }
}
