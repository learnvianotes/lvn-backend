import { InProcessEventBus } from '@lvn-backend/event-bus'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { createTestApp, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'

/**
 * Scoped moderation (§15.1, ADR-0051): reports on comments, posts, announcements, doubts and groups go to the queue of
 * their scope (a group's moderators, a class's staff, the platform's admins); a decision changes what others see and
 * tells the author; the author appeals once, back into the same queue.
 */
describe('scoped moderation', () => {
  let t: TestApp
  let db: PrismaService
  let bus: InProcessEventBus
  type Person = { id: string; handle: string; token: string }
  const person = async (opts: { teacher?: boolean; admin?: boolean; name?: string } = {}): Promise<Person> => {
    const u = await seedUser(t.app, { verified: true, globalRole: opts.admin ? 'PLATFORM_ADMIN' : opts.teacher ? 'TEACHER' : 'STUDENT', displayName: opts.name ?? 'Someone' })
    return { id: u.id, handle: u.handle, token: tokenFor(t.config, u.id) }
  }
  const doc = (s: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s }] }] })
  const gql = async <T>(query: string, variables: object, who: Person) => {
    const res = await t.gql<T>(query, variables as Record<string, unknown>, who.token)
    if (res.errors) throw new Error(res.errors[0]!.message)
    return res.data!
  }
  /** An ok-payload mutation: true, or the refusal (GraphQL error or user error) as `code: message`. */
  const ok = async (name: string, input: object, who: Person): Promise<true | string> => {
    const type = { reportContent: 'ReportContentInput', moderateContent: 'ModerateContentInput', appealModeration: 'AppealModerationInput' }[name]
    const res = await t.gql<Record<string, { ok: boolean; userErrors: { message: string; code: string }[] }>>(`mutation ($input: ${type}!) { ${name}(input: $input) { ok userErrors { message code } } }`, { input }, who.token)
    if (res.errors) return `${(res.errors[0] as { extensions: { code: string } }).extensions.code}: ${res.errors[0]!.message}`
    const e = res.data![name]!.userErrors[0]
    return e ? `${e.code}: ${e.message}` : true
  }
  const report = (who: Person, entityType: string, entityId: string, reason = 'HARASSMENT', details?: string) => ok('reportContent', { entityType, entityId, reason, details }, who)
  const decide = (who: Person, entityType: string, entityId: string, action: string, reason?: string) => ok('moderateContent', { entityType, entityId, action, reason }, who)
  const appeal = (who: Person, entityType: string, entityId: string, message: string) => ok('appealModeration', { entityType, entityId, message }, who)

  type Case = { entityType: string; entityId: string; scope: string; scopeId: string | null; content: { entityType: string; author: { id: string }; excerpt: string; moderation: string; moderationReason: string | null; path: string } | null; group: { id: string } | null; reports: { reason: string; details: string | null; reporter: { id: string } | null }[]; appeal: { message: string } | null }
  const CASE = 'entityType entityId scope scopeId content { entityType author { id } excerpt moderation moderationReason path } group { id } reports { reason details reporter { id } } appeal { message }'
  /** A queue as `who` sees it, or the refusal's code. */
  const queue = async (who: Person, scope?: { scope: string; id?: string }): Promise<Case[] | string> => {
    const res = await t.gql<{ moderationQueue: { edges: { node: Case }[] } }>(`query ($scope: ModerationScopeInput) { moderationQueue(first: 100, scope: $scope) { edges { node { ${CASE} } } } }`, { scope }, who.token)
    if (res.errors) return (res.errors[0] as { extensions: { code: string } }).extensions.code
    return res.data!.moderationQueue.edges.map((e) => e.node)
  }
  const cases = async (who: Person, scope?: { scope: string; id?: string }) => {
    const q = await queue(who, scope)
    if (typeof q === 'string') throw new Error(q)
    return q
  }
  const told = async (who: Person) => {
    await bus.drain()
    return (await gql<{ notifications: { edges: { node: { category: string; data: unknown; path: string; actor: { id: string } | null } }[] } }>('{ notifications { edges { node { category data path actor { id } } } } }', {}, who)).notifications.edges.map((e) => e.node).filter((n) => n.category === 'MODERATION')
  }

  const group = async (owner: Person, members: Person[], type = 'COMMUNITY') => {
    const id = (await gql<{ createGroup: { group: { id: string } } }>('mutation ($type: GroupType!) { createGroup(input: { name: "Heaps club", privacy: PUBLIC, joinPolicy: OPEN, type: $type }) { group { id } } }', { type }, owner)).createGroup.group.id
    for (const m of members) await gql('mutation ($id: UUID!) { joinGroup(input: { groupId: $id }) { group { id } } }', { id }, m)
    await bus.drain()
    return id
  }
  const post = async (who: Person, groupId: string, text: string, kind = 'POST') =>
    (await gql<{ createGroupPost: { post: { id: string } | null; userErrors: { message: string }[] } }>('mutation ($input: CreateGroupPostInput!) { createGroupPost(input: $input) { post { id } userErrors { message } } }', { input: { groupId, body: doc(text), kind } }, who)).createGroupPost.post!.id
  type SeenPost = { id: string; moderation: string; moderationReason: string | null }
  const posts = async (who: Person, groupId: string) =>
    (await gql<{ group: { posts: { edges: { node: SeenPost }[] } | null } | null }>('query ($id: UUID!) { group(id: $id) { posts(first: 50) { edges { node { id moderation moderationReason } } } } }', { id: groupId }, who)).group?.posts?.edges.map((e) => e.node) ?? []
  /** Whether each post's author may still appeal, as `who` sees it. */
  const appealable = async (who: Person, groupId: string) =>
    (await gql<{ group: { posts: { edges: { node: { id: string; moderationCanAppeal: boolean } }[] } } }>('query ($id: UUID!) { group(id: $id) { posts(first: 50) { edges { node { id moderationCanAppeal } } } } }', { id: groupId }, who)).group.posts.edges.map((e) => e.node)
  const classroom = async (teacher: Person, students: Person[], tas: Person[] = []) => {
    const classroomId = (await gql<{ createClassroom: { classroom: { id: string } } }>('mutation { createClassroom(input: { name: "DSA 101" }) { classroom { id } } }', {}, teacher)).createClassroom.classroom.id
    for (const [who, role] of [...students.map((s) => [s, 'STUDENT'] as const), ...tas.map((s) => [s, 'TA'] as const)]) {
      await gql('mutation ($input: InviteToClassroomInput!) { inviteToClassroom(input: $input) { classroom { id } } }', { input: { classroomId, person: who.handle, role } }, teacher)
      const invite = await db.classroomInvite.findFirstOrThrow({ where: { classroomId, invitedUserId: who.id } })
      await gql('mutation ($input: AnswerClassroomInviteInput!) { answerClassroomInvite(input: $input) { classroom { id } } }', { input: { inviteId: invite.id, accept: true } }, who)
    }
    await bus.drain()
    return classroomId
  }
  const announcements = async (who: Person, classroomId: string) =>
    (await gql<{ classroom: { posts: { edges: { node: SeenPost }[] } | null } | null }>('query ($id: UUID!) { classroom(id: $id) { posts(first: 50) { edges { node { id moderation moderationReason } } } } }', { id: classroomId }, who)).classroom?.posts?.edges.map((e) => e.node) ?? []
  type Target = { type: 'NOTE' | 'GROUP_POST' | 'CLASSROOM_POST'; id: string }
  const comment = async (who: Person, target: Target, text: string) =>
    (await gql<{ addComment: { comment: { id: string } | null } }>('mutation ($input: AddCommentInput!) { addComment(input: $input) { comment { id } } }', { input: { target, body: doc(text) } }, who)).addComment.comment!.id
  const discussion = async (who: Person, target: Target) =>
    (await gql<{ discussion: { commentCount: number; comments: { edges: { node: SeenPost }[] } } | null }>('query ($target: CommentTargetInput!) { discussion(target: $target) { commentCount comments { edges { node { id moderation moderationReason } } } } }', { target }, who)).discussion

  let admin: Person
  beforeAll(async () => {
    t = await createTestApp()
    db = t.app.get(PrismaService)
    bus = t.app.get(InProcessEventBus)
    admin = await person({ admin: true, name: 'Platform Admin' })
  })
  afterAll(() => t.close())

  it('a reported group post goes to the group’s queue; a moderator hides it, the author is told, appeals once and gets it back', async () => {
    const lead = await person({ name: 'Lead' })
    const mod = await person({ name: 'Mod' })
    const writer = await person({ name: 'Writer' })
    const reader = await person({ name: 'Reader' })
    const stranger = await person({ name: 'Stranger' })
    const groupId = await group(lead, [mod, writer, reader])
    await gql('mutation ($input: SetGroupRoleInput!) { setGroupRole(input: $input) { group { id } } }', { input: { groupId, userId: mod.id, role: 'MODERATOR' } }, lead)
    const postId = await post(writer, groupId, 'You are all hopeless at heaps.')

    // Only what one sees, never one's own.
    expect(await report(writer, 'GROUP_POST', postId)).toBe('VALIDATION: This is your own.')
    expect(await report(stranger, 'GROUP_POST', postId)).toBe('NOT_FOUND: That is not there any more.')
    expect(await report(reader, 'GROUP_POST', postId, 'HARASSMENT', 'Rude to everyone')).toBe(true)

    // The group's queue: its moderators and owner, and platform admins; not members, not the platform scope.
    const inGroup = await cases(mod, { scope: 'GROUP', id: groupId })
    expect(inGroup).toEqual([expect.objectContaining({ entityType: 'GROUP_POST', entityId: postId, scope: 'GROUP', scopeId: groupId, content: { entityType: 'GROUP_POST', author: { id: writer.id }, excerpt: 'You are all hopeless at heaps.', moderation: 'OK', moderationReason: null, path: `/groups/${groupId}` }, reports: [{ reason: 'HARASSMENT', details: 'Rude to everyone', reporter: { id: reader.id } }], appeal: null })])
    expect(await cases(lead, { scope: 'GROUP', id: groupId })).toHaveLength(1)
    expect(await cases(admin, { scope: 'GROUP', id: groupId })).toHaveLength(1)
    expect(await queue(reader, { scope: 'GROUP', id: groupId })).toBe('FORBIDDEN')
    expect(await queue(mod)).toBe('FORBIDDEN')
    expect((await cases(admin, { scope: 'PLATFORM' })).map((c) => c.entityId)).not.toContain(postId)
    expect((await cases(admin)).map((c) => c.entityId)).toContain(postId)

    // A member can't decide; a reason is needed; the moderator hides it.
    expect(await decide(reader, 'GROUP_POST', postId, 'HIDE', 'Rude')).toMatch(/^FORBIDDEN/)
    expect(await decide(mod, 'GROUP_POST', postId, 'HIDE')).toBe('VALIDATION: Say why: the author is told.')
    expect(await decide(mod, 'GROUP_POST', postId, 'HIDE', 'Be kind to the others.')).toBe(true)
    expect((await posts(reader, groupId)).map((p) => p.id)).not.toContain(postId)
    expect((await posts(lead, groupId)).map((p) => p.id)).not.toContain(postId)
    expect(await posts(writer, groupId)).toContainEqual({ id: postId, moderation: 'HIDDEN', moderationReason: 'Be kind to the others.' })
    expect(await cases(mod, { scope: 'GROUP', id: groupId })).toEqual([])
    expect(await told(writer)).toEqual([{ category: 'MODERATION', data: { kind: 'HIDDEN', entityType: 'GROUP_POST' }, path: `/groups/${groupId}`, actor: null }])
    const action = await db.moderationAction.findFirstOrThrow({ where: { entityId: postId } })
    expect(action).toMatchObject({ action: 'HIDE', actorId: mod.id, scope: 'GROUP', scopeId: groupId, reason: 'Be kind to the others.' })
    expect((await db.auditLog.findMany({ where: { targetId: postId, action: { startsWith: 'moderation.' } } })).map((a) => a.action)).toEqual(['moderation.hide'])

    // One appeal, back into the group's queue; the moderator approves and the post is back for everyone.
    expect(await appeal(reader, 'GROUP_POST', postId, 'Mine?')).toBe('NOT_FOUND: That is not there any more.')
    expect(await appealable(writer, groupId)).toContainEqual({ id: postId, moderationCanAppeal: true })
    expect(await appeal(writer, 'GROUP_POST', postId, 'I was joking, sorry.')).toBe(true)
    expect(await appealable(writer, groupId)).toContainEqual({ id: postId, moderationCanAppeal: false })
    expect(await appeal(writer, 'GROUP_POST', postId, 'Again')).toBe('VALIDATION: You have already appealed for this.')
    expect(await cases(mod, { scope: 'GROUP', id: groupId })).toEqual([expect.objectContaining({ entityId: postId, appeal: { message: 'I was joking, sorry.' }, reports: [], content: expect.objectContaining({ moderation: 'HIDDEN' }) })])
    expect(await decide(mod, 'GROUP_POST', postId, 'APPROVE')).toBe(true)
    expect((await posts(reader, groupId)).map((p) => p.id)).toContain(postId)
    expect((await told(writer)).map((n) => (n.data as { kind: string }).kind)).toEqual(['RESTORED', 'HIDDEN'])
  })

  it('nobody in a group decides on their own content, and three people’s reports hold a post until a moderator looks', async () => {
    const lead = await person({ name: 'Lead' })
    const members = await Promise.all([1, 2, 3, 4].map((i) => person({ name: `Member ${i}` })))
    const [writer, ...others] = members as [Person, Person, Person, Person]
    const groupId = await group(lead, members)
    const own = await post(lead, groupId, 'Pay me for the notes.')
    expect(await report(writer, 'GROUP_POST', own, 'SPAM')).toBe(true)
    expect(await decide(lead, 'GROUP_POST', own, 'REMOVE', 'Mine')).toBe('FORBIDDEN: Another moderator decides about your own content.')
    expect(await decide(admin, 'GROUP_POST', own, 'REMOVE', 'Selling in the group.')).toBe(true)
    expect(await posts(lead, groupId)).toContainEqual({ id: own, moderation: 'REMOVED', moderationReason: 'Selling in the group.' })
    expect(await told(lead)).toEqual([expect.objectContaining({ data: { kind: 'REMOVED', entityType: 'GROUP_POST' } })])

    const postId = await post(writer, groupId, 'Heaps are trees.')
    for (const who of others.slice(0, 2)) expect(await report(who, 'GROUP_POST', postId, 'SPAM')).toBe(true)
    expect((await posts(lead, groupId)).map((p) => p.id)).toContain(postId)
    expect(await report(others[2]!, 'GROUP_POST', postId, 'SPAM')).toBe(true)
    expect((await posts(lead, groupId)).map((p) => p.id)).not.toContain(postId)
    expect(await posts(writer, groupId)).toContainEqual({ id: postId, moderation: 'PENDING_REVIEW', moderationReason: 'Several people reported this. A moderator will look at it.' })
    // Held content leaves the activity feed too.
    await bus.drain()
    const feed = await gql<{ activityFeed: { edges: { node: { post: { id: string } | null } }[] } }>('{ activityFeed { edges { node { post { id } } } } }', {}, lead)
    expect(feed.activityFeed.edges.map((e) => e.node.post?.id)).not.toContain(postId)
    // Dismissing the reports frees it, without telling the author anything.
    expect(await decide(lead, 'GROUP_POST', postId, 'DISMISS')).toBe(true)
    expect(await posts(others[0]!, groupId)).toContainEqual({ id: postId, moderation: 'OK', moderationReason: null })
    expect(await told(writer)).toEqual([])
  })

  it('a flagged comment on a class announcement waits in the class’s queue; staff remove it, and the student’s appeal comes back to them', async () => {
    const teacher = await person({ teacher: true, name: 'Ms Rao' })
    const ta = await person({ name: 'TA' })
    const student = await person({ name: 'Student' })
    const other = await person({ name: 'Other student' })
    const otherTeacher = await person({ teacher: true, name: 'Mr Elsewhere' })
    const classroomId = await classroom(teacher, [student, other], [ta])
    await classroom(otherTeacher, [])
    await gql('mutation ($input: CreateClassroomPostInput!) { createClassroomPost(input: $input) { classroom { id } } }', { input: { classroomId, body: doc('Quiz on Monday') } }, teacher)
    const announcementId = (await db.classroomPost.findFirstOrThrow({ where: { classroomId } })).id
    const target = { type: 'CLASSROOM_POST' as const, id: announcementId }

    const held = await comment(student, target, 'Buy followers here, cheap.')
    expect((await discussion(student, target))!.comments.edges[0]!.node).toMatchObject({ id: held, moderation: 'PENDING_REVIEW' })
    expect((await discussion(teacher, target))!.comments.edges).toEqual([])
    expect((await discussion(teacher, target))!.commentCount).toBe(0)

    const scope = { scope: 'CLASSROOM', id: classroomId }
    expect(await cases(teacher, scope)).toEqual([expect.objectContaining({ entityType: 'COMMENT', entityId: held, scope: 'CLASSROOM', scopeId: classroomId, content: expect.objectContaining({ author: { id: student.id }, moderation: 'PENDING_REVIEW', path: `/classes/${classroomId}` }), reports: [expect.objectContaining({ reason: 'SPAM', reporter: null })] })])
    expect(await cases(ta, scope)).toHaveLength(1)
    expect(await queue(student, scope)).toBe('FORBIDDEN')
    expect(await queue(otherTeacher, scope)).toBe('FORBIDDEN')
    expect(await decide(otherTeacher, 'COMMENT', held, 'REMOVE', 'No')).toMatch(/^FORBIDDEN/)

    expect(await decide(ta, 'COMMENT', held, 'REMOVE', 'No selling in class.')).toBe(true)
    expect((await discussion(student, target))!.comments.edges[0]!.node).toEqual({ id: held, moderation: 'REMOVED', moderationReason: 'No selling in class.' })
    expect(await told(student)).toEqual([{ category: 'MODERATION', data: { kind: 'REMOVED', entityType: 'COMMENT' }, path: `/classes/${classroomId}`, actor: null }])
    // Taken down: it can't be edited, only appealed, and the appeal is the class's to decide.
    const edit = await t.gql<{ editComment: { userErrors: { message: string }[] } }>('mutation ($input: EditCommentInput!) { editComment(input: $input) { userErrors { message } } }', { input: { commentId: held, body: doc('Sorry') } }, student.token)
    expect(edit.data!.editComment.userErrors[0]!.message).toBe('A moderator took this comment down; appeal instead of editing it.')
    expect(await appeal(student, 'COMMENT', held, 'It was a joke.')).toBe(true)
    expect(await cases(teacher, scope)).toEqual([expect.objectContaining({ entityId: held, appeal: { message: 'It was a joke.' } })])
    expect(await decide(teacher, 'COMMENT', held, 'APPROVE')).toBe(true)
    // Back for the staff (class threads stay between a student and the staff).
    expect((await discussion(teacher, target))!.comments.edges.map((e) => e.node.id)).toEqual([held])
    expect((await discussion(other, target))!.comments.edges).toEqual([])

    // A student reports the teacher's announcement: the teacher can't decide it, the TA can.
    expect(await report(other, 'CLASSROOM_POST', announcementId, 'OTHER', 'Wrong date')).toBe(true)
    expect(await decide(teacher, 'CLASSROOM_POST', announcementId, 'WARN', 'x')).toBe('FORBIDDEN: Another moderator decides about your own content.')
    expect(await decide(ta, 'CLASSROOM_POST', announcementId, 'WARN', 'Check the date, please.')).toBe(true)
    // The announcement stays; its author reads the warning with it, nobody else does.
    expect(await announcements(teacher, classroomId)).toEqual([{ id: announcementId, moderation: 'OK', moderationReason: 'Check the date, please.' }])
    expect(await announcements(other, classroomId)).toEqual([{ id: announcementId, moderation: 'OK', moderationReason: null }])
    expect(await told(teacher)).toEqual([expect.objectContaining({ data: { kind: 'WARNED', entityType: 'CLASSROOM_POST' } })])
  })

  it('a comment on a note and a group itself are the platform’s; admins hide, warn and remove', async () => {
    const owner = await person({ name: 'Owner' })
    const writer = await person({ name: 'Writer' })
    const reader = await person({ name: 'Reader' })
    const lead = await person({ name: 'Lead' })
    const noteId = (await gql<{ createNote: { note: { id: string } } }>('mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } } }', { input: { title: 'Heaps', cards: [{ id: newId(), type: 'text', position: 'a0', content: { doc: doc('A heap keeps the smallest on top.') } }] } }, owner)).createNote.note.id
    await gql('mutation ($input: NoteIdInput!) { publishNote(input: $input) { note { id } } }', { input: { noteId } }, owner)
    await gql('mutation ($input: ChangeNoteVisibilityInput!) { changeNoteVisibility(input: $input) { note { id } } }', { input: { noteId, visibility: 'PUBLIC' } }, owner)
    await bus.drain()
    const target = { type: 'NOTE' as const, id: noteId }
    const said = await comment(writer, target, 'This is wrong and so are you.')
    expect(await report(reader, 'COMMENT', said, 'HARASSMENT')).toBe(true)
    expect(await cases(admin, { scope: 'PLATFORM' })).toContainEqual(expect.objectContaining({ entityType: 'COMMENT', entityId: said, scope: 'PLATFORM', scopeId: null, content: expect.objectContaining({ excerpt: 'This is wrong and so are you.', path: `/notes/${noteId}` }) }))
    // The note's owner moderates nothing here.
    expect(await decide(owner, 'COMMENT', said, 'HIDE', 'Rude')).toMatch(/^FORBIDDEN/)
    expect(await decide(admin, 'COMMENT', said, 'HIDE', 'Disagree with the note, not the person.')).toBe(true)
    expect((await discussion(reader, target))!.commentCount).toBe(0)
    expect((await discussion(owner, target))!.comments.edges).toEqual([])
    expect((await discussion(writer, target))!.comments.edges.map((e) => e.node)).toEqual([{ id: said, moderation: 'HIDDEN', moderationReason: 'Disagree with the note, not the person.' }])
    const canAppeal = await gql<{ discussion: { comments: { edges: { node: { moderationCanAppeal: boolean } }[] } } }>('query ($target: CommentTargetInput!) { discussion(target: $target) { comments { edges { node { moderationCanAppeal } } } } }', { target }, writer)
    expect(canAppeal.discussion.comments.edges[0]!.node.moderationCanAppeal).toBe(true)
    expect(await told(writer)).toEqual([{ category: 'MODERATION', data: { kind: 'HIDDEN', entityType: 'COMMENT' }, path: `/notes/${noteId}`, actor: null }])

    // A group is reported to the platform: its own moderators don't see or decide it.
    const groupId = await group(lead, [reader])
    expect(await report(lead, 'GROUP', groupId)).toBe('VALIDATION: This is your own.')
    expect(await report(reader, 'GROUP', groupId, 'HATE', 'The group name')).toBe(true)
    expect(await cases(lead, { scope: 'GROUP', id: groupId })).toEqual([])
    expect(await decide(lead, 'GROUP', groupId, 'DISMISS')).toMatch(/^FORBIDDEN/)
    expect(await cases(admin, { scope: 'PLATFORM' })).toContainEqual(expect.objectContaining({ entityType: 'GROUP', entityId: groupId, group: { id: groupId }, content: null }))
    expect(await decide(admin, 'GROUP', groupId, 'HIDE', 'x')).toBe('VALIDATION: A group can be warned, removed, or its reports dismissed.')
    expect(await decide(admin, 'GROUP', groupId, 'WARN', 'Rename the group, please.')).toBe(true)
    expect(await told(lead)).toEqual([{ category: 'MODERATION', data: { kind: 'WARNED', entityType: 'GROUP' }, path: `/groups/${groupId}`, actor: null }])
    // The owner reads the warning on the group; nobody else does.
    const warning = (who: Person) => gql<{ group: { moderationWarning: string | null } }>('query ($id: UUID!) { group(id: $id) { moderationWarning } }', { id: groupId }, who)
    expect((await warning(lead)).group.moderationWarning).toBe('Rename the group, please.')
    expect((await warning(reader)).group.moderationWarning).toBeNull()
    expect(await report(reader, 'GROUP', groupId, 'HATE')).toBe(true)
    expect(await decide(admin, 'GROUP', groupId, 'REMOVE', 'Hateful name, after a warning.')).toBe(true)
    await bus.drain()
    expect((await gql<{ group: { id: string } | null }>('query ($id: UUID!) { group(id: $id) { id } }', { id: groupId }, reader)).group).toBeNull()
    expect((await told(lead)).map((n) => (n.data as { kind: string }).kind)).toEqual(['REMOVED', 'WARNED'])
  })

  it('a doubt in a project workspace is the group’s to moderate; hidden, it is its author’s alone', async () => {
    const lead = await person({ name: 'Lead' })
    const asker = await person({ name: 'Asker' })
    const peer = await person({ name: 'Peer' })
    const groupId = await group(lead, [asker, peer], 'PROJECT')
    const doubtId = (await gql<{ askDoubt: { doubt: { id: string } } }>('mutation ($input: AskDoubtInput!) { askDoubt(input: $input) { doubt { id } } }', { input: { groupId, title: 'Who broke the build?', body: doc('Peer did, obviously, as always.') } }, asker)).askDoubt.doubt.id
    expect(await report(peer, 'DOUBT', doubtId, 'HARASSMENT')).toBe(true)
    expect(await cases(lead, { scope: 'GROUP', id: groupId })).toEqual([expect.objectContaining({ entityType: 'DOUBT', content: expect.objectContaining({ excerpt: 'Who broke the build? — Peer did, obviously, as always.', path: `/groups/${groupId}/doubts/${doubtId}` }) })])
    expect(await decide(lead, 'DOUBT', doubtId, 'HIDE', 'Ask about the code, not the person.')).toBe(true)
    const read = (who: Person) => gql<{ doubt: { id: string; moderation: string; moderationReason: string | null } | null }>('query ($id: UUID!) { doubt(id: $id) { id moderation moderationReason } }', { id: doubtId }, who)
    expect((await read(peer)).doubt).toBeNull()
    expect((await read(asker)).doubt).toEqual({ id: doubtId, moderation: 'HIDDEN', moderationReason: 'Ask about the code, not the person.' })
    const list = await gql<{ group: { doubts: { edges: { node: { id: string } }[] } } }>('query ($id: UUID!) { group(id: $id) { doubts { edges { node { id } } } } }', { id: groupId }, lead)
    expect(list.group.doubts.edges).toEqual([])
    expect(await told(asker)).toEqual([{ category: 'MODERATION', data: { kind: 'HIDDEN', entityType: 'DOUBT' }, path: `/groups/${groupId}/doubts/${doubtId}`, actor: null }])
  })
})
