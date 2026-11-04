import { AccountDeletionService } from '@lvn-backend/users'
import { InProcessEventBus } from '@lvn-backend/event-bus'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { createTestApp, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'

/**
 * Account deletion (ADR-0088): asked for with the password and the word DELETE, cancellable for 14 days, then the
 * account's private material goes from every context while what it made public stays, by "Deleted user"; a group it
 * owned passes to its admin; the deletion is announced again and erasing twice changes nothing.
 */
describe('account deletion', () => {
  let t: TestApp
  let db: PrismaService
  let bus: InProcessEventBus
  let deletion: AccountDeletionService
  const DAY = 86_400_000
  const ERRORS = 'userErrors { field message code }'
  const PASSWORD = 'a long passphrase for asha'
  let asha = { id: '', token: '', other: '' }
  let ravi = { id: '', token: '' }
  let privateNote = ''
  let publicNote = ''
  let groupId = ''

  const gql = async <T>(query: string, variables: object, token?: string) => {
    const res = await t.gql<T>(query, variables, token)
    if (res.errors) throw new Error(JSON.stringify(res.errors))
    return res.data!
  }
  const ask = (input: object, token = asha.token) =>
    t.gql<{ requestAccountDeletion: { deletionScheduledFor: string | null; userErrors: { field: string[] | null; message: string }[] } }>(`mutation ($input: RequestAccountDeletionInput!) { requestAccountDeletion(input: $input) { deletionScheduledFor ${ERRORS} } }`, { input }, token)
  const note = async (title: string, token: string) => (await gql<{ createNote: { note: { id: string } } }>(`mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } ${ERRORS} } }`, { input: { title, cards: [{ id: newId(), type: 'text', position: 'a0', content: { doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: `${title}, in Asha's words.` }] }] } } }] } }, token)).createNote.note.id

  beforeAll(async () => {
    t = await createTestApp()
    db = t.app.get(PrismaService)
    bus = t.app.get(InProcessEventBus)
    deletion = t.app.get(AccountDeletionService)
    const terms = (await gql<{ termsVersion: string }>('{ termsVersion }', {})).termsVersion
    const email = `asha-${newId().slice(-8)}@example.com`
    const signUp = await gql<{ signUp: { session: { accessToken: string; user: { id: string } } } }>(`mutation ($input: SignUpInput!) { signUp(input: $input) { session { accessToken user { id } } ${ERRORS} } }`, { input: { email, password: PASSWORD, displayName: 'Asha Rao', age: 23, acceptedTermsVersion: terms } })
    const signIn = await gql<{ signIn: { session: { accessToken: string } } }>(`mutation ($input: SignInInput!) { signIn(input: $input) { session { accessToken } ${ERRORS} } }`, { input: { email, password: PASSWORD } })
    // Two devices: the phone asks; the laptop is signed out.
    asha = { id: signUp.signUp.session.user.id, token: signIn.signIn.session.accessToken, other: signUp.signUp.session.accessToken }
    const r = await seedUser(t.app, { verified: true, displayName: 'Ravi Kumar' })
    ravi = { id: r.id, token: tokenFor(t.config, r.id) }
    await db.user.update({ where: { id: asha.id }, data: { verifiedAt: new Date(), verificationMethod: 'INSTITUTIONAL_EMAIL' } })

    privateNote = await note('My diary', asha.token)
    publicNote = await note('Graphs explained', asha.token)
    await gql('mutation ($input: NoteIdInput!) { publishNote(input: $input) { note { id } } }', { input: { noteId: publicNote } }, asha.token)
    await gql('mutation ($input: ChangeNoteVisibilityInput!) { changeNoteVisibility(input: $input) { note { id } } }', { input: { noteId: publicNote, visibility: 'PUBLIC' } }, asha.token)
    groupId = (await gql<{ createGroup: { group: { id: string } } }>(`mutation { createGroup(input: { name: "Graph study", privacy: PUBLIC, joinPolicy: OPEN }) { group { id } ${ERRORS} } }`, {}, asha.token)).createGroup.group.id
    await gql('mutation ($id: UUID!) { joinGroup(input: { groupId: $id }) { group { id } } }', { id: groupId }, ravi.token)
    await gql(`mutation ($input: SetGroupRoleInput!) { setGroupRole(input: $input) { ${ERRORS} } }`, { input: { groupId, userId: ravi.id, role: 'ADMIN' } }, asha.token)
    await gql(`mutation ($input: PersonInput!) { followUser(input: $input) { ${ERRORS} } }`, { input: { userId: ravi.id } }, asha.token)
    await db.exam.create({ data: { id: newId(), userId: asha.id, name: 'Algorithms final', date: new Date(Date.now() + 30 * DAY) } })
  })

  afterAll(async () => {
    await t?.close()
  })

  it('asks for the password and DELETE, then schedules the deletion and signs out every other device', async () => {
    expect((await ask({ password: PASSWORD, confirm: 'yes' })).data!.requestAccountDeletion.userErrors[0]).toMatchObject({ field: ['input', 'confirm'], message: 'Type DELETE to confirm.' })
    expect((await ask({ password: 'wrong', confirm: 'DELETE' })).data!.requestAccountDeletion.userErrors[0]).toMatchObject({ field: ['input', 'password'], message: 'That password is not right.' })
    const asked = (await ask({ password: PASSWORD, confirm: 'delete' })).data!.requestAccountDeletion
    expect(asked.userErrors).toEqual([])
    expect(Math.round((new Date(asked.deletionScheduledFor!).getTime() - Date.now()) / DAY)).toBe(14)
    expect((await gql<{ viewer: { deletionScheduledFor: string } }>('{ viewer { deletionScheduledFor } }', {}, asha.token)).viewer.deletionScheduledFor).toBe(asked.deletionScheduledFor)
    // The laptop's session ended; the phone that asked still works.
    const live = await db.session.findMany({ where: { userId: asha.id, revokedAt: null } })
    expect(live).toHaveLength(1)
    expect((await t.gql('{ viewer { id } }', {}, asha.other)).data?.viewer ?? null).toBeNull()
    // Nobody else sees when.
    const handle = (await db.user.findUniqueOrThrow({ where: { id: asha.id } })).handle
    expect((await gql<{ userByHandle: { deletionScheduledFor: string | null } | null }>('query ($h: String!) { userByHandle(handle: $h) { deletionScheduledFor } }', { h: handle }, ravi.token)).userByHandle?.deletionScheduledFor ?? null).toBeNull()
  })

  it('can be cancelled within the grace, and asked for again', async () => {
    expect((await gql<{ cancelAccountDeletion: { deletionScheduledFor: string | null } }>(`mutation { cancelAccountDeletion { deletionScheduledFor ${ERRORS} } }`, {}, asha.token)).cancelAccountDeletion.deletionScheduledFor).toBeNull()
    expect((await deletion.deleteDue(new Date(Date.now() + 30 * DAY))).deleted).toBe(0)
    expect((await ask({ password: PASSWORD, confirm: 'DELETE' })).data!.requestAccountDeletion.userErrors).toEqual([])
    expect((await deletion.deleteDue(new Date(Date.now() + 13 * DAY))).deleted).toBe(0)
  })

  it('after 14 days deletes what was private, keeps what was public by "Deleted user", and hands the group on', async () => {
    expect(await deletion.deleteDue(new Date(Date.now() + 15 * DAY))).toEqual({ deleted: 1, announced: 0 })
    await bus.drain()
    const user = await db.user.findUniqueOrThrow({ where: { id: asha.id } })
    expect(user).toMatchObject({ displayName: 'Deleted user', passwordHash: null, dateOfBirth: null, declaredAge: null, ageDeclaredAt: null, verifiedAt: null })
    expect(user.email).toMatch(/\.invalid$/)
    expect(user.deletedAt).not.toBeNull()
    expect(await db.session.count({ where: { userId: asha.id } })).toBe(0)
    expect(await db.follow.count({ where: { followerId: asha.id } })).toBe(0)
    expect(await db.exam.count({ where: { userId: asha.id } })).toBe(0)
    expect(await db.note.findUnique({ where: { id: privateNote } })).toBeNull()
    expect(await db.note.findUnique({ where: { id: publicNote } })).not.toBeNull()
    expect(await db.group.findUniqueOrThrow({ where: { id: groupId } })).toMatchObject({ ownerId: ravi.id, deletedAt: null })
    expect(await db.groupMember.findUnique({ where: { groupId_userId: { groupId, userId: ravi.id } } })).toMatchObject({ role: 'OWNER' })

    // What others still read names nobody.
    const read = await gql<{ note: { title: string; owner: { displayName: string; handle: string } } | null }>('query ($id: UUID!) { note(id: $id) { title owner { displayName handle } } }', { id: publicNote }, ravi.token)
    expect(read.note).toMatchObject({ title: 'Graphs explained', owner: { displayName: 'Deleted user' } })
    expect(read.note!.owner.handle).toMatch(/^deleted-/)
    // The account cannot be signed into, and its old token reads nothing.
    expect((await t.gql('{ viewer { id } }', {}, asha.token)).data?.viewer ?? null).toBeNull()
  })

  it('is announced again on the following nights, and erasing twice changes nothing', async () => {
    expect(await deletion.deleteDue(new Date(Date.now() + 16 * DAY))).toEqual({ deleted: 0, announced: 1 })
    await bus.drain()
    expect(await db.note.findUnique({ where: { id: publicNote } })).not.toBeNull()
    expect(await db.user.findUniqueOrThrow({ where: { id: asha.id } })).toMatchObject({ displayName: 'Deleted user' })
  })
})
