import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { EVENT_BUS, type InProcessEventBus } from '@lvn-backend/event-bus'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { createTestApp, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'

/** Public note pages (P2d): the list behind the sitemap, and telling the web app when a public page changes. */
describe('public note pages', () => {
  let t: TestApp
  let db: PrismaService
  let web: Server
  const calls: { secret: string | undefined; body: { tags: string[] } }[] = []
  let token: string

  const ERRORS = 'userErrors { field message code }'
  const published = async (title: string) => {
    const created = await t.gql<{ createNote: { note: { id: string } } }>(`mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } ${ERRORS} } }`, { input: { title, cards: [{ id: newId(), type: 'text', position: 'a0', content: { doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: `${title} words` }] }] } } }] } }, token)
    const id = created.data!.createNote.note.id
    await t.gql(`mutation ($input: NoteIdInput!) { publishNote(input: $input) { ${ERRORS} } }`, { input: { noteId: id } }, token)
    return id
  }
  const visibility = (noteId: string, to: string) => t.gql(`mutation ($input: ChangeNoteVisibilityInput!) { changeNoteVisibility(input: $input) { ${ERRORS} } }`, { input: { noteId, visibility: to } }, token)
  const settle = () => (t.app.get(EVENT_BUS) as InProcessEventBus).drain()
  const list = async (after?: string) =>
    (await t.gql<{ publicNotes: { edges: { node: { id: string; slug: string; title: string } }[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } } }>('query ($after: String) { publicNotes(first: 2, after: $after) { edges { node { id slug title } } pageInfo { hasNextPage endCursor } } }', { after })).data!.publicNotes

  beforeAll(async () => {
    // A stand-in for the web app's /api/revalidate.
    web = createServer((req, res) => {
      let raw = ''
      req.on('data', (c: Buffer) => (raw += c.toString()))
      req.on('end', () => {
        calls.push({ secret: req.headers['x-revalidate-secret'] as string | undefined, body: JSON.parse(raw) as { tags: string[] } })
        res.writeHead(200).end('{}')
      })
    })
    await new Promise<void>((resolve) => web.listen(0, '127.0.0.1', resolve))
    const port = (web.address() as AddressInfo).port
    t = await createTestApp({ WEB_REVALIDATE_URL: `http://127.0.0.1:${port}/api/revalidate`, REVALIDATE_SECRET: 's'.repeat(40) })
    db = t.app.get(PrismaService)
    token = tokenFor(t.config, (await seedUser(t.app, { verified: true })).id)
  })

  afterAll(async () => {
    await t.close()
    await new Promise((resolve) => web.close(resolve))
  })

  it('lists public notes anyone may read, newest first, page by page', async () => {
    const a = await published('Arrays')
    const b = await published('Binary trees')
    const c = await published('Caching')
    const hidden = await published('Private one')
    for (const id of [a, b, c]) await visibility(id, 'PUBLIC')
    await db.note.update({ where: { id: c }, data: { moderation: 'PENDING_REVIEW' } })

    const first = await list()
    expect(first.edges.map((e) => e.node)).toEqual([
      { id: b, slug: 'binary-trees', title: 'Binary trees' },
      { id: a, slug: 'arrays', title: 'Arrays' },
    ])
    expect(first.pageInfo.hasNextPage).toBe(false)
    expect(first.edges.map((e) => e.node.id)).not.toContain(hidden)
  })

  it('tells the web app when a public page changes, with the shared secret', async () => {
    const id = await published('Graphs')
    await settle()
    // Not public yet: a published SHARED or PRIVATE note has no public page.
    expect(calls.filter((c) => c.body.tags.includes(`note:${id}`))).toEqual([])

    await visibility(id, 'PUBLIC')
    await settle()
    await t.gql(`mutation ($input: NoteIdInput!) { publishNote(input: $input) { ${ERRORS} } }`, { input: { noteId: id } }, token)
    await settle()
    await visibility(id, 'SHARED')
    await settle()
    const mine = calls.filter((c) => c.body.tags.includes(`note:${id}`))
    expect(mine).toHaveLength(3)
    expect(mine.every((c) => c.secret === 's'.repeat(40) && c.body.tags.includes('public-notes'))).toBe(true)
  })
})
