import { Args, Context, Parent, ResolveField, Resolver, ResolveReference } from '@nestjs/graphql'
import { type RequestContext } from '@lvn-backend/auth-guard'
import { connection } from '@lvn-backend/graphql'
import { clientNetwork } from '@lvn-backend/redis'
import { NotesService } from '../application/notes.service'
import { toNote } from './notes.resolver'
import type { UserPublicNotesArgs } from './schema.types'

/**
 * What a person made public, on their profile (ADR-0043): `User.publicNotes` by kind — the published versions anyone
 * may read, by the same predicate as public pages and search. The users subgraph owns everything else about a User.
 */
@Resolver('User')
export class UserNotesResolver {
  constructor(private readonly notes: NotesService) {}

  // Apollo calls this with (reference, context, info); see UserReferenceResolver in users for why there are no decorators.
  @ResolveReference()
  resolveReference(reference: { id: string }) {
    return { id: reference.id }
  }

  @ResolveField('publicNotes')
  async publicNotes(@Parent() user: { id: string }, @Args() { kind, first, after }: UserPublicNotesArgs, @Context() ctx: RequestContext) {
    // Anonymous readers are not the owner. Signed-in reads stay on the per-person GraphQL cap.
    if (!ctx.viewer) await this.notes.limitAnonymousPublicRead(clientNetwork(ctx.req.ip))
    const { rows, size } = await this.notes.publicList(first, after, { ownerId: user.id, kind })
    return connection(rows, size, (n) => [n.publishedAt!.toISOString(), n.id], (n) => toNote({ note: n, access: 'READER', shareRole: null, actor: null }))
  }
}
