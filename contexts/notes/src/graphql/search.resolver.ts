import { Args, Query, Resolver } from '@nestjs/graphql'
import { CurrentViewer, type Viewer } from '@lvn-backend/auth-guard'
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
  async searchAll(@Args() { query, scopes, first }: QuerySearchArgs, @CurrentViewer() viewer: Viewer | null) {
    const viewerId = viewer?.userId ?? null
    const found = await this.search.search(viewerId, query, scopes, first)
    const actor = viewerId ? await this.notes.actor(viewerId) : null
    // Opened as the viewer, like any note they read: the hit carries their access and permissions.
    const notes = await Promise.all(found.notes.map(async (hit) => {
      const opened = await this.notes.open(viewerId, hit.noteId, actor ?? undefined)
      return opened ? { note: toNote(opened), snippet: hit.snippet } : null
    }))
    return {
      notes: notes.filter((n) => n !== null),
      people: found.people.map((p) => ({ __typename: 'User', id: p.id })),
      topics: found.topics,
    }
  }
}
