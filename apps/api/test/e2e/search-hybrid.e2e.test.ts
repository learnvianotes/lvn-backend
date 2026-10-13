import { newId } from '@lvn-backend/prisma-base'
import { SEMANTIC_SEARCH, SearchIndex, type SemanticSearch } from '@lvn-backend/notes'
import { createTestApp, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'

/**
 * Hybrid ranking (§11, ADR-0057): with SEARCH_HYBRID on and a semantic source bound (a stand-in here; pgvector in
 * Phase 5), keyword and semantic ranks are fused; semantic candidates never bring a note the viewer may not read or the
 * filters leave out. Off, or with nothing bound, ranking is keyword only.
 */
describe('search: hybrid ranking', () => {
  let hybrid: TestApp
  let plain: TestApp
  let unbound: TestApp
  const ids: Record<string, string> = {}
  let reader: string
  /** Whatever is asked, the stand-in finds these by meaning, best first. */
  const semantic: SemanticSearch = { similarNotes: async () => [ids.flows!, ids.secret!, ids.search!] }

  const ERRORS = 'userErrors { field message code }'
  const write = async (app: TestApp, token: string, title: string, body: string, visibility: 'PRIVATE' | 'PUBLIC') => {
    const created = await app.gql<{ createNote: { note: { id: string } } }>(`mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } ${ERRORS} } }`, { input: { title, cards: [{ id: newId(), type: 'text', position: 'a0', content: { doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: body }] }] } } }] } }, token)
    const id = created.data!.createNote.note.id
    await app.gql(`mutation ($input: NoteIdInput!) { publishNote(input: $input) { ${ERRORS} } }`, { input: { noteId: id } }, token)
    if (visibility === 'PUBLIC') await app.gql(`mutation ($input: ChangeNoteVisibilityInput!) { changeNoteVisibility(input: $input) { ${ERRORS} } }`, { input: { noteId: id, visibility } }, token)
    return id
  }
  const notes = async (app: TestApp, query: string, filters?: object) => {
    const res = await app.gql<{ search: { notes: { note: { id: string }; snippet: string }[] } }>('query ($q: String!, $filters: SearchFilters) { search(query: $q, scopes: [NOTES], first: 10, filters: $filters) { notes { note { id } snippet } } }', { q: query, filters }, reader)
    return res.data!.search.notes
  }

  // Three apps, one with every provider: slower than one hook's default under the full suite's load.
  beforeAll(async () => {
    hybrid = await createTestApp({ SEARCH_HYBRID: 'true' }, { providers: [[SEMANTIC_SEARCH, semantic]] })
    plain = await createTestApp({}, { resetDatabase: false })
    unbound = await createTestApp({ SEARCH_HYBRID: 'true' }, { resetDatabase: false })
    const person = async (name: string) => {
      const s = await seedUser(hybrid.app, { verified: true, displayName: name, handle: `${name.toLowerCase()}${Date.now()}` })
      return tokenFor(hybrid.config, s.id)
    }
    const owner = await person('Asha')
    const other = await person('Dev')
    reader = await person('Ravi')
    ids.basics = await write(hybrid, owner, 'Graph basics', 'Vertices and edges.', 'PUBLIC')
    ids.search = await write(hybrid, owner, 'Graph search', 'Breadth first, then depth first.', 'PUBLIC')
    ids.flows = await write(hybrid, owner, 'Network flows', 'Max flow equals min cut.', 'PUBLIC')
    ids.secret = await write(hybrid, other, 'My private plans', 'Nobody else reads this.', 'PRIVATE')
    await hybrid.app.get(SearchIndex).drainAll()
  }, 90_000)

  afterAll(async () => {
    await unbound?.close()
    await plain?.close()
    await hybrid?.close()
  })

  it('fuses keyword and semantic ranks: what both find comes first, and meaning alone finds more', async () => {
    const found = await notes(hybrid, 'graph')
    expect(found.map((h) => h.note.id)).toEqual([ids.search, ids.basics, ids.flows])
    // A note found by meaning alone shows how it begins.
    expect(found.find((h) => h.note.id === ids.flows)?.snippet).toBe('Max flow equals min cut.')
  })

  it('never lets meaning bring a note the reader may not read, or one the filters leave out', async () => {
    expect((await notes(hybrid, 'graph')).map((h) => h.note.id)).not.toContain(ids.secret)
    expect(await notes(hybrid, 'graph', { kinds: ['PROJECT'] })).toEqual([])
    expect((await notes(hybrid, 'graph', { sources: ['PUBLIC'] })).map((h) => h.note.id)).toContain(ids.flows)
  })

  it('ranks by keywords alone when the flag is off, or when nothing gives meaning (before Phase 5)', async () => {
    for (const app of [plain, unbound]) {
      const found = (await notes(app, 'graph')).map((h) => h.note.id)
      expect(found.sort()).toEqual([ids.basics, ids.search].sort())
    }
  })
})
