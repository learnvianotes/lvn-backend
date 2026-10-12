import { InProcessEventBus } from '@lvn-backend/event-bus'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { createTestApp, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'

/**
 * Mentions (ADR-0054): `@handle` in a comment, a group post or an idea tells the person named, once, where they were
 * named — only when they can read it and nothing (a block, a restriction) stands between them and the author.
 */
describe('mentions', () => {
  let t: TestApp
  let db: PrismaService
  let bus: InProcessEventBus
  type Person = { id: string; handle: string; token: string }
  const person = async (name: string): Promise<Person> => {
    const u = await seedUser(t.app, { verified: true, displayName: name })
    return { id: u.id, handle: u.handle, token: tokenFor(t.config, u.id) }
  }
  const text = (s: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s }] }] })
  const gql = async <T>(query: string, variables: object, who: Person) => {
    const res = await t.gql<T>(query, variables as Record<string, unknown>, who.token)
    if (res.errors) throw new Error(res.errors[0]!.message)
    return res.data!
  }
  type Told = { category: string; data: unknown; path: string; actor: { id: string } | null }
  const mentions = async (who: Person): Promise<Told[]> => {
    await bus.drain()
    return (await gql<{ notifications: { edges: { node: Told }[] } }>('{ notifications { edges { node { category data path actor { id } } } } }', {}, who)).notifications.edges.map((e) => e.node).filter((n) => n.category === 'MENTION')
  }
  const note = async (owner: Person, visibility: 'PUBLIC' | 'SHARED', shareWith: Person[] = []) => {
    const id = (await gql<{ createNote: { note: { id: string } } }>('mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } } }', { input: { title: 'Heaps', cards: [{ id: newId(), type: 'text', position: 'a0', content: { doc: text('A heap is a tree.') } }] } }, owner)).createNote.note.id
    await gql('mutation ($id: UUID!) { publishNote(input: { noteId: $id }) { note { id } } }', { id }, owner)
    for (const p of shareWith) await gql('mutation ($input: ShareNoteInput!) { shareNote(input: $input) { note { id } } }', { input: { noteId: id, person: p.handle, role: 'VIEWER' } }, owner)
    await gql('mutation ($id: UUID!, $v: Visibility!) { changeNoteVisibility(input: { noteId: $id, visibility: $v }) { note { id } } }', { id, v: visibility }, owner)
    await bus.drain()
    return id
  }
  const comment = async (who: Person, noteId: string, s: string) =>
    (await gql<{ addComment: { comment: { id: string } } }>('mutation ($input: AddCommentInput!) { addComment(input: $input) { comment { id } } }', { input: { target: { type: 'NOTE', id: noteId }, body: text(s) } }, who)).addComment.comment.id

  beforeAll(async () => {
    t = await createTestApp()
    db = t.app.get(PrismaService)
    bus = t.app.get(InProcessEventBus)
  })
  afterAll(() => t.close())

  it('a comment tells readers it names, not the author, not the note’s owner twice, nor people who blocked or restrict the author', async () => {
    const owner = await person('Owner')
    const author = await person('Author')
    const reader = await person('Reader')
    const blocker = await person('Blocker')
    const restricter = await person('Restricter')
    const noteId = await note(owner, 'PUBLIC')
    await gql('mutation ($input: PersonInput!) { blockUser(input: $input) { user { id } } }', { input: { userId: author.id } }, blocker)
    await gql('mutation ($input: PersonInput!) { restrictUser(input: $input) { user { id } } }', { input: { userId: author.id } }, restricter)
    await bus.drain()

    await comment(author, noteId, `Good point @${reader.handle} @${blocker.handle} @${restricter.handle} @${owner.handle} @${author.handle} @nobodyatall`)
    expect(await mentions(reader)).toEqual([{ category: 'MENTION', data: { entityType: 'COMMENT' }, path: `/notes/${noteId}`, actor: { id: author.id } }])
    expect(await mentions(blocker)).toEqual([])
    expect(await mentions(restricter)).toEqual([])
    expect(await mentions(author)).toEqual([])
    // The owner hears of the comment as a comment, once.
    expect(await mentions(owner)).toEqual([])
    const ownerTold = (await gql<{ notifications: { edges: { node: { category: string } }[] } }>('{ notifications { edges { node { category } } } }', {}, owner)).notifications.edges.map((e) => e.node.category)
    expect(ownerTold).toEqual(['COMMENT'])
  })

  it('only people who can read the note are told; an edit tells only the newly named', async () => {
    const owner = await person('Owner')
    const author = await person('Author')
    const sharedWith = await person('Shared with')
    const outsider = await person('Outsider')
    const later = await person('Later')
    const noteId = await note(owner, 'SHARED', [author, sharedWith, later])
    const commentId = await comment(author, noteId, `@${sharedWith.handle} and @${outsider.handle}, look`)
    expect(await mentions(sharedWith)).toHaveLength(1)
    expect(await mentions(outsider)).toEqual([])

    await gql('mutation ($id: UUID!, $body: JSON!) { editComment(input: { commentId: $id, body: $body }) { comment { id } } }', { id: commentId, body: text(`@${sharedWith.handle} and @${later.handle}, look`) }, author)
    expect(await mentions(sharedWith)).toHaveLength(1)
    expect(await mentions(later)).toHaveLength(1)
  })

  it('a group post or an idea tells the members it names, and at most ten', async () => {
    const owner = await person('Owner')
    const outsider = await person('Outsider')
    const members = await Promise.all(Array.from({ length: 12 }, (_, i) => person(`Member ${i}`)))
    const groupId = (await gql<{ createGroup: { group: { id: string } } }>('mutation { createGroup(input: { name: "Heaps club", privacy: PUBLIC, joinPolicy: OPEN }) { group { id } } }', {}, owner)).createGroup.group.id
    for (const m of members) await gql('mutation ($id: UUID!) { joinGroup(input: { groupId: $id }) { group { id } } }', { id: groupId }, m)
    await bus.drain()

    await gql('mutation ($input: CreateGroupPostInput!) { createGroupPost(input: $input) { post { id } } }', { input: { groupId, body: text(`Welcome @${members[0]!.handle} and @${outsider.handle}`) } }, owner)
    expect(await mentions(members[0]!)).toEqual([{ category: 'MENTION', data: { entityType: 'GROUP_POST' }, path: `/groups/${groupId}`, actor: { id: owner.id } }])
    expect(await mentions(outsider)).toEqual([])

    const everyone = members.map((m) => `@${m.handle}`).join(' ')
    await gql('mutation ($input: CreateGroupPostInput!) { createGroupPost(input: $input) { post { id } } }', { input: { groupId, body: text(`Roll call: ${everyone}`) } }, owner)
    await bus.drain()
    const told = await db.notification.count({ where: { category: 'MENTION', userId: { in: members.slice(1).map((m) => m.id) } } })
    expect(told).toBe(9)
  })

  it('a mention is a category people can switch off', async () => {
    const who = await person('Settings')
    const settings = await gql<{ notificationSettings: { categories: { category: string; push: boolean }[] } }>('{ notificationSettings { categories { category push } } }', {}, who)
    expect(settings.notificationSettings.categories).toContainEqual({ category: 'MENTION', push: true })
  })
})
