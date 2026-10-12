import { Parent, ResolveField, Resolver } from '@nestjs/graphql'
import { ContributorsService } from '../application/contributors.service'
import type { NoteParent } from './notes.resolver'

/** The people a showcase note credits (ADR-0048); the note itself was already opened with the read rule. */
@Resolver('Note')
export class NoteContributorsResolver {
  constructor(private readonly contributors: ContributorsService) {}

  @ResolveField('contributors')
  async contributorsOf(@Parent() n: NoteParent) {
    return (await this.contributors.of(n.id)).map((c) => ({ user: { __typename: 'User', id: c.userId }, role: c.role }))
  }
}
