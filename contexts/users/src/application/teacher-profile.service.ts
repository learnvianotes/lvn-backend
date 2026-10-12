import { Injectable } from '@nestjs/common'
import { Action, can } from '@lvn/contracts/domain'
import { Errors } from '@lvn-backend/errors'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { AuditService } from './audit.service'
import { PolicyService } from './policy.service'

export const TEACHER_PROFILE_LIMITS = { headline: 120, bio: 2000, skills: 60, name: 120, detail: 500 } as const

export interface TeacherProfileView {
  headline: string | null
  bio: string | null
  skills: { id: string; kind: 'SKILL' | 'QUALIFICATION' | 'EXPERIENCE'; name: string; detail: string | null; source: 'MANUAL' }[]
  updatedAt: Date | null
}

const clean = (value: string | null | undefined) => {
  const v = value?.replace(/\s+/g, ' ').trim()
  return v ? v : null
}

/** The Skills tab (ADR-0012, ADR-0044): what a teacher tells students about themselves, edited by hand for now. */
@Injectable()
export class TeacherProfileService {
  constructor(
    private readonly db: PrismaService,
    private readonly policy: PolicyService,
    private readonly audit: AuditService,
  ) {}

  /** For anyone; null for people who are not teachers. */
  async view(userId: string): Promise<TeacherProfileView | null> {
    const user = await this.db.user.findFirst({ where: { id: userId, deletedAt: null }, select: { globalRole: true, teacherProfile: true, teacherSkills: { orderBy: { position: 'asc' } } } })
    if (!user || user.globalRole !== 'TEACHER') return null
    return {
      headline: user.teacherProfile?.headline ?? null,
      bio: user.teacherProfile?.bio ?? null,
      skills: user.teacherSkills.map((s) => ({ id: s.id, kind: s.kind, name: s.name, detail: s.detail, source: s.source })),
      updatedAt: user.teacherProfile?.updatedAt ?? null,
    }
  }

  async update(actorId: string, input: { headline?: string | null; bio?: string | null; skills: { kind: 'SKILL' | 'QUALIFICATION' | 'EXPERIENCE'; name: string; detail?: string | null }[] }): Promise<TeacherProfileView> {
    const actor = await this.policy.actor(actorId)
    if (!can(actor, Action.TEACHER_EDIT_PROFILE)) throw Errors.forbidden('Only teachers have a Skills tab.')
    const L = TEACHER_PROFILE_LIMITS
    const headline = clean(input.headline)
    const bio = input.bio?.trim() || null
    if (headline && headline.length > L.headline) throw Errors.validation(`Keep the headline to ${L.headline} characters.`, ['input', 'headline'])
    if (bio && bio.length > L.bio) throw Errors.validation(`Keep the bio to ${L.bio} characters.`, ['input', 'bio'])
    if (input.skills.length > L.skills) throw Errors.validation(`At most ${L.skills} items.`, ['input', 'skills'])
    const skills = input.skills.map((s, i) => {
      const name = clean(s.name)
      if (!name) throw Errors.validation('Every item needs a name.', ['input', 'skills', String(i), 'name'])
      if (name.length > L.name) throw Errors.validation(`Keep names to ${L.name} characters.`, ['input', 'skills', String(i), 'name'])
      const detail = clean(s.detail)
      if (detail && detail.length > L.detail) throw Errors.validation(`Keep details to ${L.detail} characters.`, ['input', 'skills', String(i), 'detail'])
      return { id: newId(), userId: actorId, kind: s.kind, name, detail, position: i }
    })
    await this.db.$transaction(async (tx) => {
      await tx.teacherProfile.upsert({ where: { userId: actorId }, create: { userId: actorId, headline, bio }, update: { headline, bio } })
      await tx.teacherSkill.deleteMany({ where: { userId: actorId } })
      if (skills.length) await tx.teacherSkill.createMany({ data: skills })
    })
    await this.audit.record({ actorId, action: 'teacher.profile', targetType: 'USER', targetId: actorId, metadata: { skills: skills.length } })
    return (await this.view(actorId))!
  }
}
