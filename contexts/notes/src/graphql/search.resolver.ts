import { Args, Context, Query, Resolver } from '@nestjs/graphql'
import { CurrentViewer, type RequestContext, type Viewer } from '@lvn-backend/auth-guard'
import { clientNetwork } from '@lvn-backend/redis'
import { NotesService } from '../application/notes.service'
import { SearchService } from '../application/search.service'
import { toNote } from './notes.resolver'
import type { QuerySearchArgs } from './schema.types'

@Resolver()
export class SearchResolver {
  constructor(
    private readonly search: SearchService,
    private readonly notes: NotesService,
  ) {}

  @Query('search')
  async searchAll(@Args() { query, scopes, first, filters, after }: QuerySearchArgs, @CurrentViewer() viewer: Viewer | null, @Context() ctx: RequestContext) {
    const viewerId = viewer?.userId ?? null
    const found = await this.search.search(viewerId, query, scopes, first, filters ?? null, after ?? null, clientNetwork(ctx.req.ip))
    const actor = viewerId ? await this.notes.actor(viewerId) : null
    // Opened as the viewer, like any note they read: the hit carries their access and permissions.
    const notes = await Promise.all(found.notes.map(async (hit) => {
      const opened = await this.notes.open(viewerId, hit.noteId, actor ?? undefined)
      return opened ? { note: toNote(opened), snippet: hit.snippet } : null
    }))
    return {
      notes: notes.filter((n) => n !== null),
      notesCursor: found.notesCursor,
      people: found.people.map((id) => ({ __typename: 'User', id })),
      topics: found.topics,
      groups: found.groups.map((id) => ({ __typename: 'Group', id })),
      classrooms: found.classrooms.map((id) => ({ __typename: 'Classroom', id })),
      resources: found.resources.map((id) => ({ __typename: 'Resource', id })),
    }
  }
}
