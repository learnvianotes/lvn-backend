import { InProcessEventBus } from '@lvn-backend/event-bus'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { createTestApp, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'

/**
 * Account standing (§15.1, ADR-0053): platform moderators warn an account, which then reads the warning; suspend it
 * for some days, during which nothing it does reaches other people, and lift it when the one appeal succeeds; and
 * remove a group, whose owner reads why and may appeal once to have it put back.
 */
describe('account standing', () => {
  let t: TestApp
  let db: PrismaService
  let bus: InProcessEventBus
  type Person = { id: string; handle: string; token: string }
  const person = async (opts: { teacher?: boolean; admin?: boolean; name?: string } = {}): Promise<Person> => {
    const u = await seedUser(t.app, { verified: true, globalRole: opts.admin ? 'PLATFORM_ADMIN' : opts.teacher ? 'TEACHER' : 'STUDENT', displayName: opts.name ?? 'Someone' })
    return { id: u.id, handle: u.handle, token: tokenFor(t.config, u.id) }
  }
  const text = (s: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s }] }] })
  const gql = async <T>(query: string, variables: object, who: Person) => {
    const res = await t.gql<T>(query, variables as Record<string, unknown>, who.token)
    if (res.errors) throw new Error(res.errors[0]!.message)
    return res.data!
  }
  /** A mutation's outcome: true, or the refusal (GraphQL error or first user error) as `code: message`. */
  const attempt = async (mutation: string, input: object, who: Person, type: string, selection = 'userErrors { message code }'): Promise<true | string> => {
    const res = await t.gql<Record<string, { userErrors: { message: string; code: string }[] }>>(`mutation ($input: ${type}!) { ${mutation}(input: $input) { ${selection} } }`, { input }, who.token)
    if (res.errors) return `${(res.errors[0] as { extensions: { code: string } }).extensions.code}: ${res.errors[0]!.message}`
    const e = res.data![mutation]!.userErrors[0]
    return e ? `${e.code}: ${e.message}` : true
  }
  const report = (who: Person, entityType: string, entityId: string) => attempt('reportContent', { entityType, entityId, reason: 'HARASSMENT' }, who, 'ReportContentInput', 'ok userErrors { message code }')
  const decide = (who: Person, entityType: string, entityId: string, action: string, reason?: string, suspendDays?: number) =>
    attempt('moderateContent', { entityType, entityId, action, reason, suspendDays }, who, 'ModerateContentInput', 'ok userErrors { message code }')
  const appeal = (who: Person, entityType: string, entityId: string, message: string) => attempt('appealModeration', { entityType, entityId, message }, who, 'AppealModerationInput', 'ok userErrors { message code }')
  type Standing = { suspendedUntil: string | null; suspensionReason: string | null; canAppeal: boolean; warnings: { reason: string; at: string }[] }
  const standing = async (who: Person) => (await gql<{ myStanding: Standing }>('{ myStanding { suspendedUntil suspensionReason canAppeal warnings { reason at } } }', {}, who)).myStanding
  const told = async (who: Person) => {
    await bus.drain()
    return (await gql<{ notifications: { edges: { node: { category: string; data: unknown; path: string } }[] } }>('{ notifications { edges { node { category data path } } } }', {}, who)).notifications.edges.map((e) => e.node).filter((n) => n.category === 'MODERATION')
  }
  const createGroup = (who: Person, name = 'Heaps club') =>
    attempt('createGroup', { name, privacy: 'PUBLIC', joinPolicy: 'OPEN' }, who, 'CreateGroupInput', 'group { id } userErrors { message code }')
  type Case = { entityType: string; entityId: string; suspendedUntil: string | null; removedGroup: { id: string; name: string; reason: string } | null; appeal: { message: string } | null }
  const platformCase = async (entityType: string, entityId: string) =>
    (await gql<{ moderationQueue: { edges: { node: Case }[] } }>('{ moderationQueue(first: 100) { edges { node { entityType entityId suspendedUntil removedGroup { id name reason } appeal { message } } } } }', {}, admin)).moderationQueue.edges
      .map((e) => e.node)
      .find((c) => c.entityType === entityType && c.entityId === entityId)

  let admin: Person
  beforeAll(async () => {
    t = await createTestApp()
    db = t.app.get(PrismaService)
    bus = t.app.get(InProcessEventBus)
    admin = await person({ admin: true, name: 'Platform Admin' })
  })
  afterAll(() => t.close())

  it('a warned account reads the warning and is told, without the reason in the notification', async () => {
    const asha = await person({ name: 'Asha' })
    const ravi = await person({ name: 'Ravi' })
    expect(await report(asha, 'USER', ravi.id)).toBe(true)
    expect(await decide(admin, 'USER', ravi.id, 'WARN')).toBe('VALIDATION: Say why: the author is told.')
    expect(await decide(admin, 'USER', ravi.id, 'WARN', 'Keep comments about the work, not the person.')).toBe(true)
    expect(await standing(ravi)).toEqual({ suspendedUntil: null, suspensionReason: null, canAppeal: false, warnings: [{ reason: 'Keep comments about the work, not the person.', at: expect.any(String) }] })
    expect(await told(ravi)).toEqual([{ category: 'MODERATION', data: { kind: 'WARNED', entityType: 'USER' }, path: '/profile' }])
    // Nobody else reads it: myStanding is always the viewer's own.
    expect((await standing(asha)).warnings).toEqual([])
    // Warnings are not appealed.
    expect(await appeal(ravi, 'USER', ravi.id, 'I was joking')).toBe('VALIDATION: Your account is not suspended.')
  })

  it('a suspension stops everything that reaches others; one appeal; lifting it gives it all back', async () => {
    const reporter = await person({ name: 'Reporter' })
    const dev = await person({ name: 'Dev' })
    const other = await person({ teacher: true, name: 'Ms Rao' })
    const noteId = (await gql<{ createNote: { note: { id: string } } }>('mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } } }', { input: { title: 'Heaps', cards: [{ id: newId(), type: 'text', position: 'a0', content: { doc: text('A heap is a tree') } }] } }, dev)).createNote.note.id
    await gql('mutation ($id: UUID!) { publishNote(input: { noteId: $id }) { note { id } } }', { id: noteId }, dev)
    await gql('mutation ($id: UUID!) { changeNoteVisibility(input: { noteId: $id, visibility: SHARED }) { note { id } } }', { id: noteId }, dev)
    expect(await report(reporter, 'USER', dev.id)).toBe(true)

    // Only platform admins suspend, only accounts, for 1 to 365 days, never themselves.
    expect(await decide(reporter, 'USER', dev.id, 'SUSPEND', 'Spam', 7)).toMatch(/^FORBIDDEN/)
    expect(await decide(admin, 'USER', dev.id, 'SUSPEND', 'Spam')).toBe('VALIDATION: Suspend for 1 to 365 days.')
    expect(await decide(admin, 'USER', dev.id, 'SUSPEND', 'Spam', 400)).toBe('VALIDATION: Suspend for 1 to 365 days.')
    expect(await decide(admin, 'NOTE', noteId, 'SUSPEND', 'Spam', 7)).toBe('VALIDATION: Only accounts are suspended.')
    expect(await decide(admin, 'USER', dev.id, 'APPROVE')).toBe('VALIDATION: This account is not suspended.')
    expect(await decide(admin, 'USER', dev.id, 'SUSPEND', 'Posting the same link everywhere.', 7)).toBe(true)

    const s = await standing(dev)
    expect(s).toMatchObject({ suspensionReason: 'Posting the same link everywhere.', canAppeal: true })
    expect(new Date(s.suspendedUntil!).getTime() - Date.now()).toBeGreaterThan(6.9 * 86_400_000)
    expect(await told(dev)).toEqual([{ category: 'MODERATION', data: { kind: 'SUSPENDED', entityType: 'USER' }, path: '/profile' }])

    // Nothing reaches anyone…
    expect(await createGroup(dev)).toMatch(/^FORBIDDEN/)
    expect(await attempt('followUser', { userId: other.id }, dev, 'PersonInput', 'user { id } userErrors { message code }')).toMatch(/^FORBIDDEN/)
    expect(await attempt('publishNote', { noteId }, dev, 'NoteIdInput', 'note { id } userErrors { message code }')).toMatch(/^FORBIDDEN/)
    expect(await attempt('changeNoteVisibility', { noteId, visibility: 'PUBLIC' }, dev, 'ChangeNoteVisibilityInput', 'note { id } userErrors { message code }')).toMatch(/^FORBIDDEN/)
    expect(await attempt('addComment', { target: { type: 'NOTE', id: noteId }, body: text('hello') }, dev, 'AddCommentInput', 'comment { id } userErrors { message code }')).toMatch(/^FORBIDDEN/)
    // …but the account keeps its own notes, takes them back to private and reports.
    expect(await attempt('createNote', { title: 'Private thoughts' }, dev, 'CreateNoteInput', 'note { id } userErrors { message code }')).toBe(true)
    expect(await attempt('changeNoteVisibility', { noteId, visibility: 'PRIVATE' }, dev, 'ChangeNoteVisibilityInput', 'note { id } userErrors { message code }')).toBe(true)
    expect(await report(dev, 'USER', reporter.id)).toBe(true)

    // One appeal, by the suspended person only; it reopens the case for platform admins, with the suspension shown.
    expect(await appeal(reporter, 'USER', dev.id, 'Let them back')).toBe('NOT_FOUND: That is not there any more.')
    expect(await appeal(dev, 'USER', dev.id, 'It was a class announcement, not spam.')).toBe(true)
    expect(await appeal(dev, 'USER', dev.id, 'Again')).toBe('VALIDATION: You have already appealed for this.')
    expect((await standing(dev)).canAppeal).toBe(false)
    expect(await platformCase('USER', dev.id)).toMatchObject({ suspendedUntil: s.suspendedUntil, appeal: { message: 'It was a class announcement, not spam.' } })

    expect(await decide(admin, 'USER', dev.id, 'APPROVE')).toBe(true)
    expect(await standing(dev)).toMatchObject({ suspendedUntil: null, suspensionReason: null, canAppeal: false })
    expect(await createGroup(dev, 'Back again')).toBe(true)
    expect((await told(dev)).map((n) => n.data)).toEqual([{ kind: 'RESTORED', entityType: 'USER' }, { kind: 'SUSPENDED', entityType: 'USER' }])

    // A later suspension can be appealed again; it ends by itself when its time is up.
    expect(await report(reporter, 'USER', dev.id)).toBe(true)
    expect(await decide(admin, 'USER', dev.id, 'SUSPEND', 'Again the same link.', 1)).toBe(true)
    expect((await standing(dev)).canAppeal).toBe(true)
    await db.user.update({ where: { id: dev.id }, data: { suspendedUntil: new Date(Date.now() - 1000) } })
    expect((await standing(dev)).suspendedUntil).toBeNull()
    expect(await createGroup(dev, 'Free again')).toBe(true)
  })

  it('a removed group: members lose it and its notes, its owner reads why and appeals once, and it comes back', async () => {
    const owner = await person({ name: 'Owner' })
    const member = await person({ name: 'Member' })
    const reporter = await person({ name: 'Reporter' })
    const groupId = (await gql<{ createGroup: { group: { id: string } } }>('mutation { createGroup(input: { name: "Exam leaks", privacy: PUBLIC, joinPolicy: OPEN }) { group { id } } }', {}, owner)).createGroup.group.id
    for (const p of [member, reporter]) await gql('mutation ($id: UUID!) { joinGroup(input: { groupId: $id }) { group { id } } }', { id: groupId }, p)
    const noteId = (await gql<{ createNote: { note: { id: string } } }>('mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } } }', { input: { title: 'Week 1', cards: [{ id: newId(), type: 'text', position: 'a0', content: { doc: text('BFS first') } }] } }, owner)).createNote.note.id
    await gql('mutation ($input: NoteGroupInput!) { shareNoteToGroup(input: $input) { note { id } } }', { input: { noteId, groupId } }, owner)
    await gql('mutation ($id: UUID!) { publishNote(input: { noteId: $id }) { note { id } } }', { id: noteId }, owner)
    await bus.drain()
    const readsNote = async (who: Person) => (await gql<{ note: { id: string } | null }>('query ($id: UUID!) { note(id: $id) { id } }', { id: noteId }, who)).note !== null
    const seesGroup = async (who: Person) => (await gql<{ group: { id: string } | null }>('query ($id: UUID!) { group(id: $id) { id } }', { id: groupId }, who)).group !== null
    const removed = async (who: Person) => (await gql<{ removedGroup: { name: string; reason: string; canAppeal: boolean } | null }>('query ($id: UUID!) { removedGroup(id: $id) { name reason canAppeal } }', { id: groupId }, who)).removedGroup
    expect(await readsNote(member)).toBe(true)

    expect(await report(reporter, 'GROUP', groupId)).toBe(true)
    expect(await decide(admin, 'GROUP', groupId, 'APPROVE')).toBe('VALIDATION: Only a group moderators removed can be put back.')
    expect(await decide(admin, 'GROUP', groupId, 'REMOVE', 'Shares exam papers before the exam.')).toBe(true)
    await bus.drain()
    expect(await seesGroup(member)).toBe(false)
    expect(await seesGroup(owner)).toBe(false)
    expect(await readsNote(member)).toBe(false)
    expect(await removed(owner)).toEqual({ name: 'Exam leaks', reason: 'Shares exam papers before the exam.', canAppeal: true })
    // The reason is the owner's alone.
    expect(await removed(member)).toBeNull()
    expect(await told(owner)).toEqual([{ category: 'MODERATION', data: { kind: 'REMOVED', entityType: 'GROUP' }, path: `/groups/${groupId}` }])

    expect(await appeal(member, 'GROUP', groupId, 'Bring it back')).toBe('NOT_FOUND: That is not there any more.')
    expect(await appeal(owner, 'GROUP', groupId, 'These were last year’s papers, shared by the teacher.')).toBe(true)
    expect(await appeal(owner, 'GROUP', groupId, 'Again')).toBe('VALIDATION: You have already appealed for this.')
    expect((await removed(owner))!.canAppeal).toBe(false)
    expect(await platformCase('GROUP', groupId)).toMatchObject({ removedGroup: { id: groupId, name: 'Exam leaks', reason: 'Shares exam papers before the exam.' }, appeal: { message: 'These were last year’s papers, shared by the teacher.' } })

    expect(await decide(admin, 'GROUP', groupId, 'APPROVE')).toBe(true)
    await bus.drain()
    expect(await seesGroup(member)).toBe(true)
    expect(await readsNote(member)).toBe(true)
    expect(await removed(owner)).toBeNull()
    expect((await told(owner)).map((n) => n.data)).toEqual([{ kind: 'RESTORED', entityType: 'GROUP' }, { kind: 'REMOVED', entityType: 'GROUP' }])
  })

  it('a group its owner deleted is not a removed group and cannot be appealed', async () => {
    const owner = await person({ name: 'Owner' })
    const groupId = (await gql<{ createGroup: { group: { id: string } } }>('mutation { createGroup(input: { name: "Gone", privacy: PUBLIC, joinPolicy: OPEN }) { group { id } } }', {}, owner)).createGroup.group.id
    await gql('mutation ($id: UUID!) { deleteGroup(input: { groupId: $id }) { ok } }', { id: groupId }, owner)
    expect((await gql<{ removedGroup: unknown }>('query ($id: UUID!) { removedGroup(id: $id) { id } }', { id: groupId }, owner)).removedGroup).toBeNull()
    expect(await appeal(owner, 'GROUP', groupId, 'Please')).toBe('VALIDATION: Only a group moderators removed can be appealed.')
  })
})
