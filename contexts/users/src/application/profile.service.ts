import { Inject, Injectable } from '@nestjs/common'
import type { YearOfStudy } from '@lvn/contracts/domain'
import { Errors } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { isUuid, PrismaService } from '@lvn-backend/prisma-base'

export const MAX_INTERESTS = 50

export interface ProfileInput {
  department?: string | null
  yearOfStudy?: YearOfStudy | null
  interestTopicIds?: string[] | null
  showOnProfile?: boolean | null
}

/** "AI & DS" → "ai ds", "C.S.E." → "c s e": lower-case words for matching departments across spellings. */
export const departmentKey = (department: string): string =>
  department.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/**
 * Department, year of study and interests (ADR-0026): used for the student's own recommendations and AI context,
 * shown on the profile only if they turn it on. Omitted fields stay as they are; null clears a field.
 */
@Injectable()
export class ProfileService {
  constructor(
    private readonly db: PrismaService,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  get(userId: string) {
    return this.db.studentProfile.findUnique({ where: { userId } })
  }

  async update(userId: string, input: ProfileInput) {
    const data: { department?: string | null; departmentKey?: string | null; yearOfStudy?: YearOfStudy | null; interestTopicIds?: string[]; showOnProfile?: boolean } = {}
    if (input.department !== undefined) {
      const department = input.department?.trim() ?? ''
      if (department.length > 80) throw Errors.validation('Use at most 80 characters.', ['input', 'department'])
      data.department = department || null
      data.departmentKey = department ? departmentKey(department) || null : null
    }
    if (input.yearOfStudy !== undefined) data.yearOfStudy = input.yearOfStudy
    if (input.interestTopicIds !== undefined) {
      const ids = [...new Set(input.interestTopicIds ?? [])]
      if (ids.length > MAX_INTERESTS) throw Errors.validation(`Choose at most ${MAX_INTERESTS} interests.`, ['input', 'interestTopicIds'])
      if (!ids.every(isUuid)) throw Errors.validation('Unknown topic.', ['input', 'interestTopicIds'])
      data.interestTopicIds = ids
    }
    if (input.showOnProfile !== undefined && input.showOnProfile !== null) data.showOnProfile = input.showOnProfile

    const profile = await this.db.studentProfile.upsert({ where: { userId }, create: { userId, interestTopicIds: [], ...data }, update: data })
    await this.events.publish('ProfileUpdated', {
      userId,
      interestTopicIds: profile.interestTopicIds,
      ...(profile.department ? { department: profile.department } : {}),
      ...(profile.yearOfStudy ? { yearOfStudy: profile.yearOfStudy } : {}),
    })
    return profile
  }
}
