import { InProcessEventBus } from '@lvn-backend/event-bus'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { createTestApp, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'

/**
 * Classrooms (§4.1, §5, ADR-0009, ADR-0011, ADR-0013, ADR-0046): codes that identify a class and admit nobody,
 * requests answered by staff, staff invites, roles, announcements by staff, and notes shared to a class read by its
 * members only. Co-teaching lets teachers share with each other without connecting.
 */
describe('classrooms', () => {
  let t: TestApp
  let db: PrismaService
  let bus: InProcessEventBus
  type Person = { id: string; handle: string; email: string; token: string }
  const person = async (opts: { teacher?: boolean; verified?: boolean; minor?: boolean; name?: string } = {}): Promise<Person> => {
    const u = await seedUser(t.app, { verified: opts.verified ?? true, globalRole: opts.teacher ? 'TEACHER' : 'STUDENT', displayName: opts.name ?? 'Someone' })
    if (opts.minor) await db.user.update({ where: { id: u.id }, data: { dateOfBirth: new Date('2015-03-01') } })
    return { id: u.id, handle: u.handle, email: u.email, token: tokenFor(t.config, u.id) }
  }
  /** Mutations whose input type is shared with others */
  const INPUT: Record<string, string> = { deleteClassroom: 'ClassroomIdInput', leaveClassroom: 'ClassroomIdInput', withdrawClassroomJoinRequest: 'JoinRequestIdInput', removeClassroomMember: 'ClassroomMemberInput', deleteClassroomPost: 'ClassroomPostIdInput' }
  type Res<T> = { data?: T; errors?: { message: string; extensions: { code: string } }[] }
  /** Runs a mutation and returns its payload, or the refusal's message and code. */
  const mutate = async (name: string, input: object, who: Person) => {
    const selection = name === 'deleteClassroom' ? 'ok userErrors { message code }' : 'classroom { id viewerRole } userErrors { message code }'
    const type = INPUT[name] ?? `${name[0]!.toUpperCase()}${name.slice(1)}Input`
    const res = (await t.gql(`mutation ($input: ${type}!) { ${name}(input: $input) { ${selection} } }`, { input }, who.token)) as Res<Record<string, { classroom?: { id: string; viewerRole: string | null } | null; userErrors: { message: string; code: string }[] }>>
    const payload = res.data?.[name]
    return { classroom: payload?.classroom ?? null, error: res.errors?.[0]?.message ?? payload?.userErrors[0]?.message, code: res.errors?.[0]?.extensions.code ?? payload?.userErrors[0]?.code }
  }
  const CLASS = 'id name description joinCode memberCount teacher { id } viewerRole viewerRequestId viewerInviteId viewerCan { requestJoin acceptInvite review post manage leave } members { user { id } role } joinRequests { id user { id } via } posts { edges { node { id author { id } viewerCanDelete } } }'
  type Classroom = {
    id: string; name: string; description: string | null; joinCode: string | null; memberCount: number; teacher: { id: string }; viewerRole: string | null; viewerRequestId: string | null; viewerInviteId: string | null
    viewerCan: Record<string, boolean>; members: { user: { id: string }; role: string }[] | null; joinRequests: { id: string; user: { id: string }; via: string }[] | null; posts: { edges: { node: { id: string; author: { id: string }; viewerCanDelete: boolean } }[] } | null
  }
  const classroom = async (id: string, who: Person) => ((await t.gql<{ classroom: Classroom | null }>(`query ($id: UUID!) { classroom(id: $id) { ${CLASS} } }`, { id }, who.token)).data?.classroom ?? null)
  const create = async (who: Person, name = 'Physics 9A') => (await mutate('createClassroom', { name }, who)).classroom!.id
  const codeOf = async (id: string, who: Person) => (await classroom(id, who))!.joinCode!
  const byCode = (code: string, who: Person) => t.gql<{ classroomByCode: { id: string; name: string; teacher: { id: string }; viewerRole: string | null; viewerRequestId: string | null } | null }>('query ($code: String!) { classroomByCode(code: $code) { id name teacher { id } viewerRole viewerRequestId } }', { code }, who.token)
  /** A student asks with the code and the teacher accepts: the usual way in. */
  const admit = async (id: string, teacher: Person, student: Person) => {
    await mutate('requestToJoinClassroom', { code: await codeOf(id, teacher) }, student)
    const req = (await classroom(id, teacher))!.joinRequests!.find((r) => r.user.id === student.id)!
    await mutate('reviewClassroomJoinRequest', { requestId: req.id, decision: 'APPROVED' }, teacher)
    await bus.drain()
  }
  const text = (s: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s }] }] })
  const notifications = async (who: Person) => {
    await bus.drain()
    return (await t.gql<{ notifications: { edges: { node: { category: string; data: unknown; classroom: { id: string } | null; actor: { id: string } | null } }[] } }>('{ notifications { edges { node { category data classroom { id } actor { id } } } } }', {}, who.token)).data!.notifications.edges.map((e) => e.node)
  }
  const newNote = async (who: Person, title: string) => {
    const noteId = (await t.gql<{ createNote: { note: { id: string } } }>('mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } } }', { input: { title, cards: [{ id: newId(), type: 'text', position: 'a0', content: { doc: text(title) } }] } }, who.token)).data!.createNote.note.id
    await t.gql('mutation ($input: NoteIdInput!) { publishNote(input: $input) { note { id } } }', { input: { noteId } }, who.token)
    return noteId
  }
  const reads = async (noteId: string, who: Person) => (await t.gql<{ note: { id: string } | null }>('query ($id: UUID!) { note(id: $id) { id } }', { id: noteId }, who.token)).data?.note?.id === noteId

  let teacher: Person
  let student: Person
  let outsider: Person

  beforeAll(async () => {
    t = await createTestApp()
    db = t.app.get(PrismaService)
    bus = t.app.get(InProcessEventBus)
    teacher = await person({ teacher: true, name: 'Ms Rao' })
    student = await person({ name: 'Asha' })
    outsider = await person({ name: 'Outsider' })
  })
  afterAll(() => t.close())

  it('teachers start classes, each with an eight-character code without look-alikes; nobody else does', async () => {
    const id = await create(teacher, '  Physics   9A ')
    const c = (await classroom(id, teacher))!
    expect(c).toMatchObject({ name: 'Physics 9A', teacher: { id: teacher.id }, viewerRole: 'TEACHER', memberCount: 1, viewerCan: { review: true, post: true, manage: true, leave: false } })
    expect(c.joinCode).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/)
    expect(await mutate('createClassroom', { name: 'Mine' }, student)).toMatchObject({ code: 'FORBIDDEN', error: 'Classes are run by teachers.' })
    expect((await mutate('createClassroom', { name: 'ab' }, teacher)).error).toMatch(/at least 3 characters/)
  })

  it('a code shows the class name and teacher only; the class itself is closed to outsiders', async () => {
    const id = await create(teacher, 'Closed room')
    const code = await codeOf(id, teacher)
    expect((await byCode(code.toLowerCase(), outsider)).data!.classroomByCode).toEqual({ id, name: 'Closed room', teacher: { id: teacher.id }, viewerRole: null, viewerRequestId: null })
    expect(await classroom(id, outsider)).toBeNull()
    expect((await byCode('ZZZZZZZZ', outsider)).data!.classroomByCode).toBeNull()
    // A new code replaces the old one, which stops working.
    await mutate('updateClassroom', { classroomId: id, newCode: true }, teacher)
    expect((await byCode(code, outsider)).data!.classroomByCode).toBeNull()
    expect(await codeOf(id, teacher)).not.toBe(code)
    expect((await mutate('updateClassroom', { classroomId: id, name: 'Mine now' }, outsider)).code).toBe('NOT_FOUND')
  })

  it('codes cannot be tried at random: 20 lookups an hour', async () => {
    const guesser = await person()
    for (let i = 0; i < 20; i++) expect((await byCode(`AAAAAA${String(i).padStart(2, '2')}`, guesser)).errors).toBeUndefined()
    expect((await byCode('AAAAAAAA', guesser)).errors?.[0]?.extensions.code).toBe('RATE_LIMITED')
  })

  it('a request with the code is answered by staff, who are told; the student hears the answer', async () => {
    const id = await create(teacher, 'Requests')
    const ta = await person({ name: 'TA Ravi' })
    await mutate('inviteToClassroom', { classroomId: id, person: ta.handle, role: 'TA' }, teacher)
    await mutate('answerClassroomInvite', { inviteId: (await classroom(id, ta))!.viewerInviteId, accept: true }, ta)
    await bus.drain()

    const asked = await mutate('requestToJoinClassroom', { code: await codeOf(id, teacher), via: 'LINK' }, student)
    expect(asked.classroom).toEqual({ id, viewerRole: null })
    expect((await classroom(id, student))!).toMatchObject({ viewerRequestId: expect.any(String), members: null, joinRequests: null, posts: null, joinCode: null })
    for (const staff of [teacher, ta]) expect((await notifications(staff)).find((n) => n.category === 'JOIN_REQUEST')).toEqual({ category: 'JOIN_REQUEST', data: null, classroom: { id }, actor: { id: student.id } })
    // Asking twice keeps one request.
    await mutate('requestToJoinClassroom', { code: await codeOf(id, teacher) }, student)
    const requests = (await classroom(id, ta))!.joinRequests!
    expect(requests).toEqual([{ id: expect.any(String), user: { id: student.id }, via: 'LINK' }])

    // A TA accepts; a student never does.
    const other = await person()
    await mutate('requestToJoinClassroom', { code: await codeOf(id, teacher) }, other)
    await mutate('reviewClassroomJoinRequest', { requestId: requests[0]!.id, decision: 'APPROVED' }, ta)
    await bus.drain()
    expect((await classroom(id, student))!).toMatchObject({ viewerRole: 'STUDENT', viewerCan: { review: false, post: false, leave: true }, members: null, joinCode: null })
    expect((await notifications(student)).find((n) => n.category === 'JOIN_DECISION')).toEqual({ category: 'JOIN_DECISION', data: { decision: 'APPROVED' }, classroom: { id }, actor: null })
    const second = (await classroom(id, teacher))!.joinRequests!.find((r) => r.user.id === other.id)!
    expect(await mutate('reviewClassroomJoinRequest', { requestId: second.id, decision: 'APPROVED' }, student)).toMatchObject({ code: 'FORBIDDEN' })
    await mutate('reviewClassroomJoinRequest', { requestId: second.id, decision: 'REJECTED' }, teacher)
    expect((await mutate('reviewClassroomJoinRequest', { requestId: second.id, decision: 'APPROVED' }, teacher)).error).toBe('That request was already answered.')
    expect(await classroom(id, other)).toBeNull()
    expect((await mutate('requestToJoinClassroom', { code: await codeOf(id, teacher) }, student)).error).toBe('You are already in this class.')
    expect((await mutate('requestToJoinClassroom', { code: await codeOf(id, teacher) }, await person({ verified: false }))).error).toBe('Verify your account to join classes.')
  })

  it('staff invite by handle or email; the invite is accepted within 14 days; only the teacher invites TAs', async () => {
    const id = await create(teacher, 'Invites')
    const ta = await person()
    await mutate('inviteToClassroom', { classroomId: id, person: ta.email, role: 'TA' }, teacher)
    expect((await notifications(ta)).find((n) => n.category === 'CLASSROOM_INVITE')).toEqual({ category: 'CLASSROOM_INVITE', data: null, classroom: { id }, actor: { id: teacher.id } })
    const invites = await t.gql<{ myClassroomInvites: { id: string; role: string; classroom: { id: string; name: string }; invitedBy: { id: string } }[] }>('{ myClassroomInvites { id role classroom { id name } invitedBy { id } } }', {}, ta.token)
    expect(invites.data!.myClassroomInvites).toEqual([{ id: expect.any(String), role: 'TA', classroom: { id, name: 'Invites' }, invitedBy: { id: teacher.id } }])
    expect((await mutate('answerClassroomInvite', { inviteId: invites.data!.myClassroomInvites[0]!.id, accept: true }, ta)).classroom).toEqual({ id, viewerRole: 'TA' })

    const pupil = await person()
    expect((await mutate('inviteToClassroom', { classroomId: id, person: pupil.handle, role: 'TA' }, ta)).error).toBe('Only the class’s teacher invites TAs.')
    await mutate('inviteToClassroom', { classroomId: id, person: pupil.handle }, ta)
    await mutate('inviteToClassroom', { classroomId: id, person: pupil.handle }, ta)
    expect(await db.classroomInvite.count({ where: { classroomId: id, invitedUserId: pupil.id } })).toBe(1)
    expect((await notifications(pupil)).filter((n) => n.category === 'CLASSROOM_INVITE')).toHaveLength(1)
    // An expired invite is gone; a declined one too.
    await db.classroomInvite.updateMany({ where: { classroomId: id, invitedUserId: pupil.id }, data: { expiresAt: new Date(Date.now() - 1000) } })
    expect(await classroom(id, pupil)).toBeNull()
    const late = (await db.classroomInvite.findFirstOrThrow({ where: { classroomId: id, invitedUserId: pupil.id } })).id
    expect((await mutate('answerClassroomInvite', { inviteId: late, accept: true }, pupil)).code).toBe('NOT_FOUND')
    await mutate('inviteToClassroom', { classroomId: id, person: pupil.handle }, teacher)
    const fresh = (await classroom(id, pupil))!.viewerInviteId!
    expect((await mutate('answerClassroomInvite', { inviteId: fresh, accept: false }, pupil)).classroom).toBeNull()
    expect(await classroom(id, pupil)).toBeNull()

    expect((await mutate('inviteToClassroom', { classroomId: id, person: 'nobody-here' }, teacher)).error).toBe('Nobody on LearnViaNotes has that handle or email.')
    expect((await mutate('inviteToClassroom', { classroomId: id, person: ta.handle }, teacher)).error).toBe('They are already in this class.')
    expect((await mutate('inviteToClassroom', { classroomId: id, person: pupil.handle }, outsider)).code).toBe('NOT_FOUND')
  })

  it('roles: the teacher changes them and hands the class to another teacher, then stays on as a TA', async () => {
    const id = await create(teacher, 'Roles')
    const pupil = await person()
    const colleague = await person({ teacher: true })
    await admit(id, teacher, pupil)
    await admit(id, teacher, colleague)
    expect((await mutate('setClassroomRole', { classroomId: id, userId: pupil.id, role: 'TA' }, pupil)).code).toBe('FORBIDDEN')
    expect((await mutate('setClassroomRole', { classroomId: id, userId: pupil.id, role: 'TEACHER' }, teacher)).error).toBe('Only a teacher can run a class.')
    await mutate('setClassroomRole', { classroomId: id, userId: pupil.id, role: 'TA' }, teacher)
    expect((await classroom(id, pupil))!.viewerRole).toBe('TA')
    expect((await mutate('leaveClassroom', { classroomId: id }, teacher)).error).toBe('Hand the class to another teacher before you leave it.')
    await mutate('setClassroomRole', { classroomId: id, userId: colleague.id, role: 'TEACHER' }, teacher)
    expect((await classroom(id, colleague))!).toMatchObject({ viewerRole: 'TEACHER', teacher: { id: colleague.id }, viewerCan: { manage: true } })
    expect((await classroom(id, teacher))!).toMatchObject({ viewerRole: 'TA', viewerCan: { manage: false, review: true } })
    expect((await mutate('removeClassroomMember', { classroomId: id, userId: pupil.id }, teacher)).code).toBe('FORBIDDEN')
    await mutate('removeClassroomMember', { classroomId: id, userId: pupil.id }, colleague)
    expect(await classroom(id, pupil)).toBeNull()
    await mutate('leaveClassroom', { classroomId: id }, teacher)
    expect(await classroom(id, teacher)).toBeNull()
    expect(await db.auditLog.count({ where: { targetId: id, action: { startsWith: 'classroom.' } } })).toBeGreaterThanOrEqual(4)
  })

  it('only staff post announcements; every other member is told and reads them', async () => {
    const id = await create(teacher, 'Announcements')
    const pupils = [await person(), await person()]
    for (const p of pupils) await admit(id, teacher, p)
    expect((await mutate('createClassroomPost', { classroomId: id, body: text('Can I post?') }, pupils[0]!)).error).toBe('Only the class’s teacher and TAs post announcements.')
    expect((await mutate('createClassroomPost', { classroomId: id, body: text('   ') }, teacher)).error).toBe('Write something first.')
    await mutate('createClassroomPost', { classroomId: id, body: text('Test on Friday') }, teacher)
    for (const p of pupils) {
      expect((await notifications(p)).filter((n) => n.category === 'CLASSROOM_POST')).toEqual([{ category: 'CLASSROOM_POST', data: null, classroom: { id }, actor: { id: teacher.id } }])
      expect((await classroom(id, p))!.posts!.edges.map((e) => e.node)).toEqual([{ id: expect.any(String), author: { id: teacher.id }, viewerCanDelete: false }])
    }
    expect((await notifications(teacher)).filter((n) => n.category === 'CLASSROOM_POST')).toEqual([])
    const postId = (await classroom(id, teacher))!.posts!.edges[0]!.node.id
    expect((await mutate('deleteClassroomPost', { postId }, pupils[0]!)).code).toBe('FORBIDDEN')
    await mutate('deleteClassroomPost', { postId }, teacher)
    expect((await classroom(id, pupils[1]!))!.posts!.edges).toEqual([])
  })

  it('notes staff share to a class are read by its members only, for as long as they are members', async () => {
    const id = await create(teacher, 'Class notes')
    await admit(id, teacher, student)
    const noteId = await newNote(teacher, 'Kinematics summary')
    const shared = await t.gql<{ shareNoteToClassroom: { note: { visibility: string; classrooms: { id: string }[] } } }>('mutation ($input: NoteClassroomInput!) { shareNoteToClassroom(input: $input) { note { visibility classrooms { id } } } }', { input: { noteId, classroomId: id } }, teacher.token)
    expect(shared.data!.shareNoteToClassroom.note).toEqual({ visibility: 'SHARED', classrooms: [{ id }] })
    const listed = async (who: Person) => (await t.gql<{ classroom: { sharedNotes: { edges: { node: { id: string } }[] } | null } | null }>('query ($id: UUID!) { classroom(id: $id) { sharedNotes { edges { node { id } } } } }', { id }, who.token)).data?.classroom?.sharedNotes?.edges.map((e) => e.node.id) ?? null
    expect(await reads(noteId, student)).toBe(true)
    expect(await listed(student)).toEqual([noteId])
    expect(await reads(noteId, outsider)).toBe(false)
    expect(await listed(outsider)).toBeNull()
    // Students do not share to the class; they share with a teacher one by one.
    const theirs = await newNote(student, 'My answers')
    const refused = await t.gql('mutation ($input: NoteClassroomInput!) { shareNoteToClassroom(input: $input) { note { id } } }', { input: { noteId: theirs, classroomId: id } }, student.token)
    expect(refused.errors?.[0]?.message).toBe('The class’s teacher and TAs share notes with it.')
    // Leaving ends it; so does the class's end.
    await mutate('leaveClassroom', { classroomId: id }, student)
    await bus.drain()
    expect(await reads(noteId, student)).toBe(false)
    const other = await person()
    await admit(id, teacher, other)
    expect(await reads(noteId, other)).toBe(true)
    expect((await mutate('deleteClassroom', { classroomId: id }, other)).code).toBe('FORBIDDEN')
    await mutate('deleteClassroom', { classroomId: id }, teacher)
    await bus.drain()
    expect(await reads(noteId, other)).toBe(false)
    expect(await classroom(id, other)).toBeNull()
  })

  it('teachers who teach a class together share with each other without connecting (ADR-0013)', async () => {
    const colleague = await person({ teacher: true })
    const noteId = await newNote(teacher, 'Lab plan')
    const shareWith = async (who: Person) => {
      const res = await t.gql<{ shareNote: { note: { id: string } | null; userErrors: { message: string }[] } }>('mutation ($input: ShareNoteInput!) { shareNote(input: $input) { note { id } userErrors { message } } }', { input: { noteId, person: who.handle, role: 'VIEWER' } }, teacher.token)
      return res.errors?.[0]?.message ?? res.data!.shareNote.userErrors[0]?.message ?? null
    }
    expect(await shareWith(colleague)).toBe('Teachers share with other teachers once they are connected or teach a class together.')
    const id = await create(teacher, 'Co-taught')
    // A student of the class is not a co-teacher.
    await admit(id, teacher, colleague)
    expect(await shareWith(colleague)).toBe('Teachers share with other teachers once they are connected or teach a class together.')
    await mutate('setClassroomRole', { classroomId: id, userId: colleague.id, role: 'TA' }, teacher)
    await bus.drain()
    expect(await shareWith(colleague)).toBeNull()
    expect(await reads(noteId, colleague)).toBe(true)
  })

  it('a restricted minor joins and reads a class; only staff see who is in it', async () => {
    const id = await create(teacher, 'Young learners')
    const minor = await person({ minor: true })
    await admit(id, teacher, minor)
    await admit(id, teacher, student)
    expect((await classroom(id, minor))!).toMatchObject({ viewerRole: 'STUDENT', memberCount: 3, members: null })
    expect((await classroom(id, student))!.members).toBeNull()
    expect((await classroom(id, teacher))!.members!.map((m) => m.user.id).sort()).toEqual([teacher.id, minor.id, student.id].sort())
  })

  it('the plan limits how many classes a teacher runs and how many people join (ADR-0024)', async () => {
    const free = await db.plan.findUniqueOrThrow({ where: { code: 'FREE' } })
    const rows = await Promise.all([
      db.entitlement.create({ data: { id: newId(), planId: free.id, key: 'CLASSROOMS_OWNED', limit: 1n, appliesToRole: 'TEACHER' } }),
      db.entitlement.create({ data: { id: newId(), planId: free.id, key: 'CLASSROOM_MEMBERS', limit: 2n, appliesToRole: 'TEACHER' } }),
    ])
    try {
      const fresh = await person({ teacher: true })
      const id = await create(fresh, 'Only one')
      expect((await mutate('createClassroom', { name: 'Second' }, fresh)).error).toBe("You've reached your plan's limit for classes.")
      await admit(id, fresh, await person())
      const third = await person()
      await mutate('requestToJoinClassroom', { code: await codeOf(id, fresh) }, third)
      const req = (await classroom(id, fresh))!.joinRequests![0]!
      expect((await mutate('reviewClassroomJoinRequest', { requestId: req.id, decision: 'APPROVED' }, fresh)).error).toBe("You've reached your plan's limit for class members.")
    } finally {
      await db.entitlement.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } })
    }
  })
})
