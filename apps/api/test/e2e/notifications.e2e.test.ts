import { AccessTokenSigner } from '@lvn-backend/auth-guard'
import { NotificationService } from '@lvn-backend/communication'
import { InProcessEventBus } from '@lvn-backend/event-bus'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { TOKEN_AUDIENCE } from '../../src/app.module'
import { createTestApp, type TestApp } from '../support/app'
import { liveUrl, openLive } from '../support/live'
import { seedUser, tokenFor } from '../support/seed'

/**
 * In-app notifications and live updates (§9.2, §9.3, ADR-0042): written from events, read and marked by their owner
 * only, pointing at notes through the notes subgraph's own read check, and announced over graphql-ws — across API
 * instances, to valid tokens only.
 */
describe('notifications', () => {
  let t: TestApp
  let db: PrismaService
  let bus: InProcessEventBus
  let url: string
  type Person = { id: string; handle: string; token: string; sessionId: string }
  let owner: Person
  let reader: Person
  let other: Person

  const person = async (verified = true): Promise<Person> => {
    const u = await seedUser(t.app, { verified, displayName: `Person ${newId().slice(-4)}` })
    const sessionId = newId()
    return { id: u.id, handle: u.handle, sessionId, token: tokenFor(t.config, u.id, sessionId) }
  }
  const createNote = async (title: string) =>
    (await t.gql<{ createNote: { note: { id: string } } }>('mutation ($t: String!) { createNote(input: { title: $t }) { note { id } } }', { t: title }, owner.token)).data!.createNote.note.id
  // Editors read the draft; viewers only a published version (§4.3), and these notes are never published.
  const share = (noteId: string, to: Person, role = 'EDITOR') =>
    t.gql('mutation ($input: ShareNoteInput!) { shareNote(input: $input) { userErrors { message } } }', { input: { noteId, person: to.handle, role } }, owner.token)
  const LIST = 'query ($after: String) { notifications(first: 2, after: $after) { edges { node { id category path readAt data actor { id displayName } note { id title } } } pageInfo { hasNextPage endCursor } } unreadNotificationCount }'
  type Listed = { notifications: { edges: { node: { id: string; category: string; path: string; readAt: string | null; data: unknown; actor: { id: string; displayName: string } | null; note: { id: string; title: string } | null } }[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } }; unreadNotificationCount: number }
  const list = async (who: Person, after?: string) => (await t.gql<Listed>(LIST, { after }, who.token)).data!

  beforeAll(async () => {
    t = await createTestApp()
    db = t.app.get(PrismaService)
    bus = t.app.get(InProcessEventBus)
    url = await liveUrl(t)
    owner = await person()
    reader = await person()
    other = await person()
  })
  afterAll(() => t.close())

  it('tells the person a note is shared with, live, and names who shared which note', async () => {
    const live = await openLive(url, reader.token)
    const noteId = await createNote('Binary heaps')
    expect((await share(noteId, reader)).data).toMatchObject({ shareNote: { userErrors: [] } })
    const event = await live.next()
    expect(event).toMatchObject({ kind: 'NOTIFICATION', id: expect.any(String) })
    await live.close()

    const seen = await list(reader)
    expect(seen.unreadNotificationCount).toBe(1)
    expect(seen.notifications.edges[0]!.node).toEqual({
      id: event.id,
      category: 'SHARE',
      path: `/notes/${noteId}`,
      readAt: null,
      data: null,
      actor: { id: owner.id, displayName: expect.stringMatching(/^Person /) },
      note: { id: noteId, title: 'Binary heaps' },
    })
    // Sharing again (a role change) does not notify twice.
    await share(noteId, reader, 'VIEWER')
    await bus.drain()
    expect((await list(reader)).unreadNotificationCount).toBe(1)
  })

  it('never shows a note the person can no longer read', async () => {
    const noteId = await createNote('Graphs')
    await share(noteId, reader)
    await bus.drain()
    await t.gql('mutation ($input: UnshareNoteInput!) { unshareNote(input: $input) { userErrors { message } } }', { input: { noteId, userId: reader.id } }, owner.token)
    const node = (await list(reader)).notifications.edges.find((e) => e.node.path === `/notes/${noteId}`)!.node
    expect(node).toMatchObject({ category: 'SHARE', note: null, actor: { id: owner.id } })
  })

  it('pages newest first, and only the owner reads or marks them', async () => {
    const first = await list(reader)
    expect(first.notifications.edges).toHaveLength(2)
    expect(first.notifications.pageInfo.hasNextPage).toBe(false)
    const ids = first.notifications.edges.map((e) => e.node.id)

    // Someone else sees none of them and cannot mark them.
    expect((await list(other)).notifications.edges).toEqual([])
    const sneaky = await t.gql<{ markNotificationsRead: { unreadCount: number } }>('mutation ($ids: [UUID!]) { markNotificationsRead(input: { ids: $ids }) { unreadCount } }', { ids }, other.token)
    expect(sneaky.data!.markNotificationsRead.unreadCount).toBe(0)
    expect((await list(reader)).unreadNotificationCount).toBe(2)

    const one = await t.gql<{ markNotificationsRead: { unreadCount: number } }>('mutation ($ids: [UUID!]) { markNotificationsRead(input: { ids: $ids }) { unreadCount } }', { ids: [ids[0]] }, reader.token)
    expect(one.data!.markNotificationsRead.unreadCount).toBe(1)
    const all = await t.gql<{ markNotificationsRead: { unreadCount: number } }>('mutation { markNotificationsRead(input: { all: true }) { unreadCount } }', {}, reader.token)
    expect(all.data!.markNotificationsRead.unreadCount).toBe(0)
    const empty = await t.gql<{ markNotificationsRead: { userErrors: { field: string[] }[] } }>('mutation { markNotificationsRead(input: { ids: [] }) { userErrors { field } } }', {}, reader.token)
    expect(empty.data!.markNotificationsRead.userErrors).toEqual([{ field: ['ids'] }])

    expect((await t.gql(LIST, {})).errors?.[0]?.extensions.code).toBe('UNAUTHENTICATED')
  })

  it('pages with a cursor', async () => {
    const service = t.app.get(NotificationService)
    const who = await person()
    for (let i = 0; i < 3; i++) await service.notify({ userId: who.id, category: 'DATA_EXPORT', path: '/profile' })
    const page1 = await list(who)
    expect(page1.notifications.pageInfo.hasNextPage).toBe(true)
    const page2 = await list(who, page1.notifications.pageInfo.endCursor!)
    expect(page2.notifications.edges).toHaveLength(1)
    expect(new Set([...page1.notifications.edges, ...page2.notifications.edges].map((e) => e.node.id)).size).toBe(3)
  })

  it('writes the notifications of verification, exports and imports from their events, never naming platform admins', async () => {
    const student = await person(false)
    const teacher = await person()
    const admin = newId()
    await bus.publish('VerificationRequested', { requestId: newId(), userId: student.id, method: 'TEACHER', teacherId: teacher.id })
    await bus.publish('VerificationDecided', { requestId: newId(), userId: student.id, method: 'TEACHER', decision: 'APPROVED', reviewerId: teacher.id })
    await bus.publish('VerificationDecided', { requestId: newId(), userId: student.id, method: 'DOCUMENTS', decision: 'REJECTED', reviewerId: admin })
    await bus.publish('DataExportReady', { exportId: newId(), userId: student.id, fileId: newId(), expiresAt: new Date().toISOString() })
    await bus.publish('NotesImportCompleted', { importId: newId(), userId: student.id, created: 3, skipped: 1, failed: 0 })
    await bus.drain()

    const toTeacher = (await list(teacher)).notifications.edges.map((e) => e.node)
    expect(toTeacher).toEqual([expect.objectContaining({ category: 'VERIFICATION', path: '/profile', data: { kind: 'REQUESTED' }, actor: expect.objectContaining({ id: student.id }) })])
    // Handlers run side by side, so the rows are compared without their order.
    const rows = await db.notification.findMany({ where: { userId: student.id } })
    expect(rows.map((r) => [r.category, r.actorId, r.data])).toHaveLength(4)
    expect(rows.map((r) => [r.category, r.actorId, r.data])).toEqual(expect.arrayContaining([
      ['VERIFICATION', teacher.id, { kind: 'DECIDED', decision: 'APPROVED' }],
      ['VERIFICATION', null, { kind: 'DECIDED', decision: 'REJECTED' }],
      ['DATA_EXPORT', null, null],
      ['NOTES_IMPORT', null, { created: 3, skipped: 1, failed: 0 }],
    ]))
  })

  it('forgets a deleted account: its notifications, and its name on others', async () => {
    const gone = await person()
    const service = t.app.get(NotificationService)
    await service.notify({ userId: gone.id, category: 'DATA_EXPORT', path: '/profile' })
    await service.notify({ userId: other.id, category: 'SHARE', path: '/notes/x', actorId: gone.id })
    await bus.publish('UserDeleted', { userId: gone.id })
    await bus.drain()
    expect(await db.notification.count({ where: { userId: gone.id } })).toBe(0)
    expect(await db.notification.count({ where: { actorId: gone.id } })).toBe(0)
    expect(await db.notification.count({ where: { userId: other.id, actorId: null } })).toBe(1)
  })

  it('prunes read notifications after 90 days and unread ones after a year', async () => {
    const who = await person()
    const day = 24 * 60 * 60 * 1000
    const at = (daysAgo: number) => new Date(Date.now() - daysAgo * day)
    await db.notification.createMany({
      data: [
        { id: newId(), userId: who.id, category: 'SHARE', path: '/a', readAt: at(100), createdAt: at(100) },
        { id: newId(), userId: who.id, category: 'SHARE', path: '/b', readAt: at(80), createdAt: at(80) },
        { id: newId(), userId: who.id, category: 'SHARE', path: '/c', createdAt: at(200) },
        { id: newId(), userId: who.id, category: 'SHARE', path: '/d', createdAt: at(400) },
      ],
    })
    await t.app.get(NotificationService).prune()
    expect((await db.notification.findMany({ where: { userId: who.id }, orderBy: { path: 'asc' } })).map((r) => r.path)).toEqual(['/b', '/c'])
  })
})

describe('live updates', () => {
  let t: TestApp
  let url: string

  beforeAll(async () => {
    t = await createTestApp()
    url = await liveUrl(t)
  })
  afterAll(() => t.close())

  const signer = () => new AccessTokenSigner(t.config.JWT_PRIVATE_KEY, t.config.JWT_ISSUER, TOKEN_AUDIENCE)

  it('refuses a socket without a valid token', async () => {
    expect(await (await openLive(url)).closed()).toBe(4403)
    expect(await (await openLive(url, 'not-a-token')).closed()).toBe(4403)
    const u = await seedUser(t.app)
    const expired = signer().sign({ userId: u.id, sessionId: newId(), roles: ['STUDENT'] }, Math.floor(Date.now() / 1000) - 3600).token
    expect(await (await openLive(url, expired)).closed()).toBe(4403)
  })

  it('closes a socket when its token expires and when its session is revoked', async () => {
    const u = await seedUser(t.app)
    // A token with two seconds left.
    const issuedAt = Math.floor(Date.now() / 1000) - (15 * 60 - 2)
    const short = await openLive(url, signer().sign({ userId: u.id, sessionId: newId(), roles: ['STUDENT'] }, issuedAt).token)
    expect(await short.closed(6000)).toBe(4403)

    const sessionId = newId()
    const live = await openLive(url, tokenFor(t.config, u.id, sessionId))
    const kept = await openLive(url, tokenFor(t.config, u.id, newId()))
    await t.app.get(InProcessEventBus).publish('SessionRevoked', { userId: u.id, sessionId, family: true })
    expect(await live.closed()).toBe(4403)
    // Another session of the same person stays open and still hears their events.
    await t.app.get(NotificationService).notify({ userId: u.id, category: 'DATA_EXPORT', path: '/profile' })
    expect(await kept.next()).toMatchObject({ kind: 'NOTIFICATION' })
    await kept.close()
  })

  it('reaches a socket on another API instance, and only its own person', async () => {
    // A second instance of the API on the same database and Redis, as behind a load balancer.
    const second = await createTestApp({}, { resetDatabase: false })
    try {
      const secondUrl = await liveUrl(second)
      const a = await seedUser(t.app, { verified: true })
      const b = await seedUser(t.app, { verified: true })
      const onSecond = await openLive(secondUrl, tokenFor(t.config, b.id))
      const bystander = await openLive(secondUrl, tokenFor(t.config, a.id))
      // The share is handled by the first instance; B's socket is held by the second.
      const noteId = (await t.gql<{ createNote: { note: { id: string } } }>('mutation { createNote(input: { title: "Fan-out" }) { note { id } } }', {}, tokenFor(t.config, a.id))).data!.createNote.note.id
      await t.gql('mutation ($input: ShareNoteInput!) { shareNote(input: $input) { userErrors { message } } }', { input: { noteId, person: b.handle, role: 'VIEWER' } }, tokenFor(t.config, a.id))
      const event = await onSecond.next()
      const row = await t.app.get(PrismaService).notification.findUniqueOrThrow({ where: { id: event.id } })
      expect(row).toMatchObject({ userId: b.id, category: 'SHARE', noteId })
      await new Promise((r) => setTimeout(r, 300))
      expect(bystander.events).toEqual([])
      await Promise.all([onSecond.close(), bystander.close()])
    } finally {
      await second.close()
    }
  })
})
