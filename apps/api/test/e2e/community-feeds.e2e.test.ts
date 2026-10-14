import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { createTestApp, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'

/**
 * Community's For You and Trending (ADR-0076): public notes on the person's topics, newest first; the most reacted to
 * and discussed public notes of the last week, each person once and never the owner; blocked people and anything not
 * public left out; a child account's For You follows only chosen topics; a note's preview picture.
 */
describe('community feeds', () => {
  let t: TestApp
  let db: PrismaService
  type Person = { id: string; token: string }
  type Feed = { edges: { node: { id: string } | null; topic: { id: string } | null }[]; pageInfo: { hasNextPage: boolean; endCursor: string | null }; basedOn: { id: string }[] }
  let topics: string[]

  const person = async (opts: { dob?: string } = {}): Promise<Person> => {
    const u = await seedUser(t.app, { verified: true })
    if (opts.dob) await db.user.update({ where: { id: u.id }, data: { dateOfBirth: new Date(opts.dob) } })
    return { id: u.id, token: tokenFor(t.config, u.id) }
  }
  const gql = async <T>(query: string, variables: object, who: Person) => (await t.gql<T>(query, variables as Record<string, unknown>, who.token)).data!
  const doc = (s: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s }] }] })
  /** A published note on a topic, public unless said; returns its id. */
  const note = async (who: Person, title: string, topicId: string, visibility: 'PUBLIC' | 'PRIVATE' = 'PUBLIC') => {
    const id = (await gql<{ createNote: { note: { id: string } } }>('mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } } }', { input: { title, topicIds: [topicId], cards: [{ id: newId(), type: 'text', position: 'a0', content: { doc: doc(title) } }] } }, who)).createNote.note.id
    await gql('mutation ($input: NoteIdInput!) { publishNote(input: $input) { note { id } } }', { input: { noteId: id } }, who)
    if (visibility === 'PUBLIC') await gql('mutation ($input: ChangeNoteVisibilityInput!) { changeNoteVisibility(input: $input) { note { id } } }', { input: { noteId: id, visibility } }, who)
    return id
  }
  const interests = (who: Person, ids: string[]) => gql('mutation ($input: UpdateProfileInput!) { updateProfile(input: $input) { userErrors { message } } }', { input: { interestTopicIds: ids } }, who)
  const forYou = async (who: Person, first?: number, after?: string | null) => (await gql<{ forYouFeed: Feed }>('query ($first: Int, $after: String) { forYouFeed(first: $first, after: $after) { edges { node { id } topic { id } } pageInfo { hasNextPage endCursor } basedOn { id } } }', { first, after }, who)).forYouFeed
  const trending = async (who: Person, first?: number, after?: string | null) => (await gql<{ trendingFeed: Feed }>('query ($first: Int, $after: String) { trendingFeed(first: $first, after: $after) { edges { node { id } topic { id } } pageInfo { hasNextPage endCursor } basedOn { id } } }', { first, after }, who)).trendingFeed
  const react = (who: Person, noteId: string) => gql('mutation ($input: ReactInput!) { react(input: $input) { userErrors { message } } }', { input: { kind: 'HELPFUL', target: { type: 'NOTE', id: noteId } } }, who)
  const comment = (who: Person, noteId: string) => gql('mutation ($input: AddCommentInput!) { addComment(input: $input) { userErrors { message } } }', { input: { target: { type: 'NOTE', id: noteId }, body: doc('Thanks, this helped.') } }, who)
  const block = (who: Person, other: Person) => gql('mutation ($input: PersonInput!) { blockUser(input: $input) { userErrors { message } } }', { input: { userId: other.id } }, who)
  const ids = (f: Feed) => f.edges.map((e) => e.node?.id)

  beforeAll(async () => {
    t = await createTestApp()
    db = t.app.get(PrismaService)
    topics = (await db.topic.findMany({ where: { origin: 'CURATED', children: { none: {} } }, orderBy: { id: 'asc' }, take: 3, select: { id: true } })).map((x) => x.id)
  })
  afterAll(() => t?.close())

  it('For You: public notes on the person’s topics, newest first, page by page; own, private and blocked left out', async () => {
    const me = await person()
    const author = await person()
    const blocked = await person()
    const [t1, t2] = [topics[0]!, topics[1]!]
    await interests(me, [t1])
    const a = await note(author, 'Heaps', t1)
    await note(author, 'Off topic', t2)
    await note(author, 'Private plans', t1, 'PRIVATE')
    await note(me, 'My own heaps', t1)
    const hidden = await note(blocked, 'From someone blocked', t1)
    const c = await note(author, 'Heaps again', t1)
    await block(me, blocked)
    const feed = await forYou(me)
    expect(ids(feed)).toEqual([c, a])
    expect(feed.edges.map((e) => e.topic?.id)).toEqual([t1, t1])
    expect(feed.basedOn.map((x) => x.id)).toEqual([t1])
    expect(ids(feed)).not.toContain(hidden)
    const first = await forYou(me, 1)
    expect(ids(first)).toEqual([c])
    expect(ids(await forYou(me, 1, first.pageInfo.endCursor))).toEqual([a])
    // No topics yet: nothing, and no topics to say it follows.
    const fresh = await person()
    expect(await forYou(fresh)).toMatchObject({ edges: [], basedOn: [] })
  })

  it('For You follows recent reading for an adult, never for a child account (ADR-0026)', async () => {
    const author = await person()
    const t3 = topics[2]!
    const read = await note(author, 'Graphs, read lately', t3)
    const adult = await person()
    const child = await person({ dob: new Date(Date.now() - 12 * 365 * 86_400_000).toISOString().slice(0, 10) })
    for (const who of [adult, child]) await db.learningDayTopic.create({ data: { userId: who.id, day: new Date(), topicKey: `topic:${t3}`, seconds: 900, events: 3 } })
    expect(ids(await forYou(adult))).toContain(read)
    expect(ids(await forYou(child))).not.toContain(read)
  })

  it('Trending: most people reacting and discussing in the last week first, never counting the owner; private and blocked left out', async () => {
    const owner = await person()
    const fans = await Promise.all([person(), person(), person()])
    const me = await person()
    const t1 = topics[0]!
    const hot = await note(owner, 'Hot note', t1)
    const warm = await note(owner, 'Warm note', t1)
    const own = await note(owner, 'Only its owner cares', t1)
    const old = await note(owner, 'Last month', t1)
    for (const f of fans) await react(f, hot)
    await comment(fans[0]!, hot) // the same person again: still one
    await react(fans[1]!, warm)
    await comment(owner, own)
    await react(owner, own)
    await react(fans[2]!, old)
    await db.reaction.updateMany({ where: { targetId: old }, data: { createdAt: new Date(Date.now() - 8 * 86_400_000) } })
    const list = ids(await trending(me))
    expect(list.indexOf(hot)).toBeLessThan(list.indexOf(warm))
    expect(list).not.toContain(own)
    expect(list).not.toContain(old)
    // Pages by position.
    const page = await trending(me, 1)
    expect(page.pageInfo.hasNextPage).toBe(true)
    expect(ids(await trending(me, 1, page.pageInfo.endCursor))).toHaveLength(1)
    // Made private, it leaves; a blocked owner's notes are not shown.
    await gql('mutation ($input: ChangeNoteVisibilityInput!) { changeNoteVisibility(input: $input) { note { id } } }', { input: { noteId: warm, visibility: 'PRIVATE' } }, owner)
    expect(ids(await trending(me))).not.toContain(warm)
    await block(me, owner)
    expect(ids(await trending(me))).not.toContain(hot)
  })

  it('a note’s preview picture: its first picture, as the viewer sees it; null without one', async () => {
    const me = await person()
    const author = await person()
    const plain = await note(author, 'No pictures', topics[0]!)
    const res = await gql<{ note: { previewPicture: unknown } }>('query ($id: UUID!) { note(id: $id) { previewPicture { id url } } }', { id: plain }, me)
    expect(res.note.previewPicture).toBeNull()
  })
})
