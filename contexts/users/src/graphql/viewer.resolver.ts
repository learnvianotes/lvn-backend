import { UseGuards } from '@nestjs/common'
import { Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { withUserErrors } from '@lvn-backend/errors'
import { UsersService } from '../application/users.service'
import type { OkPayload, SignInMethod, User } from './schema.types'

@Resolver()
export class ViewerResolver {
  constructor(private readonly users: UsersService) {}

  @Query('viewer')
  async viewer(@CurrentViewer() viewer: Viewer | null): Promise<User | null> {
    if (!viewer) return null
    return this.users.viewerProfile(viewer.userId)
  }

  @Mutation('acknowledgeSafetyReminder')
  @UseGuards(SignedInGuard)
  acknowledge(@CurrentViewer() viewer: Viewer): Promise<OkPayload> {
    return withUserErrors<OkPayload>(async () => {
      await this.users.acknowledgeSafetyReminder(viewer.userId)
      return { ok: true }
    }, { ok: false })
  }
}

/** Linked sign-in methods are the viewer's own (ADR-0100). Anyone else's User answers null. */
@Resolver('User')
export class UserSignInMethodsResolver {
  constructor(private readonly users: UsersService) {}

  @ResolveField('signInMethods')
  signInMethods(@Parent() user: { id: string }, @CurrentViewer() viewer: Viewer | null): Promise<SignInMethod[] | null> {
    if (!viewer || viewer.userId !== user.id) return Promise.resolve(null)
    return this.users.signInMethods(user.id)
  }
}
