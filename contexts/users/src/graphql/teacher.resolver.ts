import { UseGuards } from '@nestjs/common'
import { Args, Mutation, Parent, ResolveField, Resolver } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { withUserErrors } from '@lvn-backend/errors'
import { TeacherProfileService } from '../application/teacher-profile.service'
import type { MutationUpdateTeacherProfileArgs, TeacherProfilePayload } from './schema.types'

/** The Skills tab (ADR-0012, ADR-0044): public for teachers, edited by the teacher. */
@Resolver('User')
export class TeacherProfileResolver {
  constructor(private readonly profiles: TeacherProfileService) {}

  @ResolveField('teacherProfile')
  teacherProfile(@Parent() u: { id: string }) {
    return this.profiles.view(u.id)
  }

  @Mutation('updateTeacherProfile')
  @UseGuards(SignedInGuard)
  updateTeacherProfile(@Args() { input }: MutationUpdateTeacherProfileArgs, @CurrentViewer() viewer: Viewer): Promise<TeacherProfilePayload> {
    return withUserErrors<TeacherProfilePayload>(async () => ({ profile: await this.profiles.update(viewer.userId, input) }), { profile: null })
  }
}
