import { UseGuards } from '@nestjs/common'
import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { withUserErrors } from '@lvn-backend/errors'
import { instructionsFor, SkillsImportService, type IdentityKind } from '../application/skills-import.service'
import { TeacherProfileService, type TeacherProfileView } from '../application/teacher-profile.service'
import type { MutationAddExternalIdentityArgs, MutationCheckExternalIdentityArgs, MutationDiscardTeacherSkillsArgs, MutationPublishTeacherSkillsArgs, MutationRemoveExternalIdentityArgs, MutationUpdateTeacherProfileArgs, OkPayload } from './schema.types'

type IdentityRow = { id: string; kind: IdentityKind; value: string; code: string; verifiedAt: Date | null; checkedAt: Date | null; fetchedAt: Date | null; lastError: string | null }
const identity = (i: IdentityRow) => ({ id: i.id, kind: i.kind, value: i.value, code: i.code, instructions: instructionsFor(i.kind, i.code), verified: i.verifiedAt !== null, checkedAt: i.checkedAt, fetchedAt: i.fetchedAt, lastError: i.lastError })

/** The Skills tab (ADR-0012, ADR-0044, ADR-0077): public for teachers, edited by the teacher, imported from proven identifiers. */
@Resolver('User')
export class TeacherProfileResolver {
  constructor(
    private readonly profiles: TeacherProfileService,
    private readonly imports: SkillsImportService,
  ) {}

  @ResolveField('teacherProfile')
  teacherProfile(@Parent() u: { id: string }) {
    return this.profiles.view(u.id)
  }

  @Query('mySkillsImport')
  @UseGuards(SignedInGuard)
  async mySkillsImport(@CurrentViewer() viewer: Viewer) {
    const [allowed, rows] = await Promise.all([this.imports.allowed(viewer.userId), this.imports.list(viewer.userId)])
    return { allowed, sources: this.imports.sources(), identities: rows.map(identity) }
  }

  @Mutation('updateTeacherProfile')
  @UseGuards(SignedInGuard)
  updateTeacherProfile(@Args() { input }: MutationUpdateTeacherProfileArgs, @CurrentViewer() viewer: Viewer) {
    // `drafts` is resolved on the profile (TeacherProfileFieldsResolver).
    return withUserErrors(async () => ({ profile: (await this.profiles.update(viewer.userId, input)) as TeacherProfileView | null }), { profile: null })
  }

  @Mutation('addExternalIdentity')
  @UseGuards(SignedInGuard)
  addExternalIdentity(@Args() { input }: MutationAddExternalIdentityArgs, @CurrentViewer() viewer: Viewer) {
    return withUserErrors(async () => ({ identity: identity(await this.imports.add(viewer.userId, input.kind, input.value)) }), { identity: null })
  }

  @Mutation('checkExternalIdentity')
  @UseGuards(SignedInGuard)
  checkExternalIdentity(@Args() { input }: MutationCheckExternalIdentityArgs, @CurrentViewer() viewer: Viewer) {
    return withUserErrors(async () => ({ identity: identity(await this.imports.check(viewer.userId, input.identityId)) }), { identity: null })
  }

  @Mutation('removeExternalIdentity')
  @UseGuards(SignedInGuard)
  removeExternalIdentity(@Args() { input }: MutationRemoveExternalIdentityArgs, @CurrentViewer() viewer: Viewer): Promise<OkPayload> {
    return withUserErrors<OkPayload>(async () => (await this.imports.remove(viewer.userId, input.identityId), { ok: true }), { ok: false })
  }

  @Mutation('publishTeacherSkills')
  @UseGuards(SignedInGuard)
  publishTeacherSkills(@Args() { input }: MutationPublishTeacherSkillsArgs, @CurrentViewer() viewer: Viewer) {
    return withUserErrors(async () => (await this.imports.publish(viewer.userId, input.skillIds), { profile: await this.profiles.view(viewer.userId) }), { profile: null })
  }

  @Mutation('discardTeacherSkills')
  @UseGuards(SignedInGuard)
  discardTeacherSkills(@Args() { input }: MutationDiscardTeacherSkillsArgs, @CurrentViewer() viewer: Viewer) {
    return withUserErrors(async () => (await this.imports.discard(viewer.userId, input.skillIds), { profile: await this.profiles.view(viewer.userId) }), { profile: null })
  }
}

/** A tab's drafts, for its teacher alone (ADR-0077). */
@Resolver('TeacherProfile')
export class TeacherProfileFieldsResolver {
  constructor(private readonly profiles: TeacherProfileService) {}

  @ResolveField('drafts')
  drafts(@Parent() p: TeacherProfileView, @CurrentViewer() viewer: Viewer | null) {
    return viewer?.userId === p.userId ? this.profiles.drafts(p.userId) : null
  }
}
