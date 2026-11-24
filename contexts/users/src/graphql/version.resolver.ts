import { Query, Resolver } from '@nestjs/graphql'
import { runningRelease } from '@lvn-backend/config'

/** Public. The running build (VERSIONING.md), not the terms date. */
@Resolver()
export class VersionResolver {
  @Query('version')
  version(): string {
    return runningRelease()
  }
}
