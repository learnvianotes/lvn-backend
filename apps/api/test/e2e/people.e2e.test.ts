import { InProcessEventBus } from '@lvn-backend/event-bus'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { createTestApp, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'

/**
 * People (ADR-0013, ADR-0014, ADR-0016, ADR-0020, ADR-0043): who may follow whom, what a block cuts and hides, the
 * quiet of a restriction, counts as milestones for others, and profiles that never name a restricted minor.
 */
describe('people', () => {
  let t: TestApp
  let db: PrismaService
  let bus: InProcessEventBus
  type Person = { id: string; handle: string; token: string }
  let asha: Person
  let ravi: Person
  let teacher: Person
  let unverified: Person
  let minor: Person

  const person = async (opts: { verified?: boolean; teacher?: boolean; minor?: boolean; name?: string } = {}): Promise<Person> => {
    const u = await seedUser(t.app, { verified: opts.verified ?? true, globalRole: opts.teacher ? 'TEACHER' : 'STUDENT', displayName: opts.name ?? 'Someone' })
    if (opts.minor) await db.user.update({ where: { id: u.id }, data: { dateOfBirth: new Date('2015-03-01') } })
    return { id: u.id, handle: u.handle, token: tokenFor(t.config, u.id) }
  }
  type Payload = { user: { id: string; relation: { following: boolean; followedBy: boolean; blocked: boolean; restricted: boolean; viewerCan: Record<string, boolean> } | null } | null; userErrors: { message: string; code: string }[] }
  const act = async (mutation: string, who: Person, target: Person) => {
    const res = await t.gql<Record<string, Payload>>(`mutation ($input: PersonInput!) { ${mutation}(input: $input) { user { id relation { following followedBy blocked restricted viewerCan { follow unfollow removeFollower block unblock restrict unrestrict } } } userErrors { message code } } }`, { input: { userId: target.id } }, who.token)
    // Refusals (FORBIDDEN) come as GraphQL errors, invalid input as userErrors (§6.2): both read the same here.
    if (!res.data) return { user: null, userErrors: (res.errors ?? []).map((e) => ({ message: e.message, code: e.extensions.code })) }
    return res.data[mutation]!
  }
  type Profile = { id: string; displayName: string; followerCount: number | null; followingCount: number | null; followerMilestone: number | null; relation: Payload['user'] extends infer U ? (U extends { relation: infer R } ? R : never) : never }
  const profile = async (handle: string, who?: Person) =>
    (await t.gql<{ userByHandle: Profile | null }>('query ($h: String!) { userByHandle(handle: $h) { id displayName followerCount followingCount followerMilestone relation { following followedBy blocked restricted viewerCan { follow unfollow removeFollower block unblock restrict unrestrict } } } }', { h: handle }, who?.token)).data!.userByHandle
  const followers = async (who: Person) => (await t.gql<{ myFollowers: { edges: { node: { id: string } }[] } }>('{ myFollowers { edges { node { id } } } }', {}, who.token)).data!.myFollowers.edges.map((e) => e.node.id)
  const notified = async (who: Person) => {
    await bus.drain()
    return (await t.gql<{ notifications: { edges: { node: { category: string; path: string; actor: { id: string } | null } }[] } }>('{ notifications { edges { node { category path actor { id } } } } }', {}, who.token)).data!.notifications.edges.map((e) => e.node)
  }

  beforeAll(async () => {
    t = await createTestApp()
    db = t.app.get(PrismaService)
    bus = t.app.get(InProcessEventBus)
    asha = await person({ name: 'Asha Rao' })
    ravi = await person({ name: 'Ravi Kumar' })
    teacher = await person({ teacher: true, name: 'Meera Iyer' })
    unverified = await person({ verified: false })
    minor = await person({ minor: true, name: 'Young Learner' })
  })
  afterAll(() => t.close())

  it('a verified person follows teachers and students; the person followed is told, and only they see the count', async () => {
    expect((await act('followUser', asha, teacher)).user!.relation).toMatchObject({ following: true, viewerCan: { follow: false, unfollow: true } })
    await act('followUser', asha, ravi)
    // Teachers follow students too (ADR-0020).
    await act('followUser', teacher, ravi)
    expect(await notified(teacher)).toEqual([{ category: 'FOLLOW', path: `/u/${asha.id}`, actor: { id: asha.id } }])

    expect(await profile(teacher.handle, teacher)).toMatchObject({ followerCount: 1, followingCount: 1, relation: null })
    expect(await profile(teacher.handle, ravi)).toMatchObject({ followerCount: null, followingCount: null, followerMilestone: null, relation: { following: false, followedBy: true } })
    expect(await profile(asha.handle, ravi)).toMatchObject({ relation: { following: false, followedBy: true, viewerCan: { follow: true, removeFollower: true } } })
    // Following twice changes nothing.
    await act('followUser', asha, teacher)
    expect(await followers(teacher)).toEqual([asha.id])
  })

  it('nobody follows themselves or a restricted minor, and an unverified account can follow a teacher', async () => {
    expect((await act('followUser', asha, asha)).userErrors[0]).toMatchObject({ code: 'VALIDATION' })
    expect((await act('followUser', asha, minor)).userErrors[0]).toMatchObject({ code: 'FORBIDDEN', message: "You can't follow this person." })
    expect((await act('followUser', unverified, teacher)).userErrors).toEqual([])
    expect((await act('followUser', unverified, teacher)).user?.relation?.following).toBe(true)
    expect((await t.gql('mutation ($input: PersonInput!) { followUser(input: $input) { userErrors { message } } }', { input: { userId: teacher.id } })).errors?.[0]?.extensions.code).toBe('UNAUTHENTICATED')
  })

  it('a restricted minor has no profile but their own, and is counted among followers but never named', async () => {
    const told = (await notified(teacher)).length
    await act('followUser', minor, teacher)
    // Following causes no notification either, which would name them.
    expect(await notified(teacher)).toHaveLength(told)
    expect(await profile(minor.handle, asha)).toBeNull()
    expect(await profile(minor.id)).toBeNull()
    expect(await profile(minor.handle, minor)).toMatchObject({ id: minor.id, displayName: 'Young Learner' })
    expect(await followers(teacher)).toEqual([asha.id])
    expect((await profile(teacher.handle, teacher))!.followerCount).toBe(2)
  })

  it('finds a profile by handle, with or without @, or by id, for anyone', async () => {
    for (const h of [teacher.handle, `@${teacher.handle}`, teacher.id, teacher.handle.toUpperCase()]) expect((await profile(h))?.id).toBe(teacher.id)
    expect(await profile('nobody-has-this-handle')).toBeNull()
  })

  it('removing a follower is silent', async () => {
    const before = (await notified(asha)).length
    expect((await act('removeFollower', teacher, asha)).userErrors).toEqual([])
    expect(await followers(teacher)).toEqual([])
    expect((await profile(teacher.handle, asha))!.relation).toMatchObject({ following: false })
    expect(await notified(asha)).toHaveLength(before)
  })

  it('a block ends follows both ways, stops new ones and shares both ways, and is never shown to the person blocked', async () => {
    await act('followUser', ravi, asha)
    expect((await profile(ravi.handle, asha))!.relation).toMatchObject({ following: true, followedBy: true })
    expect((await act('blockUser', asha, ravi)).user!.relation).toMatchObject({ blocked: true, following: false, followedBy: false, viewerCan: { follow: false, unblock: true, restrict: false } })
    expect(await followers(asha)).toEqual([])

    // Ravi sees nothing of the block, only that he cannot follow.
    expect((await profile(asha.handle, ravi))!.relation).toMatchObject({ blocked: false, following: false, viewerCan: { follow: false, block: true } })
    expect((await act('followUser', ravi, asha)).userErrors[0]?.message).toBe("You can't follow this person.")

    const share = async (from: Person, to: Person) => {
      const noteId = (await t.gql<{ createNote: { note: { id: string } } }>('mutation { createNote(input: { title: "Blocked share" }) { note { id } } }', {}, from.token)).data!.createNote.note.id
      return (await t.gql('mutation ($input: ShareNoteInput!) { shareNote(input: $input) { userErrors { message } } }', { input: { noteId, person: to.handle, role: 'VIEWER' } }, from.token)).errors?.[0]
    }
    expect(await share(asha, ravi)).toMatchObject({ message: "This note can't be shared with that person.", extensions: { code: 'FORBIDDEN' } })
    expect(await share(ravi, asha)).toMatchObject({ message: "This note can't be shared with that person.", extensions: { code: 'FORBIDDEN' } })

    // People search leaves the other out, both ways.
    const found = async (who: Person, q: string) => (await t.gql<{ search: { people: { id: string }[] } }>('query ($q: String!) { search(query: $q, scopes: [PEOPLE]) { people { id } } }', { q }, who.token)).data!.search.people.map((p) => p.id)
    await db.user.update({ where: { id: ravi.id }, data: { dateOfBirth: new Date('1990-01-01') } })
    await db.user.update({ where: { id: asha.id }, data: { dateOfBirth: new Date('1990-01-01') } })
    expect(await found(teacher, 'Asha Rao')).toContain(asha.id)
    expect(await found(ravi, 'Asha Rao')).not.toContain(asha.id)
    expect(await found(asha, 'Ravi Kumar')).not.toContain(ravi.id)

    const blocked = await t.gql<{ myBlocked: { node: { id: string } }[] }>('{ myBlocked { node { id } } }', {}, asha.token)
    expect(blocked.data!.myBlocked.map((e) => e.node.id)).toEqual([ravi.id])
    const audit = await db.auditLog.findMany({ where: { actorId: asha.id, action: 'user.block' } })
    expect(audit).toHaveLength(1)

    await act('unblockUser', asha, ravi)
    expect((await act('followUser', ravi, asha)).userErrors).toEqual([])
  })

  it('a restricted follower causes no notification; restricting is not for someone blocked', async () => {
    const quiet = await person({ name: 'Quiet One' })
    expect((await act('restrictUser', teacher, quiet)).user!.relation).toMatchObject({ restricted: true, viewerCan: { unrestrict: true } })
    const before = (await notified(teacher)).length
    await act('followUser', quiet, teacher)
    expect(await notified(teacher)).toHaveLength(before)
    expect(await followers(teacher)).toContain(quiet.id)
    // Blocking replaces the restriction; restricting is unavailable while blocked.
    await act('blockUser', teacher, quiet)
    expect((await profile(quiet.handle, teacher))!.relation).toMatchObject({ blocked: true, restricted: false })
    expect((await act('restrictUser', teacher, quiet)).userErrors[0]?.message).toMatch(/Unblock them first/)
    const restricted = await t.gql<{ myRestricted: unknown[] }>('{ myRestricted { node { id } } }', {}, teacher.token)
    expect(restricted.data!.myRestricted).toEqual([])
  })

  it('pages followers newest first', async () => {
    const star = await person({ teacher: true })
    const fans = [await person(), await person(), await person()]
    for (const fan of fans) await act('followUser', fan, star)
    const page = async (after?: string) =>
      (await t.gql<{ myFollowers: { edges: { node: { id: string }; since: string }[]; pageInfo: { hasNextPage: boolean; endCursor: string } } }>('query ($after: String) { myFollowers(first: 2, after: $after) { edges { node { id } since } pageInfo { hasNextPage endCursor } } }', { after }, star.token)).data!.myFollowers
    const first = await page()
    expect(first.edges.map((e) => e.node.id)).toEqual([fans[2]!.id, fans[1]!.id])
    expect(first.pageInfo.hasNextPage).toBe(true)
    expect((await page(first.pageInfo.endCursor)).edges.map((e) => e.node.id)).toEqual([fans[0]!.id])
  })

  it('a profile lists what the person made public, by kind, to anyone', async () => {
    const text = (s: string) => ({ doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s }] }] } })
    const make = async (title: string, kind: string, visibility: 'PUBLIC' | 'PRIVATE') => {
      const id = (await t.gql<{ createNote: { note: { id: string } } }>('mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } } }', { input: { title, kind, cards: [{ id: newId(), type: 'text', position: 'a0', content: text(`${title} body`) }] } }, teacher.token)).data!.createNote.note.id
      await t.gql('mutation ($input: NoteIdInput!) { publishNote(input: $input) { note { id } } }', { input: { noteId: id } }, teacher.token)
      if (visibility === 'PUBLIC') await t.gql('mutation ($input: ChangeNoteVisibilityInput!) { changeNoteVisibility(input: $input) { note { id } } }', { input: { noteId: id, visibility } }, teacher.token)
      return id
    }
    // Blogs, posts and projects are switched on with teacher publications (P3b-2); notes are what exist today.
    await make('Heaps, explained', 'NOTE', 'PUBLIC')
    await make('Why I teach graphs first', 'NOTE', 'PUBLIC')
    await make('Draft thoughts', 'NOTE', 'PRIVATE')
    const titles = async (kind: string | null) =>
      (await t.gql<{ userByHandle: { publicNotes: { edges: { node: { title: string } }[] } } }>('query ($h: String!, $k: NoteKind) { userByHandle(handle: $h) { publicNotes(kind: $k) { edges { node { title } } } } }', { h: teacher.handle, k: kind })).data!.userByHandle.publicNotes.edges.map((e) => e.node.title)
    expect(await titles('NOTE')).toEqual(['Why I teach graphs first', 'Heaps, explained'])
    expect(await titles(null)).toEqual(['Why I teach graphs first', 'Heaps, explained'])
    expect(await titles('BLOG')).toEqual([])
  })
})
