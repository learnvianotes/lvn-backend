import { InProcessEventBus } from '@lvn-backend/event-bus'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { createTestApp, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'

/**
 * Feeds (ADR-0049): the Following feed of followed people's PUBLIC notes and publications, and the activity of one's
 * groups and classes, both newest first with keyset pages, leaving out one's own doing and blocked people.
 */
describe('feeds', () => {
  let t: TestApp
  let db: PrismaService
  let bus: InProcessEventBus
  type Person = { id: string; handle: string; token: string }
  const person = async (opts: { teacher?: boolean; name?: string } = {}): Promise<Person> => {
    const u = await seedUser(t.app, { verified: true, globalRole: opts.teacher ? 'TEACHER' : 'STUDENT', displayName: opts.name ?? 'Someone' })
    return { id: u.id, handle: u.handle, token: tokenFor(t.config, u.id) }
  }
  const doc = (s: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s }] }] })
  const gql = async <T>(query: string, variables: object, who: Person) => {
    const res = await t.gql<T>(query, variables as Record<string, unknown>, who.token)
    if (res.errors) throw new Error(res.errors[0]!.message)
    return res.data!
  }
  /** A note, published, at a visibility; returns its id. */
  const note = async (who: Person, title: string, visibility: 'PUBLIC' | 'SHARED' | 'PRIVATE' = 'PUBLIC', kind = 'NOTE') => {
    const id = (await gql<{ createNote: { note: { id: string } } }>('mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } } }', { input: { title, kind, cards: [{ id: newId(), type: 'text', position: 'a0', content: { doc: doc(title) } }] } }, who)).createNote.note.id
    await gql('mutation ($input: NoteIdInput!) { publishNote(input: $input) { note { id } } }', { input: { noteId: id } }, who)
    if (visibility !== 'PRIVATE') await gql('mutation ($input: ChangeNoteVisibilityInput!) { changeNoteVisibility(input: $input) { note { id } } }', { input: { noteId: id, visibility } }, who)
    return id
  }
  const follow = (who: Person, target: Person) => gql('mutation ($input: PersonInput!) { followUser(input: $input) { userErrors { message } } }', { input: { userId: target.id } }, who)
  const following = async (who: Person, first?: number, after?: string) => (await gql<{ followingFeed: { edges: { node: { id: string; title: string } }[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } } }>('query ($first: Int, $after: String) { followingFeed(first: $first, after: $after) { edges { node { id title } } pageInfo { hasNextPage endCursor } } }', { first, after }, who)).followingFeed
  type Item = { key: string; kind: string; actor: { id: string } | null; group: { id: string } | null; classroom: { id: string } | null; post: { id: string } | null; announcement: { id: string } | null; doubt: { id: string; title: string } | null; note: { id: string } | null }
  const activity = async (who: Person, first?: number, after?: string) =>
    (await gql<{ activityFeed: { edges: { node: Item }[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } } }>('query ($first: Int, $after: String) { activityFeed(first: $first, after: $after) { edges { node { key kind actor { id } group { id } classroom { id } post { id } announcement { id } doubt { id title } note { id } } } pageInfo { hasNextPage endCursor } } }', { first, after }, who)).activityFeed

  beforeAll(async () => {
    t = await createTestApp()
    db = t.app.get(PrismaService)
    bus = t.app.get(InProcessEventBus)
  })
  afterAll(() => t.close())

  it('the Following feed: followed people’s public notes and publications, newest first, page by page', async () => {
    const reader = await person({ name: 'Reader' })
    const teacher = await person({ teacher: true, name: 'Ms Rao' })
    const peer = await person({ name: 'Peer' })
    const stranger = await person({ name: 'Stranger' })
    await follow(reader, teacher)
    await follow(reader, peer)
    const first = await note(teacher, 'Heaps, part 1')
    await note(peer, 'Only for friends', 'SHARED')
    await note(stranger, 'Not followed')
    const blog = await note(teacher, 'Why heaps matter', 'PUBLIC', 'BLOG')
    const project = await note(peer, 'Heap visualiser', 'PUBLIC', 'PROJECT')
    expect((await following(reader)).edges.map((e) => e.node.id)).toEqual([project, blog, first])
    const one = await following(reader, 1)
    expect(one.edges.map((e) => e.node.id)).toEqual([project])
    expect(one.pageInfo.hasNextPage).toBe(true)
    expect((await following(reader, 5, one.pageInfo.endCursor!)).edges.map((e) => e.node.id)).toEqual([blog, first])
    // A block takes the person out of the feed, whoever blocked.
    await gql('mutation ($input: PersonInput!) { blockUser(input: $input) { userErrors { message } } }', { input: { userId: reader.id } }, peer)
    expect((await following(reader)).edges.map((e) => e.node.id)).toEqual([blog, first])
    expect((await following(stranger)).edges).toEqual([])
  })

  it('the activity feed: posts, ideas, doubts, announcements and shared notes of one’s places, without one’s own', async () => {
    const me = await person({ name: 'Me' })
    const lead = await person({ name: 'Lead' })
    const teacher = await person({ teacher: true, name: 'Teacher' })
    const groupId = (await gql<{ createGroup: { group: { id: string } } }>('mutation { createGroup(input: { name: "Heap team", privacy: PUBLIC, joinPolicy: OPEN, type: PROJECT }) { group { id } } }', {}, lead)).createGroup.group.id
    await gql('mutation ($id: UUID!) { joinGroup(input: { groupId: $id }) { group { id } } }', { id: groupId }, me)
    const classroomId = (await gql<{ createClassroom: { classroom: { id: string } } }>('mutation { createClassroom(input: { name: "DSA 101" }) { classroom { id } } }', {}, teacher)).createClassroom.classroom.id
    await gql('mutation ($input: InviteToClassroomInput!) { inviteToClassroom(input: $input) { classroom { id } } }', { input: { classroomId, person: me.handle } }, teacher)
    const invite = await db.classroomInvite.findFirstOrThrow({ where: { classroomId, invitedUserId: me.id } })
    await gql('mutation ($input: AnswerClassroomInviteInput!) { answerClassroomInvite(input: $input) { classroom { id } } }', { input: { inviteId: invite.id, accept: true } }, me)
    await bus.drain()

    const postId = (await gql<{ createGroupPost: { post: { id: string } } }>('mutation ($input: CreateGroupPostInput!) { createGroupPost(input: $input) { post { id } } }', { input: { groupId, body: doc('Standup at 5') } }, lead)).createGroupPost.post.id
    await gql('mutation ($input: CreateGroupPostInput!) { createGroupPost(input: $input) { post { id } } }', { input: { groupId, body: doc('My own post') } }, me)
    const ideaId = (await gql<{ createGroupPost: { post: { id: string } } }>('mutation ($input: CreateGroupPostInput!) { createGroupPost(input: $input) { post { id } } }', { input: { groupId, body: doc('Dark mode'), kind: 'IDEA' } }, lead)).createGroupPost.post.id
    const doubtId = (await gql<{ askDoubt: { doubt: { id: string } } }>('mutation ($input: AskDoubtInput!) { askDoubt(input: $input) { doubt { id } } }', { input: { groupId, title: 'Which heap library?', body: doc('Or write our own?') } }, lead)).askDoubt.doubt.id
    await gql('mutation ($input: CreateClassroomPostInput!) { createClassroomPost(input: $input) { classroom { id } } }', { input: { classroomId, body: doc('Quiz on Monday') } }, teacher)
    const announcementId = (await db.classroomPost.findFirstOrThrow({ where: { classroomId } })).id
    const shared = await note(lead, 'Design doc', 'PRIVATE')
    await gql('mutation ($input: NoteGroupInput!) { shareNoteToGroup(input: $input) { note { id } } }', { input: { noteId: shared, groupId } }, lead)

    const items = (await activity(me)).edges.map((e) => e.node)
    expect(items.map((i) => i.kind)).toEqual(['SHARED_NOTE', 'CLASS_ANNOUNCEMENT', 'DOUBT', 'IDEA', 'GROUP_POST'])
    expect(items[0]).toMatchObject({ actor: { id: lead.id }, group: { id: groupId }, note: { id: shared } })
    expect(items[1]).toMatchObject({ actor: { id: teacher.id }, classroom: { id: classroomId }, announcement: { id: announcementId } })
    expect(items[2]).toMatchObject({ doubt: { id: doubtId, title: 'Which heap library?' } })
    expect(items[3]).toMatchObject({ post: { id: ideaId } })
    expect(items[4]).toMatchObject({ post: { id: postId }, group: { id: groupId } })
    expect(new Set(items.map((i) => i.key)).size).toBe(items.length)

    // Page by page, the same order.
    const page1 = await activity(me, 2)
    const page2 = await activity(me, 2, page1.pageInfo.endCursor!)
    const page3 = await activity(me, 2, page2.pageInfo.endCursor!)
    expect([...page1.edges, ...page2.edges, ...page3.edges].map((e) => e.node.kind)).toEqual(items.map((i) => i.kind))
    expect(page3.pageInfo.hasNextPage).toBe(false)

    // A note made private again leaves the feed; a blocked person's doing too.
    await gql('mutation ($input: ChangeNoteVisibilityInput!) { changeNoteVisibility(input: $input) { note { id } } }', { input: { noteId: shared, visibility: 'PRIVATE' } }, lead)
    expect((await activity(me)).edges.map((e) => e.node.kind)).not.toContain('SHARED_NOTE')
    await gql('mutation ($input: PersonInput!) { blockUser(input: $input) { userErrors { message } } }', { input: { userId: lead.id } }, me)
    expect((await activity(me)).edges.map((e) => e.node.kind)).toEqual(['CLASS_ANNOUNCEMENT'])
    // Someone in no group or class has an empty feed.
    expect((await activity(await person())).edges).toEqual([])
  })
})
