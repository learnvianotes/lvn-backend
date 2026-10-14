import { Inject, UseGuards } from '@nestjs/common'
import { Args, Mutation, Parent, ResolveField, Resolver } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { withUserErrors } from '@lvn-backend/errors'
import { FILES, type Files } from '@lvn-backend/facades'
import { EntitlementService } from '../application/entitlement.service'
import { LegacyService } from '../application/legacy.service'
import { ProfileService } from '../application/profile.service'
import type { LegacyImport, Limit, LimitKey, MutationUpdateProfileArgs, OkPayload, ProfilePayload, StudentProfile, User } from './schema.types'

const LIMIT_KEYS: LimitKey[] = ['STORAGE_BYTES', 'AI_TOKENS_DAILY', 'PDF_PAGES_MONTHLY', 'GROUPS_OWNED', 'CLASSROOMS_OWNED', 'PROJECT_WORKSPACES', 'EXPORTS_DAILY', 'IMPORTS_DAILY']

type ProfileRow = { department: string | null; yearOfStudy: StudentProfile['yearOfStudy']; interestTopicIds: string[]; showOnProfile: boolean }
const toProfile = (p: ProfileRow, own: boolean): StudentProfile => ({
  department: p.department,
  yearOfStudy: p.yearOfStudy,
  interestTopicIds: own ? p.interestTopicIds : null,
  interests: own ? p.interestTopicIds.map((id) => ({ __typename: 'Topic', id })) : null,
  showOnProfile: p.showOnProfile,
})

@Resolver('User')
export class ProfileResolver {
  constructor(
    private readonly profiles: ProfileService,
    private readonly entitlements: EntitlementService,
    private readonly legacy: LegacyService,
    @Inject(FILES) private readonly files: Files,
  ) {}

  @ResolveField('profile')
  async profile(@Parent() user: User, @CurrentViewer() viewer: Viewer | null): Promise<StudentProfile | null> {
    const p = await this.profiles.get(user.id)
    const own = viewer?.userId === user.id
    if (!p || (!own && !p.showOnProfile)) return null
    return toProfile(p, own)
  }

  @ResolveField('limits')
  async limits(@Parent() user: User, @CurrentViewer() viewer: Viewer | null): Promise<Limit[] | null> {
    if (viewer?.userId !== user.id) return null
    const limits = await this.entitlements.limits(user.id, LIMIT_KEYS)
    const storage = await this.files.storageUsed(user.id)
    // Usage of the other keys is counted by the contexts that own them as they ship (AI in Phase 5, groups in Phase 3).
    return LIMIT_KEYS.map((key) => {
      const limit = limits.get(key)
      return { key, limit: limit === null || limit === undefined ? null : Number(limit), used: key === 'STORAGE_BYTES' ? Number(storage) : 0 }
    })
  }

  @ResolveField('legacyImport')
  async legacyImport(@Parent() user: User, @CurrentViewer() viewer: Viewer | null): Promise<LegacyImport | null> {
    if (viewer?.userId !== user.id) return null
    return this.legacy.status(user.id)
  }

  @Mutation('updateProfile')
  @UseGuards(SignedInGuard)
  updateProfile(@Args() { input }: MutationUpdateProfileArgs, @CurrentViewer() viewer: Viewer): Promise<ProfilePayload> {
    return withUserErrors<ProfilePayload>(async () => ({ profile: toProfile(await this.profiles.update(viewer.userId, input), true) }), { profile: null })
  }

  @Mutation('claimLegacyData')
  @UseGuards(SignedInGuard)
  claimLegacyData(@CurrentViewer() viewer: Viewer): Promise<OkPayload> {
    return withUserErrors<OkPayload>(async () => {
      await this.legacy.claim(viewer.userId)
      return { ok: true }
    }, { ok: false })
  }

  @Mutation('declineLegacyData')
  @UseGuards(SignedInGuard)
  declineLegacyData(@CurrentViewer() viewer: Viewer): Promise<OkPayload> {
    return withUserErrors<OkPayload>(async () => {
      await this.legacy.decline(viewer.userId)
      return { ok: true }
    }, { ok: false })
  }
}
