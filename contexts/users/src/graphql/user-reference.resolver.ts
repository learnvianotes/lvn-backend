import { Resolver, ResolveReference } from '@nestjs/graphql'
import type { RequestContext } from '@lvn-backend/auth-guard'
import { byKeys, requestLoader } from '@lvn-backend/graphql'
import { UsersService } from '../application/users.service'
import type { User } from './schema.types'

/**
 * Users referenced by other subgraphs (a note's owner, a share's recipient): Federation sends `{ __typename: "User",
 * id }` and this resolves it — batched per request, the viewer's own fields only for the viewer (§5: viewer-only
 * fields are null for anyone else). A deleted user resolves to null.
 */
@Resolver('User')
export class UserReferenceResolver {
  constructor(private readonly users: UsersService) {}

  // Apollo calls this with (reference, context, info). No parameter decorators: with any, Nest would rebuild the
  // arguments in the (root, args, context, info) order of ordinary resolvers and drop the reference.
  @ResolveReference()
  async resolveReference(reference: { id: string }, context: RequestContext): Promise<User | null> {
    if (context.viewer?.userId === reference.id) return this.users.viewerProfile(reference.id)
    return requestLoader<string, User | null>(context, 'users.publicProfile', async (ids) => byKeys(ids, await this.users.publicProfiles(ids), (u) => u.id)).load(reference.id)
  }
}
