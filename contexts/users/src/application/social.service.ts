import { Inject, Injectable } from '@nestjs/common'
import { Action, can, milestoneFor, type Actor, type GlobalRole, type Resource } from '@lvn/contracts/domain'
import { Errors } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { PrismaService, type Prisma } from '@lvn-backend/prisma-base'
import { RateLimiter } from '@lvn-backend/redis'
import { isRestrictedMinor } from '../domain/rules'
import { USERS_CONFIG, type UsersConfig } from '../users.config'
import { AuditService } from './audit.service'
import { PolicyService } from './policy.service'

/** ADR-0043: follows a person may make in an hour. */
export const FOLLOWS_PER_HOUR = 200

type UserResource = Extract<Resource, { kind: 'user' }>

/** How the viewer stands with another person, and what they may do about it. */
export interface Relation {
  following: boolean
  followedBy: boolean
  blocked: boolean
  restricted: boolean
  can: { follow: boolean; unfollow: boolean; removeFollower: boolean; block: boolean; unblock: boolean; restrict: boolean; unrestrict: boolean }
}

export interface Listed {
  id: string
  since: Date
}

/**
 * The social graph of the `users` context (ADR-0013, ADR-0014, ADR-0016, ADR-0020, ADR-0043): follows, blocks and
 * restrictions, each checked with `can()` against facts read fresh from the database.
 */
@Injectable()
export class SocialService {
  constructor(
    private readonly db: PrismaService,
    private readonly policy: PolicyService,
    private readonly limiter: RateLimiter,
    private readonly audit: AuditService,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(USERS_CONFIG) private readonly config: UsersConfig,
  ) {}

  /** The actor and everything `can()` needs about the target; a missing or deleted target is NOT_FOUND. */
  private async facts(actorId: string, targetId: string): Promise<{ actor: Actor; resource: UserResource }> {
    const actor = await this.policy.actor(actorId)
    if (!actor) throw Errors.unauthenticated()
    const target = await this.db.user.findFirst({
      where: { id: targetId, deletedAt: null },
      select: { id: true, globalRole: true, dateOfBirth: true, consents: { where: { kind: 'GUARDIAN' }, select: { id: true }, take: 1 } },
    })
    if (!target) throw Errors.notFound('Nobody on LearnViaNotes has that account.')
    const [following, followsActor, blockedByActor, blockingActor, restrictedByActor] = await Promise.all([
      this.db.follow.count({ where: { followerId: actorId, followeeId: targetId } }),
      this.db.follow.count({ where: { followerId: targetId, followeeId: actorId } }),
      this.db.block.count({ where: { blockerId: actorId, blockedId: targetId } }),
      this.db.block.count({ where: { blockerId: targetId, blockedId: actorId } }),
      this.db.restriction.count({ where: { restricterId: actorId, restrictedId: targetId } }),
    ])
    return {
      actor,
      resource: {
        kind: 'user',
        targetId,
        targetGlobalRole: target.globalRole as GlobalRole,
        targetRestrictedMinor: isRestrictedMinor(target.dateOfBirth, this.config.digitalConsentAge, target.consents.length > 0),
        following: following > 0,
        followsActor: followsActor > 0,
        blocked: blockedByActor + blockingActor > 0,
        blockedByActor: blockedByActor > 0,
        restrictedByActor: restrictedByActor > 0,
      },
    }
  }

  /** The viewer's relation to someone, for profiles; null for anonymous viewers or oneself. */
  async relation(viewerId: string | null, targetId: string): Promise<Relation | null> {
    if (!viewerId || viewerId === targetId) return null
    const { actor, resource } = await this.facts(viewerId, targetId)
    const may = (action: Action) => can(actor, action, resource)
    return {
      following: resource.following ?? false,
      followedBy: resource.followsActor ?? false,
      // Only the viewer's own block shows: being blocked by the other person is never revealed (ADR-0016).
      blocked: resource.blockedByActor ?? false,
      restricted: resource.restrictedByActor ?? false,
      can: {
        follow: may(Action.USER_FOLLOW),
        unfollow: may(Action.USER_UNFOLLOW),
        removeFollower: may(Action.USER_REMOVE_FOLLOWER),
        block: may(Action.USER_BLOCK),
        unblock: may(Action.USER_UNBLOCK),
        restrict: may(Action.USER_RESTRICT),
        unrestrict: may(Action.USER_UNRESTRICT),
      },
    }
  }

  async follow(actorId: string, targetId: string): Promise<void> {
    if (actorId === targetId) throw Errors.validation('You cannot follow yourself.')
    const { actor, resource } = await this.facts(actorId, targetId)
    if (resource.following) return
    if (!can(actor, Action.USER_FOLLOW, resource)) {
      if (!actor.institutionVerified) throw Errors.forbidden('Verify your account to follow people.')
      // Blocks and restricted minors get the same answer: neither is revealed (ADR-0016).
      throw Errors.forbidden("You can't follow this person.")
    }
    const limit = await this.limiter.hit(`users:follow:${actorId}`, { max: FOLLOWS_PER_HOUR, windowSeconds: 3600 })
    if (!limit.allowed) throw Errors.rateLimited(limit.retryAfter, 'You have followed a lot of people in the last hour. Try again later.')
    await this.db.follow.createMany({ data: [{ followerId: actorId, followeeId: targetId }], skipDuplicates: true })
    // Someone the followed person restricts causes no notification (ADR-0016, ADR-0043); nor does a restricted minor,
    // who is never named to others.
    const quiet = actor.restrictedMinor === true || (await this.db.restriction.count({ where: { restricterId: targetId, restrictedId: actorId } })) > 0
    await this.events.publish('UserFollowed', { followerId: actorId, followeeId: targetId, quiet })
  }

  async unfollow(actorId: string, targetId: string): Promise<void> {
    const { count } = await this.db.follow.deleteMany({ where: { followerId: actorId, followeeId: targetId } })
    if (count) await this.events.publish('UserUnfollowed', { followerId: actorId, followeeId: targetId, quiet: true })
  }

  /** Silently (ADR-0016): the follower is not told. */
  async removeFollower(actorId: string, followerId: string): Promise<void> {
    const { count } = await this.db.follow.deleteMany({ where: { followerId, followeeId: actorId } })
    if (count) await this.events.publish('UserUnfollowed', { followerId, followeeId: actorId, quiet: true })
  }

  /** Ends follows both ways and replaces a restriction (ADR-0016); the person blocked is not told. */
  async block(actorId: string, targetId: string): Promise<void> {
    if (actorId === targetId) throw Errors.validation('You cannot block yourself.')
    const { actor, resource } = await this.facts(actorId, targetId)
    if (resource.blockedByActor) return
    if (!can(actor, Action.USER_BLOCK, resource)) throw Errors.forbidden()
    const ended = await this.db.$transaction(async (tx) => {
      await tx.block.createMany({ data: [{ blockerId: actorId, blockedId: targetId }], skipDuplicates: true })
      await tx.restriction.deleteMany({ where: { restricterId: actorId, restrictedId: targetId } })
      const follows = await tx.follow.findMany({ where: { OR: [{ followerId: actorId, followeeId: targetId }, { followerId: targetId, followeeId: actorId }] } })
      await tx.follow.deleteMany({ where: { OR: [{ followerId: actorId, followeeId: targetId }, { followerId: targetId, followeeId: actorId }] } })
      await this.audit.record({ actorId, action: 'user.block', targetType: 'USER', targetId }, tx)
      return follows
    })
    await this.events.publish('UserBlocked', { blockerId: actorId, blockedId: targetId })
    for (const f of ended) await this.events.publish('UserUnfollowed', { followerId: f.followerId, followeeId: f.followeeId, quiet: true })
  }

  async unblock(actorId: string, targetId: string): Promise<void> {
    const { count } = await this.db.block.deleteMany({ where: { blockerId: actorId, blockedId: targetId } })
    if (!count) return
    await this.audit.record({ actorId, action: 'user.unblock', targetType: 'USER', targetId })
    await this.events.publish('UserUnblocked', { blockerId: actorId, blockedId: targetId })
  }

  async restrict(actorId: string, targetId: string): Promise<void> {
    if (actorId === targetId) throw Errors.validation('You cannot restrict yourself.')
    const { actor, resource } = await this.facts(actorId, targetId)
    if (resource.restrictedByActor) return
    if (!can(actor, Action.USER_RESTRICT, resource)) throw Errors.forbidden(resource.blockedByActor ? 'Unblock them first: restricting is for people you have not blocked.' : undefined)
    await this.db.restriction.createMany({ data: [{ restricterId: actorId, restrictedId: targetId }], skipDuplicates: true })
    await this.audit.record({ actorId, action: 'user.restrict', targetType: 'USER', targetId })
    await this.events.publish('UserRestricted', { restricterId: actorId, restrictedId: targetId })
  }

  async unrestrict(actorId: string, targetId: string): Promise<void> {
    const { count } = await this.db.restriction.deleteMany({ where: { restricterId: actorId, restrictedId: targetId } })
    if (!count) return
    await this.audit.record({ actorId, action: 'user.unrestrict', targetType: 'USER', targetId })
    await this.events.publish('UserUnrestricted', { restricterId: actorId, restrictedId: targetId })
  }

  /** People who may be named in a list: not deleted, and not restricted minors (ADR-0016). */
  private nameable(): Prisma.UserWhereInput {
    const adultsBornBy = new Date()
    adultsBornBy.setUTCFullYear(adultsBornBy.getUTCFullYear() - this.config.digitalConsentAge)
    return { deletedAt: null, OR: [{ dateOfBirth: { lte: adultsBornBy } }, { consents: { some: { kind: 'GUARDIAN' } } }] }
  }

  /** The person's followers, newest first, restricted minors left out of the names (they are still counted). */
  async followers(userId: string, size: number, after: [string, string] | null): Promise<Listed[]> {
    const rows = await this.db.follow.findMany({
      where: { followeeId: userId, follower: this.nameable(), ...this.before(after, 'followerId') },
      orderBy: [{ createdAt: 'desc' }, { followerId: 'desc' }],
      take: size + 1,
      select: { followerId: true, createdAt: true },
    })
    return rows.map((r) => ({ id: r.followerId, since: r.createdAt }))
  }

  async following(userId: string, size: number, after: [string, string] | null): Promise<Listed[]> {
    const rows = await this.db.follow.findMany({
      where: { followerId: userId, followee: { deletedAt: null }, ...this.before(after, 'followeeId') },
      orderBy: [{ createdAt: 'desc' }, { followeeId: 'desc' }],
      take: size + 1,
      select: { followeeId: true, createdAt: true },
    })
    return rows.map((r) => ({ id: r.followeeId, since: r.createdAt }))
  }

  async blocked(userId: string): Promise<Listed[]> {
    const rows = await this.db.block.findMany({ where: { blockerId: userId, blocked: { deletedAt: null } }, orderBy: { createdAt: 'desc' }, take: 500 })
    return rows.map((r) => ({ id: r.blockedId, since: r.createdAt }))
  }

  async restricted(userId: string): Promise<Listed[]> {
    const rows = await this.db.restriction.findMany({ where: { restricterId: userId, restricted: { deletedAt: null } }, orderBy: { createdAt: 'desc' }, take: 500 })
    return rows.map((r) => ({ id: r.restrictedId, since: r.createdAt }))
  }

  private before(after: [string, string] | null, idField: 'followerId' | 'followeeId'): Prisma.FollowWhereInput {
    if (!after) return {}
    const at = new Date(after[0])
    return { OR: [{ createdAt: { lt: at } }, { createdAt: at, [idField]: { lt: after[1] } }] }
  }

  async counts(userId: string): Promise<{ followers: number; following: number }> {
    const [followers, following] = await Promise.all([
      this.db.follow.count({ where: { followeeId: userId, follower: { deletedAt: null } } }),
      this.db.follow.count({ where: { followerId: userId, followee: { deletedAt: null } } }),
    ])
    return { followers, following }
  }

  /** What others see of a follower count (ADR-0027, ADR-0043): a milestone, or null below the first. */
  async followerMilestone(userId: string): Promise<number | null> {
    return milestoneFor((await this.counts(userId)).followers)
  }

  /** A restricted minor's profile is theirs alone (ADR-0043). */
  async profileVisible(viewerId: string | null, userId: string): Promise<boolean> {
    if (viewerId === userId) return true
    const u = await this.db.user.findFirst({ where: { id: userId, deletedAt: null }, select: { dateOfBirth: true, consents: { where: { kind: 'GUARDIAN' }, select: { id: true }, take: 1 } } })
    return !!u && !isRestrictedMinor(u.dateOfBirth, this.config.digitalConsentAge, u.consents.length > 0)
  }

  /** A user by handle, or by id (links in notifications carry ids); deleted accounts are not found. */
  async byHandleOrId(handleOrId: string): Promise<string | null> {
    const q = handleOrId.trim().replace(/^@/, '')
    if (!q || q.length > 64) return null
    const isId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q)
    const u = await this.db.user.findFirst({ where: { deletedAt: null, ...(isId ? { id: q } : { handle: { equals: q, mode: 'insensitive' } }) }, select: { id: true } })
    return u?.id ?? null
  }
}
