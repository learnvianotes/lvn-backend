import { InProcessEventBus } from '@lvn-backend/event-bus'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { createTestApp, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'

/**
 * Groups (§5, ADR-0009, ADR-0011, ADR-0045): who sees and joins which group, requests and their answers, roles, mutes,
 * posts, and notes shared to a group read by its members only.
 */
describe('groups', () => {
  let t: TestApp
  let db: PrismaService
  let bus: InProcessEventBus
  type Person = { id: string; handle: string; token: string }
  const person = async (verified = true, name = 'Someone'): Promise<Person> => {
    const u = await seedUser(t.app, { verified, displayName: name })
    return { id: u.id, handle: u.handle, token: tokenFor(t.config, u.id) }
  }
  /** Mutations whose input type is shared with others */
  const INPUT: Record<string, string> = { joinGroup: 'GroupIdInput', leaveGroup: 'GroupIdInput', deleteGroup: 'GroupIdInput', withdrawGroupJoinRequest: 'JoinRequestIdInput', removeGroupMember: 'GroupMemberInput', deleteGroupPost: 'GroupPostIdInput' }
  type Res<T> = { data?: T; errors?: { message: string; extensions: { code: string } }[] }
  /** Runs a mutation and returns its payload, or the refusal's message. */
  const mutate = async <T = { group: { id: string } | null; userErrors: { message: string }[] }>(name: string, input: object, who: Person): Promise<{ payload?: T; error?: string }> => {
    const selection = name.toLowerCase().includes('post') && name !== 'deleteGroupPost' ? 'post { id pinned } userErrors { message }' : name === 'deleteGroup' ? 'ok userErrors { message }' : 'group { id viewerRole } userErrors { message }'
    const type = INPUT[name] ?? `${name[0]!.toUpperCase()}${name.slice(1)}Input`
    const res = (await t.gql(`mutation ($input: ${type}!) { ${name}(input: $input) { ${selection} } }`, { input }, who.token)) as Res<Record<string, T>>
    const payload = res.data?.[name]
    const problem = (payload as { userErrors?: { message: string }[] } | undefined)?.userErrors?.[0]?.message
    return { payload, error: res.errors?.[0]?.message ?? problem }
  }
  const GROUP = 'id name privacy joinPolicy memberCount viewerRole viewerRequestId viewerCan { join requestJoin post moderate manage delete reviewRequests leave } members { user { id } role } joinRequests { id user { id } message } posts { pinned { id } edges { node { id author { id } pinned viewerCan { edit delete pin } } } }'
  type Group = { id: string; name: string; privacy: string; joinPolicy: string; memberCount: number; viewerRole: string | null; viewerRequestId: string | null; viewerCan: Record<string, boolean>; members: { user: { id: string }; role: string }[] | null; joinRequests: { id: string; user: { id: string }; message: string | null }[] | null; posts: { pinned: { id: string }[]; edges: { node: { id: string; author: { id: string }; pinned: boolean; viewerCan: Record<string, boolean> } }[] } | null }
  const group = async (id: string, who: Person) => ((await t.gql<{ group: Group | null }>(`query ($id: UUID!) { group(id: $id) { ${GROUP} } }`, { id }, who.token)).data?.group ?? null)
  const create = async (who: Person, input: object) => (await mutate('createGroup', input, who)).payload!.group!.id
  const text = (s: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s }] }] })
  const notifications = async (who: Person) => {
    await bus.drain()
    return (await t.gql<{ notifications: { edges: { node: { category: string; data: unknown; group: { id: string } | null; actor: { id: string } | null } }[] } }>('{ notifications { edges { node { category data group { id } actor { id } } } } }', {}, who.token)).data!.notifications.edges.map((e) => e.node)
  }

  let owner: Person
  let asha: Person
  let ravi: Person
  let outsider: Person

  beforeAll(async () => {
    t = await createTestApp()
    db = t.app.get(PrismaService)
    bus = t.app.get(InProcessEventBus)
    owner = await person(true, 'Group Owner')
    asha = await person(true, 'Asha')
    ravi = await person(true, 'Ravi')
    outsider = await person(true, 'Outsider')
  })
  afterAll(() => t.close())

  it('a verified person starts a group and owns it; a private group always approves members', async () => {
    const id = await create(owner, { name: '  Algorithms   study ', description: 'Weekly problems', privacy: 'PRIVATE', joinPolicy: 'OPEN' })
    expect(await group(id, owner)).toMatchObject({ name: 'Algorithms study', privacy: 'PRIVATE', joinPolicy: 'APPROVAL', viewerRole: 'OWNER', memberCount: 1, viewerCan: { manage: true, delete: true, leave: false } })
    const unverifiedGroup = await mutate('createGroup', { name: 'Mine', privacy: 'PUBLIC' }, await person(false))
    expect(unverifiedGroup.error).toBeUndefined()
    expect(unverifiedGroup.payload?.group?.id).toEqual(expect.any(String))
    expect((await mutate('createGroup', { name: 'ab', privacy: 'PUBLIC' }, owner)).error).toMatch(/at least 3 characters/)
  })

  it('a private group is never listed and shows only its name by link; nobody outside sees what is inside', async () => {
    const secret = await create(owner, { name: 'Secret study', privacy: 'PRIVATE' })
    expect(await group(secret, outsider)).toMatchObject({ name: 'Secret study', members: null, posts: null, joinRequests: null, viewerCan: { join: false, requestJoin: true } })
    const open = await create(owner, { name: 'Open study', privacy: 'PUBLIC', joinPolicy: 'OPEN' })
    expect(await group(open, outsider)).toMatchObject({ name: 'Open study', members: null, posts: null, joinRequests: null, viewerCan: { join: true, requestJoin: false } })
    const found = await t.gql<{ discoverGroups: { id: string }[] }>('query ($q: String) { discoverGroups(query: $q) { id } }', { q: 'study' }, outsider.token)
    expect(found.data!.discoverGroups.map((g) => g.id)).toContain(open)
    expect(found.data!.discoverGroups.map((g) => g.id)).not.toContain(secret)
  })

  it('an OPEN public group is joined at once; any other is asked, answered, and the answer told', async () => {
    const open = await create(owner, { name: 'Open joins', privacy: 'PUBLIC', joinPolicy: 'OPEN' })
    expect((await mutate('joinGroup', { groupId: open }, asha)).payload!.group).toMatchObject({ viewerRole: 'MEMBER' })

    const closed = await create(owner, { name: 'Closed joins', privacy: 'PRIVATE' })
    await mutate('createGroup', { name: 'unused', privacy: 'PUBLIC' }, ravi)
    expect((await mutate('joinGroup', { groupId: closed }, ravi)).error).toBe('This group approves its members: ask to join instead.')
    const publicApproval = await create(owner, { name: 'Approval joins', privacy: 'PUBLIC' })
    expect((await mutate('joinGroup', { groupId: publicApproval }, ravi)).error).toBe('This group approves its members: ask to join instead.')
    await mutate('requestToJoinGroup', { groupId: publicApproval, message: 'I study graphs' }, ravi)
    // The person asking sees the group and their own request; the owner sees the request and is told.
    expect((await group(publicApproval, ravi))!.viewerRequestId).toEqual(expect.any(String))
    const asked = (await group(publicApproval, owner))!.joinRequests!
    expect(asked).toEqual([{ id: expect.any(String), user: { id: ravi.id }, message: 'I study graphs' }])
    expect((await notifications(owner)).find((n) => n.category === 'JOIN_REQUEST')).toEqual({ category: 'JOIN_REQUEST', data: null, group: { id: publicApproval }, actor: { id: ravi.id } })

    await mutate('reviewGroupJoinRequest', { requestId: asked[0]!.id, decision: 'APPROVED' }, owner)
    expect((await group(publicApproval, ravi))!.viewerRole).toBe('MEMBER')
    expect((await notifications(ravi)).find((n) => n.category === 'JOIN_DECISION')).toMatchObject({ data: { decision: 'APPROVED' }, group: { id: publicApproval } })
    // Members do not review requests.
    await mutate('requestToJoinGroup', { groupId: publicApproval }, outsider)
    const second = (await group(publicApproval, owner))!.joinRequests![0]!
    expect((await mutate('reviewGroupJoinRequest', { requestId: second.id, decision: 'APPROVED' }, ravi)).error).toBe('Only the group’s admins accept members.')
    await mutate('reviewGroupJoinRequest', { requestId: second.id, decision: 'REJECTED' }, owner)
    expect((await mutate('requestToJoinGroup', { groupId: publicApproval }, outsider)).error).toMatch(/7 days after your last request/)
  })

  it('roles: admins give roles below their own; moderators mute; the owner hands over before leaving', async () => {
    const id = await create(owner, { name: 'Roles', privacy: 'PUBLIC', joinPolicy: 'OPEN' })
    for (const p of [asha, ravi, outsider]) await mutate('joinGroup', { groupId: id }, p)
    await mutate('setGroupRole', { groupId: id, userId: asha.id, role: 'ADMIN' }, owner)
    expect((await mutate('setGroupRole', { groupId: id, userId: ravi.id, role: 'ADMIN' }, asha)).error).toBe('You can only give roles below your own.')
    expect((await mutate('setGroupRole', { groupId: id, userId: ravi.id, role: 'MODERATOR' }, asha)).error).toBeUndefined()
    expect((await mutate('setGroupRole', { groupId: id, userId: owner.id, role: 'MEMBER' }, asha)).error).toBe('You can only do that to members below your own role.')

    // A moderator mutes; a muted member cannot post until it ends.
    const until = new Date(Date.now() + 3_600_000).toISOString()
    expect((await mutate('muteGroupMember', { groupId: id, userId: outsider.id, until }, ravi)).error).toBeUndefined()
    expect((await mutate('createGroupPost', { groupId: id, body: text('hello') }, outsider)).error).toBe('You are muted in this group for now.')
    await mutate('muteGroupMember', { groupId: id, userId: outsider.id, until: null }, ravi)
    expect((await mutate('createGroupPost', { groupId: id, body: text('hello') }, outsider)).error).toBeUndefined()

    expect((await mutate('leaveGroup', { groupId: id }, owner)).error).toBe('Hand the group to another member before you leave it.')
    await mutate('setGroupRole', { groupId: id, userId: asha.id, role: 'OWNER' }, owner)
    expect((await group(id, owner))!.viewerRole).toBe('ADMIN')
    expect((await group(id, asha))!.viewerRole).toBe('OWNER')
    await mutate('removeGroupMember', { groupId: id, userId: owner.id }, asha)
    expect((await group(id, owner))!.viewerRole).toBeNull()
    const audit = await db.auditLog.count({ where: { targetId: id, action: { startsWith: 'group.' } } })
    expect(audit).toBeGreaterThanOrEqual(5)
  })

  it('posts: for members, pinned first; authors edit; moderators remove; a block hides each from the other', async () => {
    const id = await create(owner, { name: 'Posts', privacy: 'PUBLIC', joinPolicy: 'OPEN' })
    for (const p of [asha, ravi]) await mutate('joinGroup', { groupId: id }, p)
    const a = (await mutate<{ post: { id: string } }>('createGroupPost', { groupId: id, body: text('From Asha') }, asha)).payload!.post.id
    const r = (await mutate<{ post: { id: string } }>('createGroupPost', { groupId: id, body: text('From Ravi') }, ravi)).payload!.post.id
    await mutate('pinGroupPost', { postId: a, pinned: true }, owner)
    const seen = (await group(id, owner))!.posts!
    expect(seen.pinned.map((p) => p.id)).toEqual([a])
    expect(seen.edges.map((e) => e.node.id)).toEqual([r])
    expect((await mutate('editGroupPost', { postId: a, body: text('x') }, ravi)).error).toBe('Only its author edits a post.')
    expect((await mutate('createGroupPost', { groupId: id, body: text('   ') }, asha)).error).toBe('Write something first.')
    expect((await group(id, outsider))!.posts).toBeNull()
    expect((await mutate('createGroupPost', { groupId: id, body: text('hi') }, outsider)).error).toBe('Join the group to post in it.')

    await t.gql('mutation ($input: PersonInput!) { blockUser(input: $input) { userErrors { message } } }', { input: { userId: ravi.id } }, asha.token)
    const ashaSees = (await group(id, asha))!.posts!
    expect([...ashaSees.pinned, ...ashaSees.edges.map((e) => e.node)].map((p) => p.id)).toEqual([a])
    const raviSees = (await group(id, ravi))!.posts!
    expect([...raviSees.pinned, ...raviSees.edges.map((e) => e.node)].map((p) => p.id)).toEqual([r])
    await t.gql('mutation ($input: PersonInput!) { unblockUser(input: $input) { userErrors { message } } }', { input: { userId: ravi.id } }, asha.token)

    expect((await mutate('deleteGroupPost', { postId: a }, ravi)).error).toBe('Only its author or a moderator removes a post.')
    await mutate('deleteGroupPost', { postId: r }, owner)
    expect((await group(id, ravi))!.posts!.edges).toEqual([])
  })

  it('notes shared to a group are read by its members only, for as long as they are members', async () => {
    const id = await create(owner, { name: 'Shared notes', privacy: 'PRIVATE' })
    await mutate('requestToJoinGroup', { groupId: id }, asha)
    await mutate('reviewGroupJoinRequest', { requestId: (await group(id, owner))!.joinRequests![0]!.id, decision: 'APPROVED' }, owner)
    await bus.drain()
    const noteId = (await t.gql<{ createNote: { note: { id: string } } }>('mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } } }', { input: { title: 'Week 1 solutions', cards: [{ id: newId(), type: 'text', position: 'a0', content: { doc: text('BFS first') } }] } }, owner.token)).data!.createNote.note.id
    await t.gql('mutation ($input: NoteIdInput!) { publishNote(input: $input) { note { id } } }', { input: { noteId } }, owner.token)
    const shared = await t.gql<{ shareNoteToGroup: { note: { visibility: string; groups: { id: string }[] } } }>('mutation ($input: NoteGroupInput!) { shareNoteToGroup(input: $input) { note { visibility groups { id } } userErrors { message } } }', { input: { noteId, groupId: id } }, owner.token)
    expect(shared.data!.shareNoteToGroup.note).toEqual({ visibility: 'SHARED', groups: [{ id }] })
    const reads = async (who: Person) => (await t.gql<{ note: { id: string } | null }>('query ($id: UUID!) { note(id: $id) { id } }', { id: noteId }, who.token)).data?.note?.id === noteId
    const listed = async (who: Person) => (await t.gql<{ group: { sharedNotes: { edges: { node: { id: string } }[] } | null } | null }>('query ($id: UUID!) { group(id: $id) { sharedNotes { edges { node { id } } } } }', { id }, who.token)).data?.group?.sharedNotes?.edges.map((e) => e.node.id) ?? null
    expect(await reads(asha)).toBe(true)
    expect(await listed(asha)).toEqual([noteId])
    expect(await reads(outsider)).toBe(false)
    expect(await listed(outsider)).toBeNull()
    // Someone not in the group cannot share to it.
    const theirs = (await t.gql<{ createNote: { note: { id: string } } }>('mutation { createNote(input: { title: "x" }) { note { id } } }', {}, outsider.token)).data!.createNote.note.id
    const refused = await t.gql('mutation ($input: NoteGroupInput!) { shareNoteToGroup(input: $input) { note { id } } }', { input: { noteId: theirs, groupId: id } }, outsider.token)
    expect(refused.errors?.[0]?.message).toBe('Share notes only with groups you are in.')
    // Leaving ends it; so does the group's end.
    await mutate('leaveGroup', { groupId: id }, asha)
    await bus.drain()
    expect(await reads(asha)).toBe(false)
    await mutate('requestToJoinGroup', { groupId: id }, ravi)
    await mutate('reviewGroupJoinRequest', { requestId: (await group(id, owner))!.joinRequests![0]!.id, decision: 'APPROVED' }, owner)
    await bus.drain()
    expect(await reads(ravi)).toBe(true)
    await mutate('deleteGroup', { groupId: id }, owner)
    await bus.drain()
    expect(await reads(ravi)).toBe(false)
    expect(await group(id, ravi)).toBeNull()
  })

  it('the plan limits how many groups one owns (ADR-0024)', async () => {
    const free = await db.plan.findUniqueOrThrow({ where: { code: 'FREE' } })
    const row = await db.entitlement.create({ data: { id: newId(), planId: free.id, key: 'GROUPS_OWNED', limit: 1n, appliesToRole: 'STUDENT' } })
    try {
      const fresh = await person(true)
      await create(fresh, { name: 'First', privacy: 'PUBLIC' })
      expect((await mutate('createGroup', { name: 'Second', privacy: 'PUBLIC' }, fresh)).error).toBe("You've reached your plan's limit for groups.")
    } finally {
      await db.entitlement.delete({ where: { id: row.id } })
    }
  })
})
