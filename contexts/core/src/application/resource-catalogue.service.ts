import { Inject, Injectable, type OnModuleInit } from '@nestjs/common'
import { Action, can } from '@lvn/contracts/domain'
import { RESOURCE_LIMITS } from '@lvn/contracts/validation'
import { Errors } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { PEOPLE, POLICY, type People, type Policy } from '@lvn-backend/facades'
import { newId, PrismaService, type Prisma } from '@lvn-backend/prisma-base'
import { RateLimiter } from '@lvn-backend/redis'
import type { ResourceTypeKind } from '../domain/resources'
import { ClassroomsService } from './classrooms.service'
import { GroupsService } from './groups.service'
import { ModerationService } from './moderation.service'
import { ResourcesService, type ResourceView } from './resources.service'

export type CatalogueSort = 'POPULAR' | 'NEWEST'
export interface CatalogueFilter {
  type?: ResourceTypeKind | null
  topicId?: string | null
  query?: string | null
}
export type RecommendationPlace = { userId: string } | { groupId: string } | { classroomId: string }
export type RecommendationRow = Prisma.ResourceRecommendationGetPayload<object>

/** Saves that let a resource's page into search engines (ADR-0074, decision 8). */
export const INDEXABLE_AT_SAVES = 3
const MAX_TERMS = 6

/**
 * Finding resources (ADR-0075): the catalogue of approved resources, a person's private Saved list, and recommendations
 * with a reason to a person, a group or a class. Every resource is read through ResourcesService, so a resource that is
 * no longer approved disappears from all of them at once.
 */
@Injectable()
export class ResourceCatalogueService implements OnModuleInit {
  constructor(
    private readonly db: PrismaService,
    private readonly limiter: RateLimiter,
    private readonly resources: ResourcesService,
    private readonly groups: GroupsService,
    private readonly classrooms: ClassroomsService,
    private readonly moderation: ModerationService,
    @Inject(POLICY) private readonly policy: Policy,
    @Inject(PEOPLE) private readonly people: People,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  onModuleInit(): void {
    this.events.subscribe('UserDeleted', ({ payload }) => this.erase(payload.userId))
  }

  // ── The catalogue ────────────────────────────────────────────────────────────────────────────────────────────

  /** Approved resources, filtered and sorted, `size` from `offset`; blocked people's left out. */
  async list(viewerId: string | null, filter: CatalogueFilter, sort: CatalogueSort, offset: number, size: number): Promise<{ items: ResourceView[]; hasMore: boolean }> {
    const terms = (filter.query ?? '').toLowerCase().match(/[\p{L}\p{N}+#.]+/gu)?.slice(0, MAX_TERMS) ?? []
    const hidden = viewerId ? await this.people.blockedIds(viewerId) : []
    const where: Prisma.ResourceWhereInput = {
      status: 'APPROVED',
      ...(filter.type ? { type: filter.type } : {}),
      ...(filter.topicId ? { topics: { some: { topicId: filter.topicId } } } : {}),
      ...(hidden.length ? { submittedById: { notIn: hidden } } : {}),
      AND: terms.map((w) => ({ OR: [{ title: { contains: w, mode: 'insensitive' as const } }, { author: { contains: w, mode: 'insensitive' as const } }, { description: { contains: w, mode: 'insensitive' as const } }] })),
    }
    const orderBy: Prisma.ResourceOrderByWithRelationInput[] = sort === 'POPULAR' ? [{ saves: { _count: 'desc' } }, { createdAt: 'desc' }, { id: 'asc' }] : [{ createdAt: 'desc' }, { id: 'asc' }]
    const rows = await this.db.resource.findMany({ where, orderBy, skip: offset, take: size + 1, select: { id: true } })
    const items = (await Promise.all(rows.slice(0, size).map((r) => this.resources.one(viewerId, r.id)))).filter((r): r is ResourceView => !!r)
    return { items, hasMore: rows.length > size }
  }

  /** How many people saved each resource. */
  async saveCounts(ids: string[]): Promise<Map<string, number>> {
    if (!ids.length) return new Map()
    const counts = await this.db.resourceSave.groupBy({ by: ['resourceId'], where: { resourceId: { in: ids } }, _count: { _all: true } })
    return new Map(counts.map((c) => [c.resourceId, c._count._all]))
  }

  async savedBy(viewerId: string, ids: string[]): Promise<Set<string>> {
    if (!ids.length) return new Set()
    return new Set((await this.db.resourceSave.findMany({ where: { userId: viewerId, resourceId: { in: ids } }, select: { resourceId: true } })).map((s) => s.resourceId))
  }

  // ── Saves ────────────────────────────────────────────────────────────────────────────────────────────────────

  private async approved(viewerId: string | null, resourceId: string): Promise<ResourceView> {
    const r = await this.resources.one(viewerId, resourceId)
    if (!r || r.status !== 'APPROVED') throw Errors.notFound('Resource not found.')
    return r
  }

  async save(viewerId: string, resourceId: string): Promise<void> {
    await this.approved(viewerId, resourceId)
    await this.db.resourceSave.upsert({ where: { resourceId_userId: { resourceId, userId: viewerId } }, create: { resourceId, userId: viewerId }, update: {} })
    // Search ranks resources by their saves.
    await this.events.publish('ResourceChanged', { resourceId })
  }

  async unsave(viewerId: string, resourceId: string): Promise<void> {
    const { count } = await this.db.resourceSave.deleteMany({ where: { resourceId, userId: viewerId } })
    if (count) await this.events.publish('ResourceChanged', { resourceId })
  }

  /** The viewer's Saved list, newest first; resources no longer approved are left out (and come back if approved again). */
  async saved(viewerId: string, offset: number, size: number): Promise<{ items: ResourceView[]; hasMore: boolean }> {
    const rows = await this.db.resourceSave.findMany({ where: { userId: viewerId, resource: { status: 'APPROVED' } }, orderBy: { createdAt: 'desc' }, skip: offset, take: size + 1, select: { resourceId: true } })
    const items = (await Promise.all(rows.slice(0, size).map((r) => this.resources.one(viewerId, r.resourceId)))).filter((r): r is ResourceView => !!r)
    return { items, hasMore: rows.length > size }
  }

  // ── Recommendations ──────────────────────────────────────────────────────────────────────────────────────────

  /**
   * Recommends an approved resource with an optional reason: to a person the viewer follows, is connected to, or shares a
   * group or class with (a child account only from someone in one of their classes); to a group they may post in; or to
   * a class they teach.
   */
  async recommend(viewerId: string, input: { resourceId: string; to: RecommendationPlace; reason?: string | null }): Promise<string> {
    const actor = await this.policy.actor(viewerId)
    if (!can(actor, Action.RESOURCE_RECOMMEND)) throw Errors.forbidden(actor?.suspended ? undefined : 'Verify your account to recommend resources.')
    await this.approved(viewerId, input.resourceId)
    const reason = input.reason?.replace(/\s+/g, ' ').trim() || null
    if (reason && reason.length > RESOURCE_LIMITS.reason) throw Errors.validation(`Keep the reason under ${RESOURCE_LIMITS.reason} characters.`, ['input', 'reason'])
    const flagged = reason ? this.moderation.check(reason) : null
    if (flagged?.flagged) throw Errors.validation(flagged.message ?? 'This reason cannot be sent.', ['input', 'reason'])
    const limit = await this.limiter.hit(`resource-recommendations:${viewerId}`, { max: RESOURCE_LIMITS.recommendationsPerHour, windowSeconds: 3600 })
    if (!limit.allowed) throw Errors.rateLimited(limit.retryAfter, 'You have recommended many resources in the last hour. Try again later.')

    const target = await this.target(viewerId, input.to)
    const id = newId()
    try {
      await this.db.resourceRecommendation.create({ data: { id, resourceId: input.resourceId, fromUserId: viewerId, targetType: target.type, targetId: target.id, reason } })
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') throw Errors.conflict('You have already recommended this there.')
      throw err
    }
    if (target.type === 'USER') await this.events.publish('ResourceRecommended', { resourceId: input.resourceId, fromUserId: viewerId, toUserId: target.id })
    return id
  }

  private async target(viewerId: string, to: RecommendationPlace): Promise<{ type: 'USER' | 'GROUP' | 'CLASSROOM'; id: string }> {
    if ('groupId' in to) {
      const view = await this.groups.view(viewerId, to.groupId)
      if (!view?.role) throw Errors.notFound('Group not found.')
      if (!view.can.post) throw Errors.forbidden('Only people who can post in this group recommend resources to it.')
      return { type: 'GROUP', id: to.groupId }
    }
    if ('classroomId' in to) {
      const view = await this.classrooms.view(viewerId, to.classroomId)
      if (!view?.role) throw Errors.notFound('Class not found.')
      if (!view.can.post) throw Errors.forbidden('Only the class’s teacher and TAs recommend resources to it.')
      return { type: 'CLASSROOM', id: to.classroomId }
    }
    const userId = to.userId
    if (userId === viewerId) throw Errors.validation('Save it instead: it is for you.', ['input', 'to'])
    const contact = await this.people.contactOf(userId)
    if (!contact || (await this.people.blockedBetween(viewerId, userId)) || (await this.people.restricts(userId, viewerId))) throw Errors.notFound('Person not found.')
    const sharesClass = await this.sharedPlace(viewerId, userId, 'class')
    const reachable = contact.restrictedMinor ? sharesClass : sharesClass || (await this.people.connected(viewerId, userId)) || (await this.people.followingIds(viewerId)).includes(userId) || (await this.sharedPlace(viewerId, userId, 'group'))
    if (!reachable) throw Errors.forbidden('Recommend to people you follow, are connected to, or share a group or class with.')
    return { type: 'USER', id: userId }
  }

  private async sharedPlace(a: string, b: string, kind: 'class' | 'group'): Promise<boolean> {
    if (kind === 'class') {
      const mine = (await this.db.classroomMember.findMany({ where: { userId: a, classroom: { deletedAt: null } }, select: { classroomId: true } })).map((m) => m.classroomId)
      return mine.length > 0 && (await this.db.classroomMember.count({ where: { userId: b, classroomId: { in: mine } } })) > 0
    }
    const mine = (await this.db.groupMember.findMany({ where: { userId: a, group: { deletedAt: null } }, select: { groupId: true } })).map((m) => m.groupId)
    return mine.length > 0 && (await this.db.groupMember.count({ where: { userId: b, groupId: { in: mine } } })) > 0
  }

  /** Its sender or its recipient; the moderators of the group or the staff of the class it went to. */
  async canRemove(viewerId: string, r: RecommendationRow): Promise<boolean> {
    if (r.fromUserId === viewerId || (r.targetType === 'USER' && r.targetId === viewerId)) return true
    if (r.targetType === 'GROUP') return !!(await this.groups.view(viewerId, r.targetId))?.can.moderate
    if (r.targetType === 'CLASSROOM') return !!(await this.classrooms.view(viewerId, r.targetId))?.can.post
    return false
  }

  async removeRecommendation(viewerId: string, id: string): Promise<void> {
    const r = await this.db.resourceRecommendation.findUnique({ where: { id } })
    if (!r || !(await this.canRemove(viewerId, r))) throw Errors.notFound('Recommendation not found.')
    await this.db.resourceRecommendation.delete({ where: { id } })
  }

  /** What was recommended to a group or class the viewer is in, newest first; or to the viewer themself. */
  async recommendations(viewerId: string, place: RecommendationPlace, offset: number, size: number): Promise<{ items: (RecommendationRow & { resource: ResourceView })[]; hasMore: boolean }> {
    let where: Prisma.ResourceRecommendationWhereInput
    if ('groupId' in place) {
      if (!(await this.groups.view(viewerId, place.groupId))?.role) throw Errors.notFound('Group not found.')
      where = { targetType: 'GROUP', targetId: place.groupId }
    } else if ('classroomId' in place) {
      if (!(await this.classrooms.view(viewerId, place.classroomId))?.role) throw Errors.notFound('Class not found.')
      where = { targetType: 'CLASSROOM', targetId: place.classroomId }
    } else {
      if (place.userId !== viewerId) throw Errors.forbidden()
      where = { targetType: 'USER', targetId: viewerId }
    }
    const hidden = await this.people.blockedIds(viewerId)
    const rows = await this.db.resourceRecommendation.findMany({
      where: { ...where, resource: { status: 'APPROVED' }, ...(hidden.length ? { fromUserId: { notIn: hidden } } : {}) },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: offset,
      take: size + 1,
    })
    const items: (RecommendationRow & { resource: ResourceView })[] = []
    for (const r of rows.slice(0, size)) {
      const resource = await this.resources.one(viewerId, r.resourceId)
      if (resource) items.push({ ...r, resource })
    }
    return { items, hasMore: rows.length > size }
  }

  // ── Data ─────────────────────────────────────────────────────────────────────────────────────────────────────

  async exportOf(userId: string) {
    const [saves, sent] = await Promise.all([
      this.db.resourceSave.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      this.db.resourceRecommendation.findMany({ where: { fromUserId: userId }, orderBy: { createdAt: 'asc' } }),
    ])
    return {
      saved: saves.map((s) => ({ resourceId: s.resourceId, savedAt: s.createdAt.toISOString() })),
      recommended: sent.map((r) => ({ resourceId: r.resourceId, to: r.targetType, targetId: r.targetId, reason: r.reason, at: r.createdAt.toISOString() })),
    }
  }

  async erase(userId: string): Promise<void> {
    await this.db.$transaction([
      this.db.resourceSave.deleteMany({ where: { userId } }),
      this.db.resourceRecommendation.deleteMany({ where: { OR: [{ fromUserId: userId }, { targetType: 'USER', targetId: userId }] } }),
    ])
  }
}
