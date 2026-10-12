import { Inject, Injectable } from '@nestjs/common'
import { Action, can, GroupJoinPolicy, GroupPrivacy, GroupRole as Role, GroupType, type Actor, type Resource } from '@lvn/contracts/domain'
import { docSchema, docText } from '@lvn/contracts/validation'
import { Errors } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { AUDIT, ENTITLEMENTS, PEOPLE, POLICY, type Audit, type Entitlements, type People, type Policy } from '@lvn-backend/facades'
import { newId, PrismaService, type Prisma } from '@lvn-backend/prisma-base'
import { RateLimiter } from '@lvn-backend/redis'

/** The roles as stored (core.GroupRole) and as `can()` names them (`@lvn/contracts` GroupRole). */
export type StoredRole = 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER' | 'MENTOR'
export const CONTRACT_ROLE: Record<StoredRole, Role> = { OWNER: Role.OWNER, ADMIN: Role.ADMIN, MODERATOR: Role.MODERATOR, MEMBER: Role.MEMBER, MENTOR: Role.MENTOR }
const RANK: Record<StoredRole, number> = { MEMBER: 1, MENTOR: 1, MODERATOR: 2, ADMIN: 3, OWNER: 4 }

export const GROUP_LIMITS = { name: 80, description: 2000, message: 500, postChars: 20_000, rejoinAfterDays: 7, groupsPerDay: 10, postsPerHour: 60 } as const

export type GroupRow = Prisma.GroupGetPayload<object>
type GroupResource = Extract<Resource, { kind: 'group' }>

/** A PRIVATE group always uses approval, whatever is stored (ADR-0011). */
export const effectivePolicy = (g: Pick<GroupRow, 'privacy' | 'joinPolicy'>) => (g.privacy === 'PRIVATE' ? 'APPROVAL' : g.joinPolicy)

export interface GroupView {
  group: GroupRow
  role: StoredRole | null
  pendingRequestId: string | null
  /** A project workspace's open mentor invite to the viewer (ADR-0048) */
  mentorInviteId: string | null
  memberCount: number
  can: Record<'join' | 'requestJoin' | 'post' | 'moderate' | 'manage' | 'delete' | 'reviewRequests' | 'leave' | 'askDoubt' | 'inviteMentor' | 'acceptMentorInvite', boolean>
}

/**
 * Groups (§4.1, §5, ADR-0009, ADR-0011, ADR-0045): membership by approval or open joining, roles, mutes and posts. PUBLIC
 * groups are discoverable; everything inside a group is for its members.
 */
@Injectable()
export class GroupsService {
  constructor(
    private readonly db: PrismaService,
    private readonly limiter: RateLimiter,
    @Inject(POLICY) private readonly policy: Policy,
    @Inject(ENTITLEMENTS) private readonly entitlements: Entitlements,
    @Inject(PEOPLE) private readonly people: People,
    @Inject(AUDIT) private readonly audit: Audit,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  async actor(userId: string): Promise<Actor> {
    const actor = await this.policy.actor(userId)
    if (!actor) throw Errors.unauthenticated()
    return actor
  }

  /** The group, the viewer's place in it and what `can()` needs; null when there is none. */
  async load(viewerId: string, groupId: string): Promise<{ group: GroupRow; role: StoredRole | null; pending: { id: string } | null; mentorInvite: { id: string } | null; resource: GroupResource } | null> {
    const group = await this.db.group.findFirst({ where: { id: groupId, deletedAt: null } })
    if (!group) return null
    const [member, pending, mentorInvite] = await Promise.all([
      this.db.groupMember.findUnique({ where: { groupId_userId: { groupId, userId: viewerId } } }),
      this.db.groupJoinRequest.findFirst({ where: { groupId, userId: viewerId, status: 'PENDING' }, select: { id: true } }),
      group.type === 'PROJECT' ? this.db.mentorInvite.findFirst({ where: { groupId, teacherId: viewerId, acceptedAt: null, declinedAt: null, expiresAt: { gt: new Date() } }, select: { id: true } }) : null,
    ])
    const role = (member?.role as StoredRole | undefined) ?? null
    // A private group is never listed, but its link shows its name so people can ask to join (ADR-0045).
    const resource: GroupResource = {
      kind: 'group',
      ...(role ? { role: CONTRACT_ROLE[role] } : {}),
      type: group.type === 'PROJECT' ? GroupType.PROJECT : GroupType.COMMUNITY,
      privacy: group.privacy === 'PRIVATE' ? GroupPrivacy.PRIVATE : GroupPrivacy.PUBLIC,
      joinPolicy: effectivePolicy(group) === 'OPEN' ? GroupJoinPolicy.OPEN : GroupJoinPolicy.APPROVAL,
      pendingJoinRequest: !!pending,
      mentorInvitePending: !!mentorInvite,
    }
    return { group, role, pending, mentorInvite, resource }
  }

  /** As `load`, for actions: a group the viewer cannot see is NOT_FOUND. */
  async require(actorId: string, groupId: string) {
    const loaded = await this.load(actorId, groupId)
    if (!loaded) throw Errors.notFound('Group not found.')
    return { ...loaded, actor: await this.actor(actorId) }
  }

  async view(viewerId: string, groupId: string): Promise<GroupView | null> {
    const loaded = await this.load(viewerId, groupId)
    if (!loaded) return null
    const actor = await this.actor(viewerId)
    const may = (a: Action) => can(actor, a, loaded.resource)
    return {
      group: loaded.group,
      role: loaded.role,
      pendingRequestId: loaded.pending?.id ?? null,
      mentorInviteId: loaded.mentorInvite?.id ?? null,
      memberCount: await this.db.groupMember.count({ where: { groupId } }),
      can: {
        join: may(Action.GROUP_JOIN),
        requestJoin: may(Action.GROUP_REQUEST_JOIN),
        post: may(Action.GROUP_POST),
        moderate: may(Action.GROUP_MODERATE_POSTS),
        manage: may(Action.GROUP_MANAGE),
        delete: may(Action.GROUP_DELETE),
        reviewRequests: may(Action.GROUP_REVIEW_JOIN_REQUESTS),
        leave: !!loaded.role && loaded.role !== 'OWNER',
        askDoubt: may(Action.GROUP_ASK_DOUBT),
        inviteMentor: loaded.group.type === 'PROJECT' && may(Action.GROUP_MANAGE),
        acceptMentorInvite: may(Action.GROUP_ACCEPT_MENTOR_INVITE),
      },
    }
  }

  private clean(name: string | null | undefined, description: string | null | undefined) {
    const n = name?.replace(/\s+/g, ' ').trim() ?? ''
    if (n.length < 3) throw Errors.validation('Give the group a name of at least 3 characters.', ['input', 'name'])
    if (n.length > GROUP_LIMITS.name) throw Errors.validation(`Keep the name to ${GROUP_LIMITS.name} characters.`, ['input', 'name'])
    const d = description?.trim() || null
    if (d && d.length > GROUP_LIMITS.description) throw Errors.validation(`Keep the description to ${GROUP_LIMITS.description} characters.`, ['input', 'description'])
    return { name: n, description: d }
  }

  async create(actorId: string, input: { name: string; description?: string | null; privacy: 'PUBLIC' | 'PRIVATE'; joinPolicy?: 'OPEN' | 'APPROVAL' | null; type?: 'COMMUNITY' | 'PROJECT' | null }): Promise<string> {
    const actor = await this.actor(actorId)
    if (!can(actor, Action.GROUP_CREATE)) throw Errors.forbidden(actor.institutionVerified ? undefined : 'Verify your account to create groups.')
    const { name, description } = this.clean(input.name, input.description)
    // Project workspaces have their own limit (ADR-0048).
    const type = input.type ?? 'COMMUNITY'
    const limit = await this.entitlements.limit(actorId, type === 'PROJECT' ? 'PROJECT_WORKSPACES' : 'GROUPS_OWNED')
    if (limit !== null && BigInt(await this.db.group.count({ where: { ownerId: actorId, deletedAt: null, type } })) >= limit) {
      throw Errors.validation(type === 'PROJECT' ? `Your plan allows ${limit} project workspaces. Delete one to start another.` : `Your plan allows ${limit} groups. Delete one to start another.`)
    }
    const rate = await this.limiter.hit(`core:group:create:${actorId}`, { max: GROUP_LIMITS.groupsPerDay, windowSeconds: 86_400 })
    if (!rate.allowed) throw Errors.rateLimited(rate.retryAfter, 'You have started a lot of groups today. Try again tomorrow.')
    const id = newId()
    const joinPolicy = input.privacy === 'PRIVATE' ? 'APPROVAL' : (input.joinPolicy ?? 'APPROVAL')
    await this.db.$transaction(async (tx) => {
      await tx.group.create({ data: { id, name, description, type, privacy: input.privacy, joinPolicy, ownerId: actorId } })
      await tx.groupMember.create({ data: { groupId: id, userId: actorId, role: 'OWNER' } })
    })
    await this.audit.record({ actorId, action: 'group.create', targetType: 'GROUP', targetId: id, metadata: { type, privacy: input.privacy, joinPolicy } })
    await this.events.publish('GroupCreated', { groupId: id, ownerId: actorId })
    await this.events.publish('GroupMembershipChanged', { groupId: id, userId: actorId, change: 'JOINED', role: Role.OWNER })
    return id
  }

  async update(actorId: string, groupId: string, input: { name?: string | null; description?: string | null; privacy?: 'PUBLIC' | 'PRIVATE' | null; joinPolicy?: 'OPEN' | 'APPROVAL' | null }): Promise<void> {
    const { group, resource, actor } = await this.require(actorId, groupId)
    if (!can(actor, Action.GROUP_MANAGE, resource)) throw Errors.forbidden('Only the group’s admins change its settings.')
    const { name, description } = this.clean(input.name ?? group.name, input.description === undefined ? group.description : input.description)
    const privacy = input.privacy ?? group.privacy
    const joinPolicy = privacy === 'PRIVATE' ? 'APPROVAL' : (input.joinPolicy ?? group.joinPolicy)
    await this.db.group.update({ where: { id: groupId }, data: { name, description, privacy, joinPolicy } })
    if (privacy !== group.privacy || joinPolicy !== group.joinPolicy) {
      await this.audit.record({ actorId, action: 'group.settings', targetType: 'GROUP', targetId: groupId, metadata: { fromPrivacy: group.privacy, fromJoinPolicy: group.joinPolicy, privacy, joinPolicy } })
    }
  }

  async remove(actorId: string, groupId: string): Promise<void> {
    const { resource, actor } = await this.require(actorId, groupId)
    if (!can(actor, Action.GROUP_DELETE, resource)) throw Errors.forbidden('Only the group’s owner deletes it.')
    await this.db.group.update({ where: { id: groupId }, data: { deletedAt: new Date() } })
    await this.db.groupJoinRequest.updateMany({ where: { groupId, status: 'PENDING' }, data: { status: 'WITHDRAWN' } })
    await this.audit.record({ actorId, action: 'group.delete', targetType: 'GROUP', targetId: groupId })
    await this.events.publish('GroupDeleted', { groupId })
  }

  /** The plan limit on members is the owner's (ADR-0024); null means none. */
  private async assertRoom(group: GroupRow): Promise<void> {
    const limit = await this.entitlements.limit(group.ownerId, 'GROUP_MEMBERS')
    if (limit !== null && BigInt(await this.db.groupMember.count({ where: { groupId: group.id } })) >= limit) throw Errors.validation('This group is full.')
  }

  private async addMember(group: GroupRow, userId: string): Promise<void> {
    await this.assertRoom(group)
    await this.db.groupMember.createMany({ data: [{ groupId: group.id, userId, role: 'MEMBER' }], skipDuplicates: true })
    await this.events.publish('GroupMembershipChanged', { groupId: group.id, userId, change: 'JOINED', role: Role.MEMBER })
  }

  /** A PUBLIC group with the OPEN policy: joined at once (ADR-0011). */
  async join(actorId: string, groupId: string): Promise<void> {
    const { group, role, resource, actor } = await this.require(actorId, groupId)
    if (role) return
    if (!can(actor, Action.GROUP_JOIN, resource)) {
      if (!actor.institutionVerified) throw Errors.forbidden('Verify your account to join groups.')
      throw Errors.forbidden('This group approves its members: ask to join instead.')
    }
    await this.addMember(group, actorId)
  }

  async requestJoin(actorId: string, groupId: string, message: string | null | undefined): Promise<string> {
    const { group, role, pending, resource, actor } = await this.require(actorId, groupId)
    if (role) throw Errors.conflict('You are already in this group.')
    if (pending) return pending.id
    if (!can(actor, Action.GROUP_REQUEST_JOIN, resource)) {
      if (!actor.institutionVerified) throw Errors.forbidden('Verify your account to join groups.')
      throw Errors.forbidden('This group is open: join it directly.')
    }
    const text = message?.trim() || null
    if (text && text.length > GROUP_LIMITS.message) throw Errors.validation(`Keep the message to ${GROUP_LIMITS.message} characters.`, ['input', 'message'])
    const since = new Date(Date.now() - GROUP_LIMITS.rejoinAfterDays * 86_400_000)
    if (await this.db.groupJoinRequest.count({ where: { groupId, userId: actorId, status: 'REJECTED', reviewedAt: { gt: since } } })) {
      throw Errors.validation(`You can ask this group again ${GROUP_LIMITS.rejoinAfterDays} days after your last request.`)
    }
    const id = newId()
    await this.db.groupJoinRequest.create({ data: { id, groupId: group.id, userId: actorId, message: text } })
    const reviewers = await this.db.groupMember.findMany({ where: { groupId, role: { in: ['OWNER', 'ADMIN'] } }, select: { userId: true }, take: 100 })
    await this.events.publish('GroupJoinRequested', { requestId: id, groupId, userId: actorId, reviewerIds: reviewers.map((r) => r.userId) })
    return id
  }

  async withdrawRequest(actorId: string, requestId: string): Promise<string> {
    const r = await this.db.groupJoinRequest.findFirst({ where: { id: requestId, userId: actorId } })
    if (!r) throw Errors.notFound('That request is not there any more.')
    if (r.status === 'PENDING') await this.db.groupJoinRequest.update({ where: { id: requestId }, data: { status: 'WITHDRAWN' } })
    return r.groupId
  }

  async review(actorId: string, requestId: string, decision: 'APPROVED' | 'REJECTED'): Promise<string> {
    const r = await this.db.groupJoinRequest.findUnique({ where: { id: requestId } })
    if (!r) throw Errors.notFound('That request is not there any more.')
    const { group, resource, actor } = await this.require(actorId, r.groupId)
    if (!can(actor, Action.GROUP_REVIEW_JOIN_REQUESTS, resource)) throw Errors.forbidden('Only the group’s admins accept members.')
    if (r.status !== 'PENDING') throw Errors.conflict('That request was already answered.')
    if (decision === 'APPROVED') await this.assertRoom(group)
    await this.db.groupJoinRequest.update({ where: { id: requestId }, data: { status: decision, reviewedBy: actorId, reviewedAt: new Date() } })
    await this.audit.record({ actorId, action: `group.request.${decision.toLowerCase()}`, targetType: 'GROUP', targetId: group.id, metadata: { userId: r.userId } })
    await this.events.publish('JoinRequestReviewed', { requestId, scope: { kind: 'GROUP', groupId: group.id }, userId: r.userId, reviewerId: actorId, decision })
    if (decision === 'APPROVED') await this.addMember(group, r.userId)
    return group.id
  }

  async requests(actorId: string, groupId: string) {
    const { resource, actor } = await this.require(actorId, groupId)
    if (!can(actor, Action.GROUP_REVIEW_JOIN_REQUESTS, resource)) throw Errors.forbidden('Only the group’s admins see requests to join.')
    return this.db.groupJoinRequest.findMany({ where: { groupId, status: 'PENDING' }, orderBy: { createdAt: 'asc' }, take: 200 })
  }

  async leave(actorId: string, groupId: string): Promise<void> {
    const { role } = await this.require(actorId, groupId)
    if (!role) return
    if (role === 'OWNER') throw Errors.validation('Hand the group to another member before you leave it.')
    await this.db.groupMember.delete({ where: { groupId_userId: { groupId, userId: actorId } } })
    await this.events.publish('GroupMembershipChanged', { groupId, userId: actorId, change: 'LEFT' })
  }

  /** The other member's row, for actions on them: only someone of lower rank (ADR-0045). */
  private async target(groupId: string, userId: string, actorRole: StoredRole | null) {
    const m = await this.db.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } })
    if (!m) throw Errors.notFound('They are not in this group.')
    if (!actorRole || RANK[m.role as StoredRole] >= RANK[actorRole]) throw Errors.forbidden('You can only do that to members below your own role.')
    return m
  }

  async removeMember(actorId: string, groupId: string, userId: string): Promise<void> {
    const { role, resource, actor } = await this.require(actorId, groupId)
    if (!can(actor, Action.GROUP_MANAGE, resource)) throw Errors.forbidden('Only the group’s admins remove members.')
    await this.target(groupId, userId, role)
    await this.db.groupMember.delete({ where: { groupId_userId: { groupId, userId } } })
    await this.audit.record({ actorId, action: 'group.member.remove', targetType: 'GROUP', targetId: groupId, metadata: { userId } })
    await this.events.publish('GroupMembershipChanged', { groupId, userId, change: 'LEFT' })
  }

  /** Admins give roles below their own; the owner may hand the group over, becoming an admin. */
  async setRole(actorId: string, groupId: string, userId: string, next: 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER'): Promise<void> {
    const { role, resource, actor } = await this.require(actorId, groupId)
    if (!can(actor, Action.GROUP_MANAGE, resource)) throw Errors.forbidden('Only the group’s admins change roles.')
    const m = await this.target(groupId, userId, role)
    // Mentors are teachers invited to guide a workspace (ADR-0048): they stay mentors until they leave or are removed.
    if (m.role === 'MENTOR') throw Errors.validation('A mentor stays a mentor. Remove them to end it.')
    if (next === 'OWNER') {
      if (role !== 'OWNER') throw Errors.forbidden('Only the owner hands the group over.')
      await this.db.$transaction([
        this.db.groupMember.update({ where: { groupId_userId: { groupId, userId } }, data: { role: 'OWNER' } }),
        this.db.groupMember.update({ where: { groupId_userId: { groupId, userId: actorId } }, data: { role: 'ADMIN' } }),
        this.db.group.update({ where: { id: groupId }, data: { ownerId: userId } }),
      ])
      await this.events.publish('GroupMembershipChanged', { groupId, userId: actorId, change: 'ROLE_CHANGED', role: Role.ADMIN })
    } else {
      if (RANK[next] >= RANK[role!]) throw Errors.forbidden('You can only give roles below your own.')
      await this.db.groupMember.update({ where: { groupId_userId: { groupId, userId } }, data: { role: next } })
    }
    await this.audit.record({ actorId, action: 'group.member.role', targetType: 'GROUP', targetId: groupId, metadata: { userId, from: m.role, to: next } })
    await this.events.publish('GroupMembershipChanged', { groupId, userId, change: 'ROLE_CHANGED', role: CONTRACT_ROLE[next] })
  }

  /** Moderators mute a member for a while (§5); null lifts it. */
  async mute(actorId: string, groupId: string, userId: string, until: Date | null): Promise<void> {
    const { role, resource, actor } = await this.require(actorId, groupId)
    if (!can(actor, Action.GROUP_MODERATE_POSTS, resource)) throw Errors.forbidden('Only the group’s moderators mute members.')
    await this.target(groupId, userId, role)
    if (until && (Number.isNaN(until.getTime()) || until.getTime() <= Date.now())) throw Errors.validation('Choose a time in the future.', ['input', 'until'])
    await this.db.groupMember.update({ where: { groupId_userId: { groupId, userId } }, data: { mutedUntil: until } })
    await this.audit.record({ actorId, action: until ? 'group.member.mute' : 'group.member.unmute', targetType: 'GROUP', targetId: groupId, metadata: { userId, until: until?.toISOString() ?? null } })
  }

  async members(viewerId: string, groupId: string) {
    const { role } = await this.require(viewerId, groupId)
    if (!role) throw Errors.forbidden('Members see who else is in the group.')
    return this.db.groupMember.findMany({ where: { groupId }, orderBy: [{ joinedAt: 'asc' }], take: 1000 })
  }

  /** The viewer's groups, most recently active first. */
  async mine(viewerId: string) {
    const rows = await this.db.groupMember.findMany({ where: { userId: viewerId, group: { deletedAt: null } }, include: { group: true }, orderBy: { group: { updatedAt: 'desc' } }, take: 200 })
    return rows.map((r) => r.group)
  }

  /** Public groups to find, by name, newest first; private ones are never listed. */
  async discover(query: string | null | undefined, size: number) {
    const q = query?.trim()
    return this.db.group.findMany({
      where: { privacy: 'PUBLIC', deletedAt: null, ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}) },
      orderBy: [{ createdAt: 'desc' }],
      take: size,
    })
  }

  // ── Posts ────────────────────────────────────────────────────────────────────────────────────────────────────

  private body(raw: unknown) {
    const doc = docSchema.safeParse(raw)
    if (!doc.success) throw Errors.validation('This post could not be read.', ['input', 'body'])
    const text = docText(doc.data).trim()
    if (!text) throw Errors.validation('Write something first.', ['input', 'body'])
    if (text.length > GROUP_LIMITS.postChars) throw Errors.validation(`Keep posts to ${GROUP_LIMITS.postChars} characters.`, ['input', 'body'])
    return doc.data
  }

  async post(actorId: string, groupId: string, body: unknown, kind: 'POST' | 'IDEA' = 'POST'): Promise<string> {
    const { group, resource, actor } = await this.require(actorId, groupId)
    if (!can(actor, Action.GROUP_POST, resource)) throw Errors.forbidden(actor.institutionVerified ? 'Join the group to post in it.' : 'Verify your account to post.')
    if (kind === 'IDEA' && group.type !== 'PROJECT') throw Errors.validation('Ideas are for project workspaces.', ['input', 'kind'])
    const member = await this.db.groupMember.findUnique({ where: { groupId_userId: { groupId, userId: actorId } } })
    if (member?.mutedUntil && member.mutedUntil > new Date()) throw Errors.forbidden('You are muted in this group for now.')
    const rate = await this.limiter.hit(`core:group:post:${actorId}`, { max: GROUP_LIMITS.postsPerHour, windowSeconds: 3600 })
    if (!rate.allowed) throw Errors.rateLimited(rate.retryAfter, 'You have posted a lot in the last hour. Try again later.')
    const id = newId()
    await this.db.$transaction([
      this.db.groupPost.create({ data: { id, groupId, authorId: actorId, kind, body: this.body(body) as Prisma.InputJsonValue } }),
      this.db.group.update({ where: { id: groupId }, data: { updatedAt: new Date() } }),
    ])
    return id
  }

  private async ownPost(actorId: string, postId: string) {
    const p = await this.db.groupPost.findFirst({ where: { id: postId, deletedAt: null } })
    if (!p) throw Errors.notFound('Post not found.')
    return { post: p, ...(await this.require(actorId, p.groupId)) }
  }

  async editPost(actorId: string, postId: string, body: unknown): Promise<string> {
    const { post, role } = await this.ownPost(actorId, postId)
    if (post.authorId !== actorId || !role) throw Errors.forbidden('Only its author edits a post.')
    await this.db.groupPost.update({ where: { id: postId }, data: { body: this.body(body) as Prisma.InputJsonValue, editedAt: new Date() } })
    return postId
  }

  async deletePost(actorId: string, postId: string): Promise<string> {
    const { post, resource, actor } = await this.ownPost(actorId, postId)
    const mine = post.authorId === actorId
    if (!mine && !can(actor, Action.GROUP_MODERATE_POSTS, resource)) throw Errors.forbidden('Only its author or a moderator removes a post.')
    await this.db.groupPost.update({ where: { id: postId }, data: { deletedAt: new Date() } })
    if (!mine) await this.audit.record({ actorId, action: 'group.post.remove', targetType: 'GROUP', targetId: post.groupId, metadata: { postId, authorId: post.authorId } })
    return post.groupId
  }

  async pinPost(actorId: string, postId: string, pinned: boolean): Promise<string> {
    const { resource, actor } = await this.ownPost(actorId, postId)
    if (!can(actor, Action.GROUP_MODERATE_POSTS, resource)) throw Errors.forbidden('Only moderators pin posts.')
    await this.db.groupPost.update({ where: { id: postId }, data: { pinnedAt: pinned ? new Date() : null } })
    return postId
  }

  /** Posts for members: pinned first, then newest; people the viewer blocked or who blocked them left out (ADR-0016). */
  async posts(viewerId: string, groupId: string, size: number, after: [string, string] | null) {
    const { role } = await this.require(viewerId, groupId)
    if (!role) throw Errors.forbidden('Join the group to read its posts.')
    const hidden = await this.people.blockedIds(viewerId)
    // Held, hidden or removed posts are their author's alone (ADR-0051); AND keeps this apart from the cursor's OR.
    const base: Prisma.GroupPostWhereInput = { groupId, kind: 'POST', deletedAt: null, AND: [{ OR: [{ moderation: 'OK' }, { authorId: viewerId }] }], ...(hidden.length ? { authorId: { notIn: hidden } } : {}) }
    const pinned = after ? [] : await this.db.groupPost.findMany({ where: { ...base, pinnedAt: { not: null } }, orderBy: { pinnedAt: 'desc' }, take: 5 })
    const rows = await this.db.groupPost.findMany({
      where: { ...base, pinnedAt: null, ...(after ? { OR: [{ createdAt: { lt: new Date(after[0]) } }, { createdAt: new Date(after[0]), id: { lt: after[1] } }] } : {}) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: size + 1,
    })
    return { pinned, rows }
  }

  /**
   * A post as comments need it (ADR-0047): null unless the viewer is a member; whether they may comment (members who
   * may post and are not muted) and moderate (moderators and above).
   */
  async postPlace(viewerId: string, postId: string): Promise<{ groupId: string; authorId: string; canComment: boolean; canModerate: boolean } | null> {
    const p = await this.db.groupPost.findFirst({ where: { id: postId, deletedAt: null, OR: [{ moderation: 'OK' }, { authorId: viewerId }] } })
    if (!p) return null
    const loaded = await this.load(viewerId, p.groupId)
    if (!loaded?.role) return null
    const actor = await this.actor(viewerId)
    const member = await this.db.groupMember.findUnique({ where: { groupId_userId: { groupId: p.groupId, userId: viewerId } }, select: { mutedUntil: true } })
    const muted = !!member?.mutedUntil && member.mutedUntil > new Date()
    return { groupId: p.groupId, authorId: p.authorId, canComment: can(actor, Action.GROUP_POST, loaded.resource) && !muted, canModerate: can(actor, Action.GROUP_MODERATE_POSTS, loaded.resource) }
  }

  async getPost(viewerId: string, postId: string) {
    const p = await this.db.groupPost.findFirst({ where: { id: postId, deletedAt: null, OR: [{ moderation: 'OK' }, { authorId: viewerId }] } })
    if (!p) return null
    const loaded = await this.load(viewerId, p.groupId)
    return loaded?.role ? p : null
  }
}
