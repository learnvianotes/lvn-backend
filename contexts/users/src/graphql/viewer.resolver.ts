import { Query, Resolver } from '@nestjs/graphql'
import { CurrentViewer, type Viewer } from '@lvn-backend/auth-guard'
import { UsersService } from '../application/users.service'
import type { User } from './schema.types'

@Resolver()
export class ViewerResolver {
  constructor(private readonly users: UsersService) {}

  @Query('viewer')
  async viewer(@CurrentViewer() viewer: Viewer | null): Promise<User | null> {
    if (!viewer) return null
    return this.users.viewerProfile(viewer.userId)
  }
}
