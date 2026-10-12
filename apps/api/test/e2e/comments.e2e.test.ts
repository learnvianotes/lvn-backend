import { InProcessEventBus } from '@lvn-backend/event-bus'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { createTestApp, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'

/**
 * Comments and reactions (§4.5, ADR-0016, ADR-0047): the read rule of a note, group post or class announcement decides
 * who reads and joins its discussion; replies, edits and removal; restrict and block; the scorer; class threads that
 * stay between a student and the staff; reaction counts as milestones on public notes.
 */
describe('comments and reactions', () => {
  let t: TestApp
  let db: PrismaService
  let bus: InProcessEventBus
  type Person = { id: string; handle: string; token: string }
  const person = async (opts: { verified?: boolean; teacher?: boolean; minor?: boolean; name?: string } = {}): Promise<Person> => {
    const u = await seedUser(t.app, { verified: opts.verified ?? true, globalRole: opts.teacher ? 'TEACHER' : 'STUDENT', displayName: opts.name ?? 'Someone' })
    if (opts.minor) await db.user.update({ where: { id: u.id }, data: { dateOfBirth: new Date('2015-03-01') } })
    return { id: u.id, handle: u.handle, token: tokenFor(t.config, u.id) }
  }
  const doc = (s: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s }] }] })
  type Res<T> = { data?: T; errors?: { message: string; extensions: { code: string } }[] }
  type Target = { type: 'NOTE' | 'GROUP_POST' | 'CLASSROOM_POST'; id: string }

  const COMMENT = 'id author { id } body cardId removed pendingApproval private editedAt viewerCan { reply edit delete approve } reactions { counts { kind count atLeast } viewerReaction }'
  type Comment = { id: string; author: { id: string } | null; body: unknown; cardId: string | null; removed: boolean; pendingApproval: boolean; private: boolean; editedAt: string | null; viewerCan: Record<string, boolean>; reactions: Reactions; replies: Comment[] }
  type Reactions = { counts: { kind: string; count: number | null; atLeast: boolean }[]; viewerReaction: string | null }
  type Discussion = { comments: { edges: { node: Comment }[] }; commentCount: number; reactions: Reactions; viewerCanComment: boolean; whyNot: string | null }
  const DISCUSSION = `discussion(target: $target) { commentCount viewerCanComment whyNot reactions { counts { kind count atLeast } viewerReaction } comments { edges { node { ${COMMENT} replies { ${COMMENT} } } } } }`

  /** The discussion of a target as `who` sees it; null when they cannot read the target. */
  const discussion = async (target: Target, who: Person): Promise<Discussion | null> =>
    (await t.gql<{ discussion: Discussion | null }>(`query ($target: CommentTargetInput!) { ${DISCUSSION} }`, { target }, who.token)).data?.discussion ?? null
  const comments = async (target: Target, who: Person) => (await discussion(target, who))?.comments.edges.map((e) => e.node) ?? null
  const texts = (list: Comment[] | null) => (list ?? []).map((c) => (c.removed ? '(removed)' : (c.body as { content: { content: { text: string }[] }[] }).content[0]!.content[0]!.text))

  /** A mutation's payload and the refusal or invalid input, as one message. */
  const act = async (name: string, input: object, who: Person) => {
    const selection = name === 'react' ? 'reactions { counts { kind count atLeast } viewerReaction } userErrors { message code }' : `comment { ${COMMENT} } userErrors { message code }`
    const type = { addComment: 'AddCommentInput', editComment: 'EditCommentInput', deleteComment: 'CommentIdInput', approveComment: 'CommentIdInput', react: 'ReactInput' }[name]
    const res = (await t.gql(`mutation ($input: ${type}!) { ${name}(input: $input) { ${selection} } }`, { input }, who.token)) as Res<Record<string, { comment?: Comment | null; reactions?: Reactions | null; userErrors: { message: string; code: string }[] }>>
    const payload = res.data?.[name]
    return { comment: payload?.comment ?? null, reactions: payload?.reactions ?? null, error: res.errors?.[0]?.message ?? payload?.userErrors[0]?.message, code: res.errors?.[0]?.extensions.code ?? payload?.userErrors[0]?.code }
  }
  const say = async (who: Person, target: Target, text: string, extra: object = {}) => act('addComment', { target, body: doc(text), ...extra }, who)
  const notifications = async (who: Person) => {
    await bus.drain()
    return (await t.gql<{ notifications: { edges: { node: { category: string; data: unknown; path: string; actor: { id: string } | null; note: { id: string } | null } }[] } }>('{ notifications { edges { node { category data path actor { id } note { id } } } } }', {}, who.token)).data!.notifications.edges.map((e) => e.node).filter((n) => n.category === 'COMMENT')
  }
  const note = async (owner: Person, visibility: 'PUBLIC' | 'SHARED' | 'PRIVATE' = 'PUBLIC') => {
    const cardId = newId()
    const id = (await t.gql<{ createNote: { note: { id: string } } }>('mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } } }', { input: { title: 'Heaps', cards: [{ id: cardId, type: 'text', position: 'a0', content: { doc: doc('A heap keeps the smallest on top.') } }] } }, owner.token)).data!.createNote.note.id
    await t.gql('mutation ($input: NoteIdInput!) { publishNote(input: $input) { note { id } } }', { input: { noteId: id } }, owner.token)
    if (visibility !== 'PRIVATE') await t.gql('mutation ($input: ChangeNoteVisibilityInput!) { changeNoteVisibility(input: $input) { note { id } } }', { input: { noteId: id, visibility } }, owner.token)
    await bus.drain()
    return { target: { type: 'NOTE' as const, id }, cardId }
  }
  const shareWith = (owner: Person, noteId: string, who: Person) => t.gql('mutation ($input: ShareNoteInput!) { shareNote(input: $input) { note { id } } }', { input: { noteId, person: who.handle, role: 'VIEWER' } }, owner.token)
  const personAct = (name: string, who: Person, target: Person) => t.gql(`mutation ($input: PersonInput!) { ${name}(input: $input) { userErrors { message } } }`, { input: { userId: target.id } }, who.token)

  let owner: Person
  let asha: Person
  let ravi: Person

  beforeAll(async () => {
    t = await createTestApp()
    db = t.app.get(PrismaService)
    bus = t.app.get(InProcessEventBus)
    owner = await person({ name: 'Note Owner' })
    asha = await person({ name: 'Asha' })
    ravi = await person({ name: 'Ravi' })
  })
  afterAll(() => t.close())

  it('readers of a note comment and reply; the owner and the parent comment author are told', async () => {
    const { target } = await note(owner)
    const first = await say(asha, target, 'Why the smallest?')
    expect(first.comment).toMatchObject({ author: { id: asha.id }, removed: false, pendingApproval: false, private: false, viewerCan: { reply: true, edit: true, delete: true, approve: false } })
    await say(ravi, target, 'Because it is a min-heap.', { parentId: first.comment!.id })
    const seen = await discussion(target, owner)
    expect(seen).toMatchObject({ commentCount: 2, viewerCanComment: true, whyNot: null })
    expect(texts(seen!.comments.edges.map((e) => e.node))).toEqual(['Why the smallest?'])
    expect(texts(seen!.comments.edges[0]!.node.replies)).toEqual(['Because it is a min-heap.'])
    // The owner moderates their note's discussion; another reader only their own comments.
    expect(seen!.comments.edges[0]!.node.viewerCan).toEqual({ reply: true, edit: false, delete: true, approve: false })
    expect((await comments(target, ravi))![0]!.viewerCan).toEqual({ reply: true, edit: false, delete: false, approve: false })

    expect(await notifications(owner)).toEqual([
      { category: 'COMMENT', data: { kind: 'COMMENT' }, path: `/notes/${target.id}`, actor: { id: ravi.id }, note: { id: target.id } },
      { category: 'COMMENT', data: { kind: 'COMMENT' }, path: `/notes/${target.id}`, actor: { id: asha.id }, note: { id: target.id } },
    ])
    expect(await notifications(asha)).toEqual([{ category: 'COMMENT', data: { kind: 'REPLY' }, path: `/notes/${target.id}`, actor: { id: ravi.id }, note: { id: target.id } }])
    // Replies go one level deep.
    const reply = (await comments(target, asha))![0]!.replies[0]!
    expect(reply.viewerCan.reply).toBe(false)
    expect((await say(asha, target, 'Deeper', { parentId: reply.id })).error).toBe('That comment is not there any more.')
  })

  it('edits are marked; a removed comment with replies stays as removed; only its author or the owner removes it', async () => {
    const { target } = await note(owner)
    const c = (await say(asha, target, 'First thought')).comment!
    await say(ravi, target, 'Agreed', { parentId: c.id })
    expect((await act('editComment', { commentId: c.id, body: doc('Second thought') }, ravi)).error).toBe('Only its author edits a comment.')
    expect((await act('editComment', { commentId: c.id, body: doc('Second thought') }, asha)).comment).toMatchObject({ editedAt: expect.any(String) })
    expect((await act('deleteComment', { commentId: c.id }, ravi)).error).toBe('Only its author or a moderator removes a comment.')
    await act('deleteComment', { commentId: c.id }, owner)
    const after = (await comments(target, ravi))!
    expect(after[0]).toMatchObject({ removed: true, author: null, body: null })
    expect(texts(after[0]!.replies)).toEqual(['Agreed'])
    expect(await db.auditLog.count({ where: { action: 'comment.remove', targetId: target.id } })).toBe(1)
    // Without replies it is gone.
    const lone = (await say(asha, target, 'Typo')).comment!
    await act('deleteComment', { commentId: lone.id }, asha)
    expect(texts(await comments(target, owner))).toEqual(['(removed)'])
  })

  it('comments follow the note’s read rule, need a verified account, and a card must be in the note', async () => {
    const { target, cardId } = await note(owner, 'PRIVATE')
    expect(await discussion(target, asha)).toBeNull()
    expect((await say(asha, target, 'Hello')).code).toBe('NOT_FOUND')
    await shareWith(owner, target.id, asha)
    expect((await say(asha, target, 'On the card', { cardId })).comment).toMatchObject({ cardId })
    expect((await say(asha, target, 'Elsewhere', { cardId: newId() })).error).toBe('That card is not in this note.')
    const onCard = await t.gql<{ discussion: { comments: { edges: unknown[] } } }>('query ($target: CommentTargetInput!, $card: UUID) { discussion(target: $target) { comments(cardId: $card) { edges { node { id } } } } }', { target, card: cardId }, owner.token)
    expect(onCard.data!.discussion.comments.edges).toHaveLength(1)
    // The note itself carries its discussion's count, shallowly.
    const counted = await t.gql<{ note: { discussion: { commentCount: number } } }>('query ($id: UUID!) { note(id: $id) { discussion { commentCount } } }', { id: target.id }, asha.token)
    expect(counted.data!.note.discussion.commentCount).toBe(1)
    // Anonymous visitors of a public note get no discussion.
    const open = await note(owner)
    expect((await t.gql<{ note: { discussion: unknown } }>('query ($id: UUID!) { note(id: $id) { discussion { commentCount } } }', { id: open.target.id })).data!.note.discussion).toBeNull()
    const unverified = await person({ verified: false })
    expect(await discussion(open.target, unverified)).toMatchObject({ viewerCanComment: false, whyNot: 'Verify your account to comment.' })
    expect(await say(unverified, open.target, 'Hi')).toMatchObject({ code: 'FORBIDDEN', error: 'Verify your account to comment.' })
  })

  it('a restricted minor comments on notes shared with them, never on public ones (§15.2)', async () => {
    const minor = await person({ minor: true })
    const open = await note(owner)
    expect(await discussion(open.target, minor)).toMatchObject({ viewerCanComment: false, whyNot: 'Comments on public notes are not open to your account yet.' })
    expect((await act('react', { target: open.target, kind: 'LIKE' }, minor)).code).toBe('FORBIDDEN')
    const shared = await note(owner, 'SHARED')
    await shareWith(owner, shared.target.id, minor)
    expect((await say(minor, shared.target, 'Thank you')).comment).toMatchObject({ author: { id: minor.id } })
  })

  it('a restricted person’s comments wait for the owner, cause no notification, and show once approved (ADR-0016)', async () => {
    const quiet = await person({ name: 'Quiet' })
    await personAct('restrictUser', owner, quiet)
    const { target } = await note(owner)
    await notifications(owner)
    const before = (await notifications(owner)).length
    const c = (await say(quiet, target, 'Pick me')).comment!
    expect(c.pendingApproval).toBe(true)
    expect(texts(await comments(target, quiet))).toEqual(['Pick me'])
    expect(texts(await comments(target, asha))).toEqual([])
    expect((await comments(target, owner))![0]!.viewerCan.approve).toBe(true)
    expect((await notifications(owner)).length).toBe(before)
    // Others do not see it at all.
    expect((await act('approveComment', { commentId: c.id }, asha)).code).toBe('NOT_FOUND')
    await act('approveComment', { commentId: c.id }, owner)
    expect(texts(await comments(target, asha))).toEqual(['Pick me'])
  })

  it('a block stops comments and reactions both ways and hides each one’s comments from the other', async () => {
    const { target } = await note(owner)
    const rude = await person({ name: 'Rude' })
    await say(rude, target, 'Before the block')
    await say(asha, target, 'Mine')
    await personAct('blockUser', asha, rude)
    expect(texts(await comments(target, asha))).toEqual(['Mine'])
    expect(texts(await comments(target, rude))).toEqual(['Before the block'])
    const ashas = (await db.comment.findFirstOrThrow({ where: { targetId: target.id, authorId: asha.id } })).id
    expect((await say(rude, target, 'Reply', { parentId: ashas })).code).toBe('NOT_FOUND')
    // On the blocker's own note, the same words whoever blocked.
    const hers = await note(asha)
    expect(await discussion(hers.target, rude)).toMatchObject({ viewerCanComment: false, whyNot: "You can't comment here." })
    expect((await act('react', { target: hers.target, kind: 'LIKE' }, rude)).error).toBe("You can't react here.")
    await personAct('unblockUser', asha, rude)
  })

  it('the scorer refuses a flagged comment with its reason', async () => {
    const { target } = await note(owner)
    expect((await say(asha, target, 'Buy followers here, cheap.')).error).toBe("This comment can't be posted: it contains words linked to spam.")
    expect((await say(asha, target, '   ')).error).toBe('Write something first.')
    expect(await comments(target, owner)).toEqual([])
  })

  it('reactions: one per person, changed or taken back; exact for the owner, milestones for others on a public note', async () => {
    const { target } = await note(owner)
    expect((await act('react', { target, kind: 'LIKE' }, asha)).reactions).toMatchObject({ viewerReaction: 'LIKE' })
    await act('react', { target, kind: 'HELPFUL' }, ravi)
    await act('react', { target, kind: 'HELPFUL' }, asha)
    const count = (r: Reactions, kind: string) => r.counts.find((c) => c.kind === kind)
    const mine = (await discussion(target, owner))!.reactions
    expect(count(mine, 'HELPFUL')).toEqual({ kind: 'HELPFUL', count: 2, atLeast: false })
    expect(count(mine, 'LIKE')).toEqual({ kind: 'LIKE', count: 0, atLeast: false })
    // Below the first milestone, others see no number on a public note (ADR-0027); they see their own reaction.
    const theirs = (await discussion(target, asha))!.reactions
    expect(count(theirs, 'HELPFUL')).toEqual({ kind: 'HELPFUL', count: null, atLeast: false })
    expect(theirs.viewerReaction).toBe('HELPFUL')
    await act('react', { target, kind: null }, asha)
    expect((await discussion(target, asha))!.reactions.viewerReaction).toBeNull()
    // On a comment, its author sees the exact count.
    const c = (await say(asha, target, 'Nice')).comment!
    await act('react', { target: { type: 'COMMENT', id: c.id }, kind: 'CELEBRATE' }, ravi)
    expect(count((await comments(target, asha))![0]!.reactions, 'CELEBRATE')!.count).toBe(1)
  })

  it('group posts: members discuss them, exactly counted; muted members and outsiders do not', async () => {
    const groupId = (await t.gql<{ createGroup: { group: { id: string } } }>('mutation { createGroup(input: { name: "Discussions", privacy: PUBLIC, joinPolicy: OPEN }) { group { id } } }', {}, owner.token)).data!.createGroup.group.id
    for (const p of [asha, ravi]) await t.gql('mutation ($id: UUID!) { joinGroup(input: { groupId: $id }) { group { id } } }', { id: groupId }, p.token)
    const postId = (await t.gql<{ createGroupPost: { post: { id: string } } }>('mutation ($input: CreateGroupPostInput!) { createGroupPost(input: $input) { post { id } } }', { input: { groupId, body: doc('Week 3 problems') } }, ravi.token)).data!.createGroupPost.post.id
    const target = { type: 'GROUP_POST' as const, id: postId }
    await say(asha, target, 'Problem 2 is tricky')
    await act('react', { target, kind: 'LIKE' }, asha)
    expect(await discussion(target, owner)).toMatchObject({ commentCount: 1, reactions: { counts: expect.arrayContaining([{ kind: 'LIKE', count: 1, atLeast: false }]) } })
    expect((await notifications(ravi)).find((n) => n.path === `/groups/${groupId}`)).toMatchObject({ data: { kind: 'COMMENT' }, actor: { id: asha.id } })
    const outsider = await person()
    expect((await say(outsider, target, 'Hi')).code).toBe('NOT_FOUND')
    await t.gql('mutation ($input: MuteGroupMemberInput!) { muteGroupMember(input: $input) { group { id } } }', { input: { groupId, userId: asha.id, until: new Date(Date.now() + 3_600_000).toISOString() } }, owner.token)
    expect((await say(asha, target, 'Again')).error).toBe('You are muted in this group for now.')
    // Moderators remove comments on posts.
    const c = (await db.comment.findFirstOrThrow({ where: { targetId: postId } })).id
    expect((await act('deleteComment', { commentId: c }, owner)).comment).toMatchObject({ removed: true })
  })

  it('class announcements: a student’s thread is theirs and the staff’s; staff speak to the whole class', async () => {
    const teacher = await person({ teacher: true, name: 'Teacher' })
    const classroomId = (await t.gql<{ createClassroom: { classroom: { id: string } } }>('mutation { createClassroom(input: { name: "Discussions 9A" }) { classroom { id } } }', {}, teacher.token)).data!.createClassroom.classroom.id
    const [s1, s2] = [await person({ name: 'S1' }), await person({ minor: true, name: 'S2' })]
    for (const s of [s1, s2]) {
      const inv = await t.gql<{ inviteToClassroom: unknown }>('mutation ($input: InviteToClassroomInput!) { inviteToClassroom(input: $input) { classroom { id } } }', { input: { classroomId, person: s.handle } }, teacher.token)
      expect(inv.errors).toBeUndefined()
      const invite = await db.classroomInvite.findFirstOrThrow({ where: { classroomId, invitedUserId: s.id } })
      await t.gql('mutation ($input: AnswerClassroomInviteInput!) { answerClassroomInvite(input: $input) { classroom { id } } }', { input: { inviteId: invite.id, accept: true } }, s.token)
    }
    await t.gql('mutation ($input: CreateClassroomPostInput!) { createClassroomPost(input: $input) { classroom { id } } }', { input: { classroomId, body: doc('Test on Friday') } }, teacher.token)
    const postId = (await db.classroomPost.findFirstOrThrow({ where: { classroomId } })).id
    const target = { type: 'CLASSROOM_POST' as const, id: postId }

    const question = (await say(s2, target, 'Which chapters?')).comment!
    expect(question.private).toBe(true)
    const all = (await say(teacher, target, 'Chapters 1 to 3, everyone')).comment!
    expect(all.private).toBe(false)
    await say(s1, target, 'Thanks', { parentId: all.id })
    await say(teacher, target, 'Just 1 to 3', { parentId: question.id })

    expect(texts(await comments(target, teacher))).toEqual(['Which chapters?', 'Chapters 1 to 3, everyone'])
    expect(texts(await comments(target, s2))).toEqual(['Which chapters?', 'Chapters 1 to 3, everyone'])
    expect(texts((await comments(target, s2))![0]!.replies)).toEqual(['Just 1 to 3'])
    // Nothing of one student's words reaches another, the restricted minor's least of all.
    const s1Sees = (await comments(target, s1))!
    expect(texts(s1Sees)).toEqual(['Chapters 1 to 3, everyone'])
    expect(texts(s1Sees[0]!.replies)).toEqual(['Thanks'])
    expect(texts((await comments(target, s2))![1]!.replies)).toEqual([])
    expect((await comments(target, teacher))![1]!.replies.map((r) => r.author?.id)).toEqual([s1.id])
    expect((await notifications(s2)).find((n) => n.path === `/classes/${classroomId}`)).toMatchObject({ data: { kind: 'REPLY' }, actor: { id: teacher.id } })
  })
})
