import { Parent, Query, ResolveField, Resolver } from '@nestjs/graphql'
import { CurrentViewer, type Viewer } from '@lvn-backend/auth-guard'
import { UsersService } from '../application/users.service'
import type { SignInMethod, User } from './schema.types'

@Resolver()
export class ViewerResolver {
  constructor(private readonly users: UsersService) {}

  @Query('viewer')
  async viewer(@CurrentViewer() viewer: Viewer | null): Promise<User | null> {
    if (!viewer) return null
    return this.users.viewerProfile(viewer.userId)
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
