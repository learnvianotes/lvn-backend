import { randomInt } from 'node:crypto'
import { Inject, Injectable } from '@nestjs/common'
import { Action, can, ClassroomRole as Role, type Actor, type Resource } from '@lvn/contracts/domain'
import { docSchema, docText } from '@lvn/contracts/validation'
import { Errors } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { AUDIT, ENTITLEMENTS, PEOPLE, POLICY, type Audit, type Entitlements, type People, type Policy } from '@lvn-backend/facades'
import { newId, PrismaService, type Prisma } from '@lvn-backend/prisma-base'
import { RateLimiter } from '@lvn-backend/redis'

export type StoredClassRole = 'TEACHER' | 'TA' | 'STUDENT'
export const CLASS_ROLE: Record<StoredClassRole, Role> = { TEACHER: Role.TEACHER, TA: Role.TA, STUDENT: Role.STUDENT }

/** Eight characters without look-alikes (no 0/O, 1/I/L): read aloud in class and typed on a phone. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const newJoinCode = () => Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('')

export const CLASS_LIMITS = { name: 80, description: 2000, postChars: 20_000, inviteDays: 14, codeTriesPerHour: 20, classesPerDay: 10, postsPerHour: 30, invitesPerDay: 200 } as const

export type ClassroomRow = Prisma.ClassroomGetPayload<object>
type ClassResource = Extract<Resource, { kind: 'classroom' }>

export interface ClassroomView {
  classroom: ClassroomRow
  role: StoredClassRole | null
  pendingRequestId: string | null
  inviteId: string | null
  memberCount: number
  can: Record<'requestJoin' | 'acceptInvite' | 'review' | 'post' | 'manage' | 'leave', boolean>
}

/**
 * Classrooms (§4.1, §5, ADR-0009, ADR-0011, ADR-0046): teachers run them; joining is a request with the code, or a
 * staff invite accepted; staff post announcements and share notes; everything inside is for members.
 */
@Injectable()
export class ClassroomsService {
  constructor(
    private readonly db: PrismaService,
    private readonly limiter: RateLimiter,
    @Inject(POLICY) private readonly policy: Policy,
    @Inject(ENTITLEMENTS) private readonly entitlements: Entitlements,
    @Inject(PEOPLE) private readonly people: People,
    @Inject(AUDIT) private readonly audit: Audit,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  private async actor(userId: string): Promise<Actor> {
    const actor = await this.policy.actor(userId)
    if (!actor) throw Errors.unauthenticated()
    return actor
  }

  /** The class, the viewer's place in it and what `can()` needs; null when the viewer may not know of it. */
  private async load(viewerId: string, classroomId: string) {
    const classroom = await this.db.classroom.findFirst({ where: { id: classroomId, deletedAt: null } })
    if (!classroom) return null
    const now = new Date()
    const [member, pending, invite] = await Promise.all([
      this.db.classroomMember.findUnique({ where: { classroomId_userId: { classroomId, userId: viewerId } } }),
      this.db.classroomJoinRequest.findFirst({ where: { classroomId, userId: viewerId, status: 'PENDING' }, select: { id: true } }),
      this.db.classroomInvite.findFirst({ where: { classroomId, invitedUserId: viewerId, acceptedAt: null, declinedAt: null, expiresAt: { gt: now } }, select: { id: true, role: true } }),
    ])
    const role = (member?.role as StoredClassRole | undefined) ?? null
    // A class is closed: outsiders know of it only through its code, a request of theirs or an invite (ADR-0046).
    if (!role && !pending && !invite) return null
    const resource: ClassResource = { kind: 'classroom', ...(role ? { role: CLASS_ROLE[role] } : {}), pendingJoinRequest: !!pending, invitedByStaff: !!invite }
    return { classroom, role, pending, invite, resource }
  }

  private async require(actorId: string, classroomId: string) {
    const loaded = await this.load(actorId, classroomId)
    if (!loaded) throw Errors.notFound('Class not found.')
    return { ...loaded, actor: await this.actor(actorId) }
  }

  async view(viewerId: string, classroomId: string): Promise<ClassroomView | null> {
    const loaded = await this.load(viewerId, classroomId)
    if (!loaded) return null
    const actor = await this.actor(viewerId)
    const may = (a: Action) => can(actor, a, loaded.resource)
    return {
      classroom: loaded.classroom,
      role: loaded.role,
      pendingRequestId: loaded.pending?.id ?? null,
      inviteId: loaded.invite?.id ?? null,
      memberCount: await this.db.classroomMember.count({ where: { classroomId } }),
      can: {
        requestJoin: may(Action.CLASSROOM_REQUEST_JOIN) && !loaded.invite,
        acceptInvite: may(Action.CLASSROOM_ACCEPT_INVITE),
        review: may(Action.CLASSROOM_REVIEW_JOIN_REQUESTS),
        post: may(Action.CLASSROOM_REVIEW_JOIN_REQUESTS),
        manage: loaded.role === 'TEACHER',
        leave: !!loaded.role && loaded.role !== 'TEACHER',
      },
    }
  }

  /** What a code shows before joining: the class's name and its teacher, nothing inside (ADR-0046). */
  async byCode(viewerId: string, code: string): Promise<{ classroom: ClassroomRow; view: ClassroomView | null } | null> {
    const rate = await this.limiter.hit(`core:class:code:${viewerId}`, { max: CLASS_LIMITS.codeTriesPerHour, windowSeconds: 3600 })
    if (!rate.allowed) throw Errors.rateLimited(rate.retryAfter, 'Too many class codes tried. Try again later.')
    const classroom = await this.db.classroom.findFirst({ where: { joinCode: code.trim().toUpperCase(), deletedAt: null } })
    if (!classroom) return null
    return { classroom, view: await this.view(viewerId, classroom.id) }
  }

  private clean(name: string | null | undefined, description: string | null | undefined) {
    const n = name?.replace(/\s+/g, ' ').trim() ?? ''
    if (n.length < 3) throw Errors.validation('Give the class a name of at least 3 characters.', ['input', 'name'])
    if (n.length > CLASS_LIMITS.name) throw Errors.validation(`Keep the name to ${CLASS_LIMITS.name} characters.`, ['input', 'name'])
    const d = description?.trim() || null
    if (d && d.length > CLASS_LIMITS.description) throw Errors.validation(`Keep the description to ${CLASS_LIMITS.description} characters.`, ['input', 'description'])
    return { name: n, description: d }
  }

  private async uniqueCode(): Promise<string> {
    for (;;) {
      const code = newJoinCode()
      if (!(await this.db.classroom.count({ where: { joinCode: code } }))) return code
    }
  }

  async create(actorId: string, input: { name: string; description?: string | null }): Promise<string> {
    const actor = await this.actor(actorId)
    if (!can(actor, Action.CLASSROOM_CREATE)) throw Errors.forbidden('Classes are run by teachers.')
    const { name, description } = this.clean(input.name, input.description)
    const limit = await this.entitlements.limit(actorId, 'CLASSROOMS_OWNED')
    if (limit !== null && BigInt(await this.db.classroom.count({ where: { ownerId: actorId, deletedAt: null } })) >= limit) throw Errors.validation(`Your plan allows ${limit} classes.`)
    const rate = await this.limiter.hit(`core:class:create:${actorId}`, { max: CLASS_LIMITS.classesPerDay, windowSeconds: 86_400 })
    if (!rate.allowed) throw Errors.rateLimited(rate.retryAfter, 'You have started a lot of classes today. Try again tomorrow.')
    const id = newId()
    await this.db.$transaction(async (tx) => {
      await tx.classroom.create({ data: { id, name, description, joinCode: await this.uniqueCode(), ownerId: actorId } })
      await tx.classroomMember.create({ data: { classroomId: id, userId: actorId, role: 'TEACHER' } })
    })
    await this.audit.record({ actorId, action: 'classroom.create', targetType: 'CLASSROOM', targetId: id })
    await this.events.publish('ClassroomCreated', { classroomId: id, ownerId: actorId })
    await this.events.publish('ClassroomMembershipChanged', { classroomId: id, userId: actorId, change: 'JOINED', role: 'TEACHER' })
    return id
  }

  async update(actorId: string, classroomId: string, input: { name?: string | null; description?: string | null; newCode?: boolean | null }): Promise<void> {
    const { classroom, role } = await this.require(actorId, classroomId)
    if (role !== 'TEACHER') throw Errors.forbidden('Only the class’s teacher changes it.')
    const { name, description } = this.clean(input.name ?? classroom.name, input.description === undefined ? classroom.description : input.description)
    await this.db.classroom.update({ where: { id: classroomId }, data: { name, description, ...(input.newCode ? { joinCode: await this.uniqueCode() } : {}) } })
    await this.events.publish('ClassroomUpdated', { classroomId })
    if (input.newCode) await this.audit.record({ actorId, action: 'classroom.code', targetType: 'CLASSROOM', targetId: classroomId })
  }

  async remove(actorId: string, classroomId: string): Promise<void> {
    const { role } = await this.require(actorId, classroomId)
    if (role !== 'TEACHER') throw Errors.forbidden('Only the class’s teacher deletes it.')
    await this.db.classroom.update({ where: { id: classroomId }, data: { deletedAt: new Date() } })
    await this.audit.record({ actorId, action: 'classroom.delete', targetType: 'CLASSROOM', targetId: classroomId })
    await this.events.publish('ClassroomDeleted', { classroomId })
  }

  private async assertRoom(c: ClassroomRow) {
    const limit = await this.entitlements.limit(c.ownerId, 'CLASSROOM_MEMBERS')
    if (limit !== null && BigInt(await this.db.classroomMember.count({ where: { classroomId: c.id } })) >= limit) throw Errors.validation('This class is full.')
  }

  private async addMember(c: ClassroomRow, userId: string, role: StoredClassRole) {
    await this.assertRoom(c)
    await this.db.classroomMember.createMany({ data: [{ classroomId: c.id, userId, role }], skipDuplicates: true })
    await this.events.publish('ClassroomMembershipChanged', { classroomId: c.id, userId, change: 'JOINED', role })
  }

  /** Asking to join with the code (or the link carrying it): staff answer (ADR-0009). */
  async requestJoin(actorId: string, code: string, via: 'CODE' | 'LINK'): Promise<string> {
    const found = await this.byCode(actorId, code)
    if (!found) throw Errors.notFound('No class has that code. Check it with your teacher.')
    const { classroom, view } = found
    if (view?.role) throw Errors.conflict('You are already in this class.')
    if (view?.pendingRequestId) return classroom.id
    const actor = await this.actor(actorId)
    if (!can(actor, Action.CLASSROOM_REQUEST_JOIN, { kind: 'classroom', pendingJoinRequest: false })) throw Errors.forbidden('Verify your account to join classes.')
    const id = newId()
    await this.db.classroomJoinRequest.create({ data: { id, classroomId: classroom.id, userId: actorId, via } })
    const staff = await this.db.classroomMember.findMany({ where: { classroomId: classroom.id, role: { in: ['TEACHER', 'TA'] } }, select: { userId: true }, take: 100 })
    await this.events.publish('ClassroomJoinRequested', { requestId: id, classroomId: classroom.id, userId: actorId, reviewerIds: staff.map((s) => s.userId) })
    return classroom.id
  }

  async withdrawRequest(actorId: string, requestId: string): Promise<string> {
    const r = await this.db.classroomJoinRequest.findFirst({ where: { id: requestId, userId: actorId } })
    if (!r) throw Errors.notFound('That request is not there any more.')
    if (r.status === 'PENDING') await this.db.classroomJoinRequest.update({ where: { id: requestId }, data: { status: 'WITHDRAWN' } })
    return r.classroomId
  }

  async review(actorId: string, requestId: string, decision: 'APPROVED' | 'REJECTED'): Promise<string> {
    const r = await this.db.classroomJoinRequest.findUnique({ where: { id: requestId } })
    if (!r) throw Errors.notFound('That request is not there any more.')
    const { classroom, resource, actor } = await this.require(actorId, r.classroomId)
    if (!can(actor, Action.CLASSROOM_REVIEW_JOIN_REQUESTS, resource)) throw Errors.forbidden('Only the class’s teacher and TAs accept students.')
    if (r.status !== 'PENDING') throw Errors.conflict('That request was already answered.')
    if (decision === 'APPROVED') await this.assertRoom(classroom)
    await this.db.classroomJoinRequest.update({ where: { id: requestId }, data: { status: decision, reviewedBy: actorId, reviewedAt: new Date() } })
    await this.audit.record({ actorId, action: `classroom.request.${decision.toLowerCase()}`, targetType: 'CLASSROOM', targetId: classroom.id, metadata: { userId: r.userId } })
    await this.events.publish('JoinRequestReviewed', { requestId, scope: { kind: 'CLASSROOM', classroomId: classroom.id }, userId: r.userId, reviewerId: actorId, decision })
    if (decision === 'APPROVED') await this.addMember(classroom, r.userId, 'STUDENT')
    return classroom.id
  }

  async requests(actorId: string, classroomId: string) {
    const { resource, actor } = await this.require(actorId, classroomId)
    if (!can(actor, Action.CLASSROOM_REVIEW_JOIN_REQUESTS, resource)) throw Errors.forbidden()
    return this.db.classroomJoinRequest.findMany({ where: { classroomId, status: 'PENDING' }, orderBy: { createdAt: 'asc' }, take: 500 })
  }

  /** Staff invite by handle or email (ADR-0009): a TA only by the teacher. */
  async invite(actorId: string, classroomId: string, person: string, role: 'STUDENT' | 'TA'): Promise<string> {
    const { classroom, role: mine, resource, actor } = await this.require(actorId, classroomId)
    if (!can(actor, Action.CLASSROOM_REVIEW_JOIN_REQUESTS, resource)) throw Errors.forbidden('Only the class’s teacher and TAs invite people.')
    if (role === 'TA' && mine !== 'TEACHER') throw Errors.forbidden('Only the class’s teacher invites TAs.')
    const found = await this.people.find(person)
    if (!found) throw Errors.validation('Nobody on LearnViaNotes has that handle or email.', ['input', 'person'])
    if (await this.people.blockedBetween(actorId, found.id)) throw Errors.forbidden("You can't invite that person.")
    if (await this.db.classroomMember.count({ where: { classroomId, userId: found.id } })) throw Errors.conflict('They are already in this class.')
    // Inviting again while an invite is open changes nothing and tells nobody twice.
    const open = await this.db.classroomInvite.findFirst({ where: { classroomId, invitedUserId: found.id, acceptedAt: null, declinedAt: null, expiresAt: { gt: new Date() } }, select: { id: true } })
    if (open) return open.id
    const rate = await this.limiter.hit(`core:class:invite:${actorId}`, { max: CLASS_LIMITS.invitesPerDay, windowSeconds: 86_400 })
    if (!rate.allowed) throw Errors.rateLimited(rate.retryAfter, 'You have sent a lot of invites today. Try again tomorrow.')
    const id = newId()
    await this.db.classroomInvite.create({ data: { id, classroomId, invitedUserId: found.id, invitedBy: actorId, role, expiresAt: new Date(Date.now() + CLASS_LIMITS.inviteDays * 86_400_000) } })
    await this.audit.record({ actorId, action: 'classroom.invite', targetType: 'CLASSROOM', targetId: classroom.id, metadata: { userId: found.id, role } })
    await this.events.publish('ClassroomInvited', { inviteId: id, classroomId, userId: found.id, invitedBy: actorId })
    return id
  }

  async answerInvite(actorId: string, inviteId: string, accept: boolean): Promise<string> {
    const inv = await this.db.classroomInvite.findFirst({ where: { id: inviteId, invitedUserId: actorId } })
    if (!inv || inv.acceptedAt || inv.declinedAt || inv.expiresAt <= new Date()) throw Errors.notFound('That invite is not there any more.')
    const { classroom, resource, actor } = await this.require(actorId, inv.classroomId)
    if (!accept) {
      await this.db.classroomInvite.update({ where: { id: inviteId }, data: { declinedAt: new Date() } })
      return classroom.id
    }
    if (!can(actor, Action.CLASSROOM_ACCEPT_INVITE, resource)) throw Errors.forbidden(actor.institutionVerified ? undefined : 'Verify your account to join classes.')
    await this.db.classroomInvite.update({ where: { id: inviteId }, data: { acceptedAt: new Date() } })
    await this.db.classroomJoinRequest.updateMany({ where: { classroomId: classroom.id, userId: actorId, status: 'PENDING' }, data: { status: 'WITHDRAWN' } })
    await this.addMember(classroom, actorId, inv.role as StoredClassRole)
    return classroom.id
  }

  async myInvites(viewerId: string) {
    return this.db.classroomInvite.findMany({ where: { invitedUserId: viewerId, acceptedAt: null, declinedAt: null, expiresAt: { gt: new Date() }, classroom: { deletedAt: null } }, include: { classroom: true }, orderBy: { createdAt: 'desc' } })
  }

  async leave(actorId: string, classroomId: string): Promise<void> {
    const { role } = await this.require(actorId, classroomId)
    if (!role) return
    if (role === 'TEACHER') throw Errors.validation('Hand the class to another teacher before you leave it.')
    await this.db.classroomMember.delete({ where: { classroomId_userId: { classroomId, userId: actorId } } })
    await this.events.publish('ClassroomMembershipChanged', { classroomId, userId: actorId, change: 'LEFT' })
  }

  async removeMember(actorId: string, classroomId: string, userId: string): Promise<void> {
    const { role } = await this.require(actorId, classroomId)
    if (role !== 'TEACHER') throw Errors.forbidden('Only the class’s teacher removes people.')
    if (userId === actorId) throw Errors.validation('Hand the class to another teacher before you leave it.')
    const { count } = await this.db.classroomMember.deleteMany({ where: { classroomId, userId } })
    if (!count) throw Errors.notFound('They are not in this class.')
    await this.audit.record({ actorId, action: 'classroom.member.remove', targetType: 'CLASSROOM', targetId: classroomId, metadata: { userId } })
    await this.events.publish('ClassroomMembershipChanged', { classroomId, userId, change: 'LEFT' })
  }

  /** The teacher makes a member a TA or a student, or hands the class to a teacher (they become a TA). */
  async setRole(actorId: string, classroomId: string, userId: string, next: StoredClassRole): Promise<void> {
    const { role } = await this.require(actorId, classroomId)
    if (role !== 'TEACHER') throw Errors.forbidden('Only the class’s teacher changes roles.')
    const m = await this.db.classroomMember.findUnique({ where: { classroomId_userId: { classroomId, userId } } })
    if (!m || userId === actorId) throw Errors.notFound('They are not in this class.')
    if (next === 'TEACHER') {
      const target = await this.actor(userId)
      if (target.globalRole !== 'TEACHER') throw Errors.validation('Only a teacher can run a class.')
      await this.db.$transaction([
        this.db.classroomMember.update({ where: { classroomId_userId: { classroomId, userId } }, data: { role: 'TEACHER' } }),
        this.db.classroomMember.update({ where: { classroomId_userId: { classroomId, userId: actorId } }, data: { role: 'TA' } }),
        this.db.classroom.update({ where: { id: classroomId }, data: { ownerId: userId } }),
      ])
      await this.events.publish('ClassroomMembershipChanged', { classroomId, userId: actorId, change: 'ROLE_CHANGED', role: 'TA' })
    } else {
      await this.db.classroomMember.update({ where: { classroomId_userId: { classroomId, userId } }, data: { role: next } })
    }
    await this.audit.record({ actorId, action: 'classroom.member.role', targetType: 'CLASSROOM', targetId: classroomId, metadata: { userId, from: m.role, to: next } })
    await this.events.publish('ClassroomMembershipChanged', { classroomId, userId, change: 'ROLE_CHANGED', role: next })
  }

  /** Staff only: a class may have young learners, who are named to nobody else (ADR-0046). */
  async members(viewerId: string, classroomId: string) {
    const { resource, actor } = await this.require(viewerId, classroomId)
    if (!can(actor, Action.CLASSROOM_REVIEW_JOIN_REQUESTS, resource)) throw Errors.forbidden()
    return this.db.classroomMember.findMany({ where: { classroomId }, orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }], take: 2000 })
  }

  async mine(viewerId: string) {
    const rows = await this.db.classroomMember.findMany({ where: { userId: viewerId, classroom: { deletedAt: null } }, include: { classroom: true }, orderBy: { classroom: { updatedAt: 'desc' } }, take: 200 })
    return rows.map((r) => r.classroom)
  }

  // ── Announcements (staff only, ADR-0046) ──

  async post(actorId: string, classroomId: string, body: unknown): Promise<string> {
    const { resource, actor } = await this.require(actorId, classroomId)
    if (!can(actor, Action.CLASSROOM_REVIEW_JOIN_REQUESTS, resource)) throw Errors.forbidden('Only the class’s teacher and TAs post announcements.')
    const doc = docSchema.safeParse(body)
    if (!doc.success) throw Errors.validation('This announcement could not be read.', ['input', 'body'])
    const text = docText(doc.data).trim()
    if (!text) throw Errors.validation('Write something first.', ['input', 'body'])
    if (text.length > CLASS_LIMITS.postChars) throw Errors.validation(`Keep announcements to ${CLASS_LIMITS.postChars} characters.`, ['input', 'body'])
    const rate = await this.limiter.hit(`core:class:post:${actorId}`, { max: CLASS_LIMITS.postsPerHour, windowSeconds: 3600 })
    if (!rate.allowed) throw Errors.rateLimited(rate.retryAfter, 'You have posted a lot in the last hour. Try again later.')
    const id = newId()
    await this.db.$transaction([
      this.db.classroomPost.create({ data: { id, classroomId, authorId: actorId, body: doc.data as Prisma.InputJsonValue } }),
      this.db.classroom.update({ where: { id: classroomId }, data: { updatedAt: new Date() } }),
    ])
    const members = await this.db.classroomMember.findMany({ where: { classroomId, userId: { not: actorId } }, select: { userId: true } })
    for (let i = 0; i < members.length; i += 1000) {
      await this.events.publish('ClassroomPosted', { postId: id, classroomId, authorId: actorId, memberIds: members.slice(i, i + 1000).map((m) => m.userId) })
    }
    return id
  }

  async deletePost(actorId: string, postId: string): Promise<string> {
    const p = await this.db.classroomPost.findFirst({ where: { id: postId, deletedAt: null } })
    if (!p) throw Errors.notFound('Announcement not found.')
    const { resource, actor } = await this.require(actorId, p.classroomId)
    if (!can(actor, Action.CLASSROOM_REVIEW_JOIN_REQUESTS, resource)) throw Errors.forbidden('Only the class’s teacher and TAs remove announcements.')
    await this.db.classroomPost.update({ where: { id: postId }, data: { deletedAt: new Date() } })
    return p.classroomId
  }

  /** PLACES facade (ADR-0050): class names for announcement emails. */
  async classroomNames(ids: string[]): Promise<Record<string, string>> {
    if (!ids.length) return {}
    const rows = await this.db.classroom.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
    return Object.fromEntries(rows.map((r) => [r.id, r.name]))
  }

  /** PLACES facade (ADR-0050): an announcement as its email shows it. */
  async announcement(postId: string): Promise<{ classroomId: string; classroomName: string; authorId: string; text: string } | null> {
    const p = await this.db.classroomPost.findFirst({ where: { id: postId, deletedAt: null, classroom: { deletedAt: null } }, include: { classroom: { select: { name: true } } } })
    if (!p) return null
    const doc = docSchema.safeParse(p.body)
    return { classroomId: p.classroomId, classroomName: p.classroom.name, authorId: p.authorId, text: doc.success ? docText(doc.data).trim() : '' }
  }

  /** An announcement as comments need it (ADR-0047): null unless the viewer is a member; staff moderate. */
  async postPlace(viewerId: string, postId: string): Promise<{ classroomId: string; authorId: string; staff: boolean } | null> {
    const p = await this.db.classroomPost.findFirst({ where: { id: postId, deletedAt: null, OR: [{ moderation: 'OK' }, { authorId: viewerId }] } })
    if (!p) return null
    const loaded = await this.load(viewerId, p.classroomId)
    if (!loaded?.role) return null
    return { classroomId: p.classroomId, authorId: p.authorId, staff: loaded.role === 'TEACHER' || loaded.role === 'TA' }
  }

  async posts(viewerId: string, classroomId: string, size: number, after: [string, string] | null) {
    const { role } = await this.require(viewerId, classroomId)
    if (!role) throw Errors.forbidden()
    return this.db.classroomPost.findMany({
      where: { classroomId, deletedAt: null, AND: [{ OR: [{ moderation: 'OK' }, { authorId: viewerId }] }, ...(after ? [{ OR: [{ createdAt: { lt: new Date(after[0]) } }, { createdAt: new Date(after[0]), id: { lt: after[1] } }] }] : [])] },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: size + 1,
    })
  }
}
