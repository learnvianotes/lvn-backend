import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { WorkspacesService } from '@lvn-backend/core'
import { InProcessEventBus } from '@lvn-backend/event-bus'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { createTestApp, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'

/**
 * Project workspaces (ADR-0015, ADR-0048): a PROJECT group's repository card from a provider's public API (a stub of
 * GitHub's here), the ideas board ranked by reactions, mentors by invitation, doubts from ask to resolve, and the
 * showcase note that credits the team on their profiles.
 */
describe('project workspaces', () => {
  let t: TestApp
  let db: PrismaService
  let bus: InProcessEventBus
  let github: Server
  let stars = 42
  type Person = { id: string; handle: string; token: string }
  const person = async (opts: { teacher?: boolean; minor?: boolean; name?: string } = {}): Promise<Person> => {
    const u = await seedUser(t.app, { verified: true, globalRole: opts.teacher ? 'TEACHER' : 'STUDENT', displayName: opts.name ?? 'Someone' })
    if (opts.minor) await db.user.update({ where: { id: u.id }, data: { dateOfBirth: new Date('2015-03-01') } })
    return { id: u.id, handle: u.handle, token: tokenFor(t.config, u.id) }
  }
  const doc = (s: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s }] }] })
  type Res<T> = { data?: T; errors?: { message: string; extensions: { code: string } }[] }
  /** A mutation's payload, and its refusal or invalid input as one message and code. */
  const act = async <T = Record<string, unknown>>(name: string, input: object, who: Person, selection = 'group { id } userErrors { message code }') => {
    const type = `${name[0]!.toUpperCase()}${name.slice(1)}Input`.replace('ResolveDoubtInput', 'DoubtIdInput').replace('ReopenDoubtInput', 'DoubtIdInput').replace('DeleteDoubtInput', 'DoubtIdInput').replace('RemoveGroupMemberInput', 'GroupMemberInput')
    const res = (await t.gql(`mutation ($input: ${type}!) { ${name}(input: $input) { ${selection} } }`, { input }, who.token)) as Res<Record<string, T & { userErrors?: { message: string; code: string }[] }>>
    const payload = res.data?.[name]
    return { payload, error: res.errors?.[0]?.message ?? payload?.userErrors?.[0]?.message, code: res.errors?.[0]?.extensions.code ?? payload?.userErrors?.[0]?.code }
  }
  const workspace = async (owner: Person, name = 'Heap visualiser') => (await t.gql<{ createGroup: { group: { id: string } } }>('mutation ($input: CreateGroupInput!) { createGroup(input: $input) { group { id } } }', { input: { name, privacy: 'PUBLIC', joinPolicy: 'OPEN', type: 'PROJECT' } }, owner.token)).data!.createGroup.group.id
  const join = (groupId: string, who: Person) => t.gql('mutation ($id: UUID!) { joinGroup(input: { groupId: $id }) { group { id } } }', { id: groupId }, who.token)
  const group = async <T>(id: string, who: Person, selection: string) => (await t.gql<{ group: T | null }>(`query ($id: UUID!) { group(id: $id) { ${selection} } }`, { id }, who.token)).data?.group ?? null
  const notifications = async (who: Person, category: string) => {
    await bus.drain()
    return (await t.gql<{ notifications: { edges: { node: { category: string; data: unknown; path: string; actor: { id: string } | null } }[] } }>('{ notifications { edges { node { category data path actor { id } } } } }', {}, who.token)).data!.notifications.edges.map((e) => e.node).filter((n) => n.category === category)
  }
  const mentorOf = async (groupId: string, owner: Person) => {
    const teacher = await person({ teacher: true, name: 'Mentor Meera' })
    await act('inviteMentor', { groupId, person: teacher.handle }, owner)
    const invite = await db.mentorInvite.findFirstOrThrow({ where: { groupId, teacherId: teacher.id } })
    await act('answerMentorInvite', { inviteId: invite.id, accept: true }, teacher)
    await bus.drain()
    return teacher
  }

  let owner: Person
  let asha: Person

  beforeAll(async () => {
    // GitHub's public API, as far as these tests need it.
    github = createServer((req, res) => {
      res.setHeader('content-type', 'application/json')
      if (req.url === '/repos/team/heap-viz') return res.end(JSON.stringify({ full_name: 'team/heap-viz', description: 'Watch a heap grow', language: 'TypeScript', stargazers_count: stars, pushed_at: '2026-10-10T09:00:00Z', private: false }))
      res.statusCode = 404
      res.end(JSON.stringify({ message: 'Not Found' }))
    })
    await new Promise<void>((resolve) => github.listen(0, '127.0.0.1', resolve))
    t = await createTestApp({ GITHUB_API_URL: `http://127.0.0.1:${(github.address() as AddressInfo).port}` })
    db = t.app.get(PrismaService)
    bus = t.app.get(InProcessEventBus)
    owner = await person({ name: 'Team Lead' })
    asha = await person({ name: 'Asha' })
  })
  afterAll(async () => {
    await t.close()
    await new Promise((resolve) => github.close(resolve))
  })

  it('a workspace is a PROJECT group; ideas are only for workspaces', async () => {
    const id = await workspace(owner)
    expect(await group(id, owner, 'type viewerCan { askDoubt inviteMentor manage }')).toEqual({ type: 'PROJECT', viewerCan: { askDoubt: true, inviteMentor: true, manage: true } })
    const plain = (await t.gql<{ createGroup: { group: { id: string } } }>('mutation { createGroup(input: { name: "Plain", privacy: PUBLIC }) { group { id } } }', {}, owner.token)).data!.createGroup.group.id
    expect((await act('createGroupPost', { groupId: plain, body: doc('An idea'), kind: 'IDEA' }, owner, 'post { id } userErrors { message code }')).error).toBe('Ideas are for project workspaces.')
    expect(await group(plain, owner, 'repository { url } ideas { id } doubts { edges { node { id } } }')).toEqual({ repository: null, ideas: null, doubts: null })
  })

  it('the repository card shows public details from the provider, or just the link', async () => {
    const id = await workspace(owner)
    await join(id, asha)
    expect((await act('setGroupRepository', { groupId: id, url: 'https://github.com/team/heap-viz' }, asha)).code).toBe('FORBIDDEN')
    expect((await act('setGroupRepository', { groupId: id, url: 'https://example.com/team/heap-viz' }, owner)).error).toBe('Link a repository on github.com or gitlab.com, like https://github.com/owner/project.')
    expect((await act('setGroupRepository', { groupId: id, url: 'https://github.com/team/../etc' }, owner)).code).toBe('VALIDATION')
    await act('setGroupRepository', { groupId: id, url: 'https://github.com/team/heap-viz.git' }, owner)
    const card = 'repository { provider url available name description language stars pushedAt }'
    expect(await group(id, asha, card)).toEqual({ repository: { provider: 'GITHUB', url: 'https://github.com/team/heap-viz', available: true, name: 'team/heap-viz', description: 'Watch a heap grow', language: 'TypeScript', stars: 42, pushedAt: '2026-10-10T09:00:00.000Z' } })
    // Anyone who sees a public workspace sees its card.
    expect((await group<{ repository: { url: string } }>(id, await person(), card))!.repository.url).toBe('https://github.com/team/heap-viz')
    // Refreshed each night once a day old.
    stars = 50
    await db.groupRepository.update({ where: { groupId: id }, data: { refreshedAt: new Date(Date.now() - 2 * 86_400_000) } })
    expect(await t.app.get(WorkspacesService).refreshStale()).toBeGreaterThanOrEqual(1)
    expect((await group<{ repository: { stars: number } }>(id, owner, card))!.repository.stars).toBe(50)
    // One the provider does not show is the link alone; GitLab without its API configured too.
    await act('setGroupRepository', { groupId: id, url: 'https://github.com/team/secret' }, owner)
    expect(await group(id, owner, card)).toEqual({ repository: { provider: 'GITHUB', url: 'https://github.com/team/secret', available: false, name: null, description: null, language: null, stars: null, pushedAt: null } })
    await act('setGroupRepository', { groupId: id, url: 'https://gitlab.com/uni/club/heap-viz' }, owner)
    expect((await group<{ repository: { provider: string; available: boolean } }>(id, owner, card))!.repository).toMatchObject({ provider: 'GITLAB', available: false })
    await act('setGroupRepository', { groupId: id, url: null }, owner)
    expect((await group<{ repository: unknown }>(id, owner, card))!.repository).toBeNull()
  })

  it('the ideas board ranks ideas by reactions; posts leave ideas out', async () => {
    const id = await workspace(owner)
    await join(id, asha)
    const idea = async (who: Person, s: string) => (await act<{ post: { id: string } }>('createGroupPost', { groupId: id, body: doc(s), kind: 'IDEA' }, who, 'post { id kind } userErrors { message code }')).payload!.post.id
    const first = await idea(owner, 'Animate sift-down')
    const second = await idea(asha, 'Dark mode')
    await act('createGroupPost', { groupId: id, body: doc('Meeting at 5') }, owner, 'post { id } userErrors { message }')
    for (const who of [owner, asha]) await t.gql('mutation ($input: ReactInput!) { react(input: $input) { reactions { viewerReaction } } }', { input: { target: { type: 'GROUP_POST', id: first }, kind: 'LIKE' } }, who.token)
    const board = await group<{ ideas: { id: string; kind: string }[]; posts: { edges: { node: { kind: string } }[] } }>(id, asha, 'ideas { id kind } posts { edges { node { kind } } }')
    expect(board!.ideas.map((i) => i.id)).toEqual([first, second])
    expect(board!.posts.edges.map((e) => e.node.kind)).toEqual(['POST'])
    expect(await group(id, await person(), 'ideas { id }')).toEqual({ ideas: null })
  })

  it('admins invite a teacher to mentor; the teacher accepts and joins as mentor, without admin powers', async () => {
    const id = await workspace(owner)
    await join(id, asha)
    expect((await act('inviteMentor', { groupId: id, person: asha.handle }, owner)).error).toBe('Mentors are teachers. Invite a teacher.')
    const teacher = await person({ teacher: true, name: 'Ms Rao' })
    expect((await act('inviteMentor', { groupId: id, person: teacher.handle }, asha)).code).toBe('FORBIDDEN')
    await act('inviteMentor', { groupId: id, person: teacher.handle }, owner)
    await act('inviteMentor', { groupId: id, person: teacher.handle }, owner)
    expect(await db.mentorInvite.count({ where: { groupId: id } })).toBe(1)
    expect(await notifications(teacher, 'MENTOR_INVITE')).toEqual([{ category: 'MENTOR_INVITE', data: null, path: `/groups/${id}`, actor: { id: owner.id } }])
    const invites = await t.gql<{ myMentorInvites: { id: string; group: { id: string; name: string }; invitedBy: { id: string } }[] }>('{ myMentorInvites { id group { id name } invitedBy { id } } }', {}, teacher.token)
    expect(invites.data!.myMentorInvites).toEqual([{ id: expect.any(String), group: { id, name: 'Heap visualiser' }, invitedBy: { id: owner.id } }])
    expect(await group(id, teacher, 'viewerMentorInviteId viewerCan { acceptMentorInvite }')).toEqual({ viewerMentorInviteId: invites.data!.myMentorInvites[0]!.id, viewerCan: { acceptMentorInvite: true } })
    await act('answerMentorInvite', { inviteId: invites.data!.myMentorInvites[0]!.id, accept: true }, teacher)
    expect(await group(id, teacher, 'viewerRole viewerCan { manage reviewRequests askDoubt moderate }')).toEqual({ viewerRole: 'MENTOR', viewerCan: { manage: false, reviewRequests: false, askDoubt: false, moderate: true } })
    // A mentor stays a mentor: no other role, and the workspace is not handed to them; the owner can remove them.
    expect((await act('setGroupRole', { groupId: id, userId: teacher.id, role: 'ADMIN' }, owner)).error).toBe('A mentor stays a mentor. Remove them to end it.')
    expect((await act('setGroupRole', { groupId: id, userId: teacher.id, role: 'OWNER' }, owner)).error).toBe('A mentor stays a mentor. Remove them to end it.')
    expect(await group(id, teacher, 'viewerRole')).toEqual({ viewerRole: 'MENTOR' })
    expect((await act('removeGroupMember', { groupId: id, userId: teacher.id }, owner)).error).toBeUndefined()
    expect(await group(id, teacher, 'viewerRole')).toEqual({ viewerRole: null })
  })

  it('doubts: the team asks, the mentor answers, the asker resolves; everyone concerned is told', async () => {
    const id = await workspace(owner)
    await join(id, asha)
    const mentor = await mentorOf(id, owner)
    const asked = await act<{ doubt: { id: string; status: string } }>('askDoubt', { groupId: id, title: 'Why does sift-down swap twice?', body: doc('See the loop'), repoRef: 'src/heap.ts:42' }, asha, 'doubt { id status repoRef viewerCan { answer resolve reopen delete } } userErrors { message code }')
    expect(asked.payload!.doubt).toEqual({ id: expect.any(String), status: 'OPEN', repoRef: 'src/heap.ts:42', viewerCan: { answer: true, resolve: true, reopen: false, delete: true } })
    const doubtId = asked.payload!.doubt.id
    expect(await notifications(mentor, 'DOUBT')).toEqual([{ category: 'DOUBT', data: { kind: 'ASKED' }, path: `/groups/${id}/doubts/${doubtId}`, actor: { id: asha.id } }])
    expect((await act('askDoubt', { groupId: id, title: 'Mentor question', body: doc('?') }, mentor, 'doubt { id } userErrors { message code }')).error).toBe('The team asks doubts.')

    const answered = await act<{ doubt: { status: string; answers: { byMentor: boolean; author: { id: string } }[] } }>('answerDoubt', { doubtId, body: doc('It swaps the larger child') }, mentor, 'doubt { status answerCount answers { byMentor author { id } } } userErrors { message }')
    expect(answered.payload!.doubt).toEqual({ status: 'ANSWERED', answerCount: 1, answers: [{ byMentor: true, author: { id: mentor.id } }] })
    expect((await notifications(asha, 'DOUBT'))[0]).toMatchObject({ data: { kind: 'ANSWERED', byMentor: true }, actor: { id: mentor.id } })
    await act('resolveDoubt', { doubtId }, asha, 'doubt { status } userErrors { message }')
    expect((await act('answerDoubt', { doubtId, body: doc('More') }, owner, 'doubt { id } userErrors { message }')).error).toBe('This doubt is resolved. Reopen it to answer.')
    expect((await act('reopenDoubt', { doubtId }, owner, 'doubt { status } userErrors { message code }')).code).toBe('FORBIDDEN')
    expect((await act<{ doubt: { status: string } }>('reopenDoubt', { doubtId }, mentor, 'doubt { status } userErrors { message }')).payload!.doubt.status).toBe('ANSWERED')
    await act('resolveDoubt', { doubtId }, mentor, 'doubt { status } userErrors { message }')
    expect((await notifications(asha, 'DOUBT'))[0]).toMatchObject({ data: { kind: 'RESOLVED' }, actor: { id: mentor.id } })

    const listed = await group<{ doubts: { edges: { node: { id: string; status: string } }[] } }>(id, owner, 'doubts(status: RESOLVED) { edges { node { id status } } }')
    expect(listed!.doubts.edges.map((e) => e.node)).toEqual([{ id: doubtId, status: 'RESOLVED' }])
    // Outside the team, nothing.
    const outsider = await person()
    expect((await t.gql<{ doubt: unknown }>('query ($id: UUID!) { doubt(id: $id) { id } }', { id: doubtId }, outsider.token)).data!.doubt).toBeNull()
    expect(await group(id, outsider, 'doubts { edges { node { id } } }')).toEqual({ doubts: null })
    expect((await act('answerDoubt', { doubtId, body: doc('Me too') }, outsider, 'doubt { id } userErrors { message code }')).code).toBe('NOT_FOUND')
    expect((await act('askDoubt', { groupId: id, title: 'Buy followers here, cheap.', body: doc('x') }, asha, 'doubt { id } userErrors { message }')).error).toBe("This doubt can't be posted: it contains words linked to spam.")
  })

  it('the showcase credits the team and the mentor on their profiles, never a restricted minor', async () => {
    const id = await workspace(owner, 'Showcased')
    await join(id, asha)
    const minor = await person({ minor: true })
    await join(id, minor)
    const mentor = await mentorOf(id, owner)
    const make = async (kind: 'PROJECT' | 'NOTE') => {
      const noteId = (await t.gql<{ createNote: { note: { id: string } } }>('mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } } }', { input: { title: `Heap visualiser ${kind}`, kind, cards: [{ id: newId(), type: 'text', position: 'a0', content: { doc: doc('What we built') } }] } }, asha.token)).data!.createNote.note.id
      await t.gql('mutation ($input: NoteIdInput!) { publishNote(input: $input) { note { id } } }', { input: { noteId } }, asha.token)
      await t.gql('mutation ($input: ChangeNoteVisibilityInput!) { changeNoteVisibility(input: $input) { note { id } } }', { input: { noteId, visibility: 'PUBLIC' } }, asha.token)
      return noteId
    }
    const project = await make('PROJECT')
    expect((await act('setProjectShowcase', { groupId: id, noteId: project }, owner)).error).toBe('Share the note with the workspace first.')
    await t.gql('mutation ($input: NoteGroupInput!) { shareNoteToGroup(input: $input) { note { id } } }', { input: { noteId: project, groupId: id } }, asha.token)
    const plain = await make('NOTE')
    await t.gql('mutation ($input: NoteGroupInput!) { shareNoteToGroup(input: $input) { note { id } } }', { input: { noteId: plain, groupId: id } }, asha.token)
    expect((await act('setProjectShowcase', { groupId: id, noteId: plain }, owner)).error).toBe('The showcase is a project note.')
    expect((await act('setProjectShowcase', { groupId: id, noteId: project }, asha)).code).toBe('FORBIDDEN')
    await act('setProjectShowcase', { groupId: id, noteId: project }, owner)
    await bus.drain()

    const credits = async () => (await t.gql<{ note: { contributors: { user: { id: string }; role: string }[] } }>('query ($id: UUID!) { note(id: $id) { contributors { user { id } role } } }', { id: project })).data!.note.contributors
    expect(await credits()).toEqual(expect.arrayContaining([{ user: { id: mentor.id }, role: 'MENTOR' }, { user: { id: owner.id }, role: 'CONTRIBUTOR' }, { user: { id: asha.id }, role: 'CONTRIBUTOR' }]))
    expect((await credits()).map((c) => c.user.id)).not.toContain(minor.id)
    expect((await group<{ showcase: { id: string } }>(id, owner, 'showcase { id }'))!.showcase).toEqual({ id: project })
    // On the owner's Projects tab, though Asha wrote it.
    const projects = await t.gql<{ userByHandle: { publicNotes: { edges: { node: { id: string } }[] } } }>('query ($h: String!) { userByHandle(handle: $h) { publicNotes(kind: PROJECT) { edges { node { id } } } } }', { h: owner.handle }, asha.token)
    expect(projects.data!.userByHandle.publicNotes.edges.map((e) => e.node.id)).toContain(project)
    // Joining credits the newcomer; clearing the showcase credits nobody.
    const late = await person()
    await join(id, late)
    await bus.drain()
    expect((await credits()).map((c) => c.user.id)).toContain(late.id)
    await act('setProjectShowcase', { groupId: id, noteId: null }, owner)
    await bus.drain()
    expect(await credits()).toEqual([])
  })

  it('the plan limits project workspaces apart from groups (ADR-0024)', async () => {
    const free = await db.plan.findUniqueOrThrow({ where: { code: 'FREE' } })
    const row = await db.entitlement.create({ data: { id: newId(), planId: free.id, key: 'PROJECT_WORKSPACES', limit: 1n, appliesToRole: 'STUDENT' } })
    try {
      const fresh = await person()
      await workspace(fresh, 'First')
      expect((await t.gql<{ createGroup: { userErrors: { message: string }[] } }>('mutation { createGroup(input: { name: "Second", privacy: PUBLIC, type: PROJECT }) { userErrors { message } } }', {}, fresh.token)).data!.createGroup.userErrors[0]!.message).toBe("You've reached your plan's limit for project workspaces.")
      expect((await t.gql<{ createGroup: { group: { id: string } | null } }>('mutation { createGroup(input: { name: "A study group", privacy: PUBLIC }) { group { id } } }', {}, fresh.token)).data!.createGroup.group).not.toBeNull()
    } finally {
      await db.entitlement.delete({ where: { id: row.id } })
    }
  })
})
