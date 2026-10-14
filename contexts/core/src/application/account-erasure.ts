import { Inject, Injectable, type OnModuleInit } from '@nestjs/common'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { PrismaService } from '@lvn-backend/prisma-base'
import { CONTRACT_ROLE } from './groups.service'

/** Who takes over a group from its deleted owner: the highest role, then the longest-standing (mentors never). */
const SUCCESSION = ['ADMIN', 'MODERATOR', 'MEMBER'] as const

/**
 * A deleted account's part of the core context that no feature eraser covers (ADR-0088): old-site progress, reactions,
 * join requests, appeals and mentor invites go; memberships of groups and classes end. A group the person owned passes
 * to its admin (else moderator, else member) who joined first, or closes when nobody is left; a class the person taught
 * passes to another teacher (else a TA), or closes. Posts, comments, doubts and answers stay, by "Deleted user".
 * Idempotent.
 */
@Injectable()
export class CoreAccountErasure implements OnModuleInit {
  constructor(
    private readonly db: PrismaService,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  onModuleInit(): void {
    this.events.subscribe('UserDeleted', ({ payload }) => this.erase(payload.userId))
  }

  async erase(userId: string, now = new Date()): Promise<void> {
    await this.db.$transaction([
      this.db.coreTopicProgress.deleteMany({ where: { userId } }),
      this.db.coreProblemMark.deleteMany({ where: { userId } }),
      this.db.reaction.deleteMany({ where: { userId } }),
      this.db.groupJoinRequest.deleteMany({ where: { userId } }),
      this.db.classroomJoinRequest.deleteMany({ where: { userId } }),
      this.db.moderationAppeal.deleteMany({ where: { userId } }),
      this.db.mentorInvite.deleteMany({ where: { teacherId: userId } }),
    ])
    for (const m of await this.db.groupMember.findMany({ where: { userId }, select: { groupId: true, role: true } })) await this.leaveGroup(userId, m.groupId, m.role === 'OWNER', now)
    for (const m of await this.db.classroomMember.findMany({ where: { userId }, select: { classroomId: true } })) await this.leaveClassroom(userId, m.classroomId, now)
  }

  private async leaveGroup(userId: string, groupId: string, owner: boolean, now: Date): Promise<void> {
    await this.db.groupMember.delete({ where: { groupId_userId: { groupId, userId } } })
    await this.events.publish('GroupMembershipChanged', { groupId, userId, change: 'LEFT' })
    if (!owner) return
    const rest = await this.db.groupMember.findMany({ where: { groupId, role: { in: [...SUCCESSION] } }, select: { userId: true, role: true }, orderBy: { joinedAt: 'asc' } })
    const next = SUCCESSION.map((role) => rest.find((m) => m.role === role)).find(Boolean)
    if (!next) {
      await this.db.group.update({ where: { id: groupId }, data: { deletedAt: now } })
      await this.events.publish('GroupDeleted', { groupId })
      return
    }
    await this.db.$transaction([
      this.db.groupMember.update({ where: { groupId_userId: { groupId, userId: next.userId } }, data: { role: 'OWNER' } }),
      this.db.group.update({ where: { id: groupId }, data: { ownerId: next.userId } }),
    ])
    await this.events.publish('GroupMembershipChanged', { groupId, userId: next.userId, change: 'ROLE_CHANGED', role: CONTRACT_ROLE.OWNER })
  }

  private async leaveClassroom(userId: string, classroomId: string, now: Date): Promise<void> {
    await this.db.classroomMember.delete({ where: { classroomId_userId: { classroomId, userId } } })
    await this.events.publish('ClassroomMembershipChanged', { classroomId, userId, change: 'LEFT' })
    const room = await this.db.classroom.findUnique({ where: { id: classroomId }, select: { ownerId: true, deletedAt: true } })
    if (!room || room.deletedAt || room.ownerId !== userId) return
    const staff = await this.db.classroomMember.findMany({ where: { classroomId, role: { in: ['TEACHER', 'TA'] } }, select: { userId: true, role: true }, orderBy: { joinedAt: 'asc' } })
    const next = staff.find((m) => m.role === 'TEACHER') ?? staff[0]
    if (!next) {
      await this.db.classroom.update({ where: { id: classroomId }, data: { deletedAt: now } })
      await this.events.publish('ClassroomDeleted', { classroomId })
      return
    }
    await this.db.$transaction([
      this.db.classroomMember.update({ where: { classroomId_userId: { classroomId, userId: next.userId } }, data: { role: 'TEACHER' } }),
      this.db.classroom.update({ where: { id: classroomId }, data: { ownerId: next.userId } }),
    ])
    await this.events.publish('ClassroomMembershipChanged', { classroomId, userId: next.userId, change: 'ROLE_CHANGED', role: 'TEACHER' })
  }
}
