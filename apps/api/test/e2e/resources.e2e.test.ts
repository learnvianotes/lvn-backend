import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { COMMERCE_WORDS } from '@lvn-backend/core'
import { InProcessEventBus } from '@lvn-backend/event-bus'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { createTestApp, type TestApp } from '../support/app'
import { SAMPLES, upload } from '../support/flows'
import { seedUser, tokenFor } from '../support/seed'

/**
 * Resources (§14.4, ADR-0074): verified adults submit books, courses and tools; a preview reads the page or Open
 * Library through the safe fetcher; every submission waits in the platform moderation queue; approved ones are public,
 * guests included; rejected ones are their submitter's, with the reason, and can be sent again.
 */
describe('resources', () => {
  let t: TestApp
  let db: PrismaService
  let bus: InProcessEventBus
  let site: Server
  let base: string
  type Person = { id: string; token: string }
  let admin: Person
  let topicIds: string[]

  const person = async (opts: { verified?: boolean; dob?: string } = {}): Promise<Person> => {
    const u = await seedUser(t.app, { verified: opts.verified ?? true })
    if (opts.dob) await db.user.update({ where: { id: u.id }, data: { dateOfBirth: new Date(opts.dob) } })
    return { id: u.id, token: tokenFor(t.config, u.id) }
  }
  const FIELDS = 'id type title description url host isbn author coverUrl topics { id } submittedBy { id } status reason decidedAt viewerCan { edit delete report }'
  type Res = { id: string; type: string; title: string; description: string | null; url: string; host: string; isbn: string | null; author: string | null; coverUrl: string | null; topics: { id: string }[]; status: string; reason: string | null; viewerCan: { edit: boolean; delete: boolean; report: boolean } }
  type Payload = { resource: Res | null; userErrors: { message: string; code: string; field: string[] | null }[] }
  /** A mutation's payload, with a refusal (a top-level error) folded into its userErrors. */
  const mutate = async (name: 'submitResource' | 'updateResource', input: object, who: Person): Promise<Payload> => {
    const type = `${name[0]!.toUpperCase()}${name.slice(1)}Input`
    const res = await t.gql<Record<string, Payload>>(`mutation ($input: ${type}!) { ${name}(input: $input) { resource { ${FIELDS} } userErrors { message code field } } }`, { input }, who.token)
    return res.data?.[name] ?? { resource: null, userErrors: (res.errors ?? []).map((e) => ({ message: e.message, code: e.extensions.code as string, field: null })) }
  }
  const submit = (who: Person, input: object) => mutate('submitResource', { type: 'COURSE', title: 'Data Structures, NPTEL', url: `${base}/course?id=${newId()}`, topicIds: [topicIds[0]], ...input }, who)
  const read = async (id: string, who?: Person) => (await t.gql<{ resource: Res | null }>(`query ($id: UUID!) { resource(id: $id) { ${FIELDS} } }`, { id }, who?.token)).data!.resource
  const preview = (input: object, who: Person) => t.gql<{ resourcePreview: { url: string | null; title: string | null; description: string | null; author: string | null; isbn: string | null; type: string | null; siteName: string | null; imageUrl: string | null; found: boolean; existing: { id: string } | null } }>('query ($input: ResourcePreviewInput!) { resourcePreview(input: $input) { url title description author isbn type siteName imageUrl found existing { id } } }', { input }, who.token)
  const decide = async (entityId: string, action: string, reason?: string) =>
    (await t.gql<{ moderateContent: { ok: boolean; userErrors: { message: string }[] } }>('mutation ($input: ModerateContentInput!) { moderateContent(input: $input) { ok userErrors { message } } }', { input: { entityType: 'RESOURCE', entityId, action, reason } }, admin.token)).data!.moderateContent
  const queue = async () => (await t.gql<{ moderationQueue: { edges: { node: { entityType: string; entityId: string; reports: { reason: string; details: string | null; reporter: { id: string } | null }[]; resource: { id: string; title: string; status: string } | null } }[] } }>('{ moderationQueue(first: 50) { edges { node { entityType entityId reports { reason details reporter { id } } resource { id title status } } } } }', {}, admin.token)).data!.moderationQueue.edges.map((e) => e.node)

  /** Event handlers run after the mutation answers: waits up to 5 s for a value. */
  const eventually = async <T>(read: () => Promise<T | null | undefined>): Promise<T | null> => {
    for (let i = 0; i < 50; i++) {
      const v = await read()
      if (v) return v
      await new Promise((r) => setTimeout(r, 100))
    }
    return null
  }
  const BOOK_PAGE = `<!doctype html><html><head><title>Clean Code | Example Books</title>
    <meta property="og:title" content="Clean Code: A Handbook of Agile Software Craftsmanship">
    <meta property="og:description" content="Even bad code can function.">
    <meta property="og:image" content="/cover.png"><meta property="og:type" content="book">
    <meta property="book:isbn" content="978-0-13-235088-4"><meta name="author" content="Robert C. Martin">
    <meta property="og:site_name" content="Example Books"></head><body>…</body></html>`
  const PNG = Buffer.from([...SAMPLES.png, ...new Array(64).fill(0)])

  beforeAll(async () => {
    site = createServer((req, res) => {
      const path = (req.url ?? '').split('?')[0]
      if (path === '/book') return res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(BOOK_PAGE)
      if (path === '/course') return res.writeHead(200, { 'content-type': 'text/html' }).end('<head><title>Data Structures &amp; Algorithms</title><meta name="description" content="A 12-week course."></head>')
      if (path === '/cover.png' || path === '/covers/b/id/8231856-L.jpg') return res.writeHead(200, { 'content-type': 'image/png' }).end(PNG)
      if (path === '/not-a-picture') return res.writeHead(200, { 'content-type': 'image/png' }).end('<svg/>')
      if (path === '/to-metadata') return res.writeHead(302, { location: 'http://169.254.169.254/latest/meta-data/' }).end()
      if (path === '/ol/isbn/9780132350884.json') return res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ title: 'Clean Code', subtitle: 'A Handbook of Agile Software Craftsmanship', works: [{ key: '/works/OL3524026W' }], covers: [8231856] }))
      if (path === '/ol/authors/OL216228A.json') return res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ name: 'Robert C. Martin' }))
      if (path === '/ol/works/OL3524026W.json') return res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ description: { type: '/type/text', value: 'Even bad code can function.' }, authors: [{ type: { key: '/type/author_role' }, author: { key: '/authors/OL216228A' } }] }))
      res.writeHead(404, { 'content-type': 'application/json' }).end('{"error":"notfound"}')
    })
    await new Promise<void>((resolve) => site.listen(0, '127.0.0.1', resolve))
    base = `http://127.0.0.1:${(site.address() as AddressInfo).port}`
    t = await createTestApp({ SAFE_FETCH_ALLOW_HOSTS: '127.0.0.1', OPEN_LIBRARY_URL: `${base}/ol`, OPEN_LIBRARY_COVERS_URL: `${base}/covers` })
    db = t.app.get(PrismaService)
    bus = t.app.get(InProcessEventBus)
    const a = await seedUser(t.app, { globalRole: 'PLATFORM_ADMIN', verified: true })
    admin = { id: a.id, token: tokenFor(t.config, a.id, undefined, ['PLATFORM_ADMIN']) }
    topicIds = (await db.topic.findMany({ where: { origin: 'CURATED', children: { none: {} } }, orderBy: { id: 'asc' }, take: 3, select: { id: true } })).map((x) => x.id)
  })

  afterAll(async () => {
    await t?.close()
    await new Promise<void>((resolve) => site.close(() => resolve()))
  })

  it('previews a page and a book, then sends one: it waits for moderators, unseen by anyone else', async () => {
    const me = await person()
    const page = (await preview({ url: `${base}/book?utm_source=twitter&tag=aff-21#top` }, me)).data!.resourcePreview
    expect(page).toEqual({ url: `${base}/book`, title: 'Clean Code: A Handbook of Agile Software Craftsmanship', description: 'Even bad code can function.', author: 'Robert C. Martin', isbn: '9780132350884', type: 'BOOK', siteName: 'Example Books', imageUrl: `${base}/cover.png`, found: true, existing: null })
    const book = (await preview({ isbn: '0-13-235088-2' }, me)).data!.resourcePreview
    expect(book).toMatchObject({ url: `${base}/ol/isbn/9780132350884`, title: 'Clean Code: A Handbook of Agile Software Craftsmanship', author: 'Robert C. Martin', description: 'Even bad code can function.', type: 'BOOK', siteName: 'Open Library', imageUrl: `${base}/covers/b/id/8231856-L.jpg`, found: true })
    expect((await preview({ isbn: '0132350883' }, me)).errors?.[0]?.message).toBe('That ISBN is not valid. Check its digits.')
    // A page that cannot be read is no error: the person fills it in.
    expect((await preview({ url: `${base}/missing` }, me)).data!.resourcePreview).toMatchObject({ url: `${base}/missing`, title: null, found: false })

    const sent = await mutate('submitResource', { type: 'BOOK', title: page.title, description: page.description, url: page.url, isbn: page.isbn, author: page.author, topicIds: topicIds.slice(0, 2), imageUrl: page.imageUrl }, me)
    expect(sent.userErrors).toEqual([])
    const r = sent.resource!
    expect(r).toMatchObject({ type: 'BOOK', status: 'PENDING', host: '127.0.0.1', isbn: '9780132350884', author: 'Robert C. Martin', reason: null, viewerCan: { edit: true, delete: true, report: false } })
    expect(r.topics.map((x) => x.id)).toEqual(topicIds.slice(0, 2))
    // The picture was copied into storage, never linked.
    expect(r.coverUrl).toBeTruthy()
    expect(r.coverUrl).not.toContain(base)
    const cover = await db.fileObject.findFirst({ where: { parentType: 'RESOURCE', parentId: r.id } })
    expect(cover).toMatchObject({ purpose: 'COVER', mimeType: 'image/png', ownerId: me.id, status: 'READY' })

    // Waiting: its submitter and moderators see it; nobody else does.
    expect(await read(r.id, await person())).toBeNull()
    expect(await read(r.id)).toBeNull()
    expect((await read(r.id, admin))?.status).toBe('PENDING')
    const mine = (await t.gql<{ myResources: { id: string; status: string }[] }>('{ myResources { id status } }', {}, me.token)).data!.myResources
    expect(mine).toEqual([{ id: r.id, status: 'PENDING' }])
    const kase = (await queue()).find((c) => c.entityId === r.id)
    expect(kase).toMatchObject({ entityType: 'RESOURCE', resource: { id: r.id, status: 'PENDING' }, reports: [{ reason: 'OTHER', details: 'New resource, waiting for approval.', reporter: null }] })
  })

  it('approves: public for everyone, guests included; told to the submitter; no longer edited, only deleted', async () => {
    const me = await person()
    const r = (await submit(me, { title: 'Introduction to Algorithms, NPTEL' })).resource!
    const told = new Promise((resolve) => bus.subscribe('ResourceDecided', ({ payload }) => {
      if (payload.resourceId === r.id) resolve(payload)
    }))
    expect(await decide(r.id, 'APPROVE')).toEqual({ ok: true, userErrors: [] })
    expect(await told).toMatchObject({ decision: 'APPROVED', submittedById: me.id, moderatorId: admin.id })
    const seen = await read(r.id)
    expect(seen).toMatchObject({ status: 'APPROVED', reason: null, viewerCan: { edit: false, delete: false, report: false } })
    expect((await read(r.id, await person()))?.viewerCan).toEqual({ edit: false, delete: false, report: true })
    expect((await read(r.id, me))?.viewerCan).toEqual({ edit: false, delete: true, report: false })
    expect((await queue()).some((c) => c.entityId === r.id)).toBe(false)
    expect((await mutate('updateResource', { id: r.id, type: 'COURSE', title: 'Changed', url: r.url, topicIds: [topicIds[0]] }, me)).userErrors[0]).toMatchObject({ code: 'FORBIDDEN', message: 'An approved resource stays as moderators saw it. Delete it and add it again if it is wrong.' })
    const notice = await eventually(() => db.notification.findFirst({ where: { userId: me.id, category: 'RESOURCE' } }))
    expect(notice).toMatchObject({ path: `/resources/${r.id}`, data: { decision: 'APPROVED' } })
  })

  it('rejects with a reason only the submitter reads; editing it sends it again', async () => {
    const me = await person()
    const r = (await submit(me, { title: 'Some course' })).resource!
    expect((await decide(r.id, 'REMOVE')).userErrors[0]!.message).toBe('Say why: the author is told.')
    expect((await decide(r.id, 'DISMISS')).userErrors[0]!.message).toBe('Approve or reject a new resource.')
    expect((await decide(r.id, 'HIDE', 'x')).userErrors[0]!.message).toBe('A resource is approved, rejected, or its reports dismissed.')
    expect((await decide(r.id, 'REMOVE', 'This page is a sales page, not a course.')).ok).toBe(true)
    expect(await read(r.id, me)).toMatchObject({ status: 'REJECTED', reason: 'This page is a sales page, not a course.', viewerCan: { edit: true, delete: true } })
    expect((await read(r.id, admin))?.reason).toBe('This page is a sales page, not a course.')
    expect(await read(r.id, await person())).toBeNull()

    const again = await mutate('updateResource', { id: r.id, type: 'COURSE', title: 'Data Structures and Algorithms, NPTEL (IIT Delhi)', url: r.url, topicIds: [topicIds[0]] }, me)
    expect(again.resource).toMatchObject({ status: 'PENDING', reason: null, title: 'Data Structures and Algorithms, NPTEL (IIT Delhi)' })
    expect((await queue()).find((c) => c.entityId === r.id)?.reports).toHaveLength(1)
  })

  it('checks what is sent: titles, links, ISBNs, topics (curated only), duplicates and pictures', async () => {
    const me = await person()
    const err = async (input: object) => (await submit(me, input)).userErrors[0]?.message
    expect(await err({ title: 'ab' })).toBe('Give it a title of 3 to 200 characters.')
    expect(await err({ url: 'ftp://example.com/x' })).toBe('Use a web address that starts with http:// or https://.')
    expect(await err({ url: 'https://user:pw@example.com/' })).toBe('Leave the user name and password out of the address.')
    expect(await err({ isbn: '9780132350884' })).toBe('Only books have an ISBN.')
    expect(await err({ type: 'BOOK', isbn: '123' })).toBe('That ISBN is not valid. Check its digits.')
    expect(await err({ topicIds: [] })).toBe('Choose 1 to 5 topics.')
    const own = newId()
    const subject = await db.subject.findFirstOrThrow()
    await db.topic.create({ data: { id: own, subjectId: subject.id, slug: `mine-${own.slice(-8)}`, title: 'Zebra stripes of my own', origin: 'PROPOSED', proposedById: me.id } })
    expect(await err({ topicIds: [own] })).toBe('Choose topics from LearnViaNotes’ list: your own topics are private to you.')
    // The topic search offers curated topics only.
    const curated = await db.topic.findUniqueOrThrow({ where: { id: topicIds[0] } })
    const options = async (q: string) => (await t.gql<{ resourceTopicOptions: { id: string }[] }>('query ($q: String!) { resourceTopicOptions(query: $q) { id } }', { q }, me.token)).data!.resourceTopicOptions.map((o) => o.id)
    expect(await options(curated.title)).toContain(curated.id)
    expect(await options('Zebra stripes of my own')).toEqual([])

    // The same link (whatever its tracking, scheme or slash) or ISBN is one resource.
    const url = `https://nptel.ac.in/courses/${newId()}/`
    const first = (await submit(me, { url: `${url}?utm_campaign=x` })).resource!
    expect(first.url).toBe(url.replace(/\/$/, ''))
    expect(await err({ url: url.replace('https', 'http') })).toBe('Someone has already sent this; it is waiting for moderators.')
    await decide(first.id, 'APPROVE')
    expect((await submit(await person(), { url })).userErrors[0]).toMatchObject({ code: 'CONFLICT', message: `“${first.title}” is already in the catalogue.` })
    expect((await preview({ url }, me)).data!.resourcePreview.existing).toEqual({ id: first.id })

    // A picture that is not one is left out; an uploaded cover is attached.
    const noPicture = (await submit(me, { imageUrl: `${base}/not-a-picture` })).resource!
    expect(noPicture.coverUrl).toBeNull()
    const fileId = await upload(t, me.token, 'COVER', 'image/png', SAMPLES.png, 'cover.png')
    const withCover = (await submit(me, { coverFileId: fileId })).resource!
    expect(withCover.coverUrl).toBeTruthy()
    expect(await db.fileObject.findUnique({ where: { id: fileId } })).toMatchObject({ parentType: 'RESOURCE', parentId: withCover.id })
  })

  it('never fetches this machine or private networks, by link, redirect or picture', async () => {
    const me = await person()
    expect((await preview({ url: 'http://169.254.169.254/latest/meta-data/' }, me)).errors?.[0]?.message).toBe('That address is not on the public internet.')
    expect((await preview({ url: `${base}/to-metadata` }, me)).errors?.[0]?.message).toBe('That address is not on the public internet.')
    const r = (await submit(me, { imageUrl: 'http://10.0.0.1/cover.png' })).resource!
    expect(r.coverUrl).toBeNull()
  })

  it('only verified adults submit; a child account, an unverified one and a suspended one are told why', async () => {
    const why = async (who: Person) => (await submit(who, {})).userErrors[0]?.message
    expect(await why(await person({ verified: false }))).toBe('Verify your account to add resources.')
    expect(await why(await person({ dob: new Date(Date.now() - 12 * 365 * 86_400_000).toISOString().slice(0, 10) }))).toBe('Resources are public with your name, so child accounts do not add them.')
    const suspended = await person()
    await db.user.update({ where: { id: suspended.id }, data: { suspendedUntil: new Date(Date.now() + 86_400_000) } })
    expect(await why(suspended)).toMatch(/^Your account is suspended until /)
    expect((await t.gql('{ resourcePreview(input: { url: "https://example.com/" }) { found } }')).errors?.[0]?.extensions.code).toBe('UNAUTHENTICATED')
  })

  it('reports from people take an approved resource off until a moderator looks; removing it tells the submitter', async () => {
    const me = await person()
    const r = (await submit(me, {})).resource!
    await decide(r.id, 'APPROVE')
    const report = async (who: Person) => (await t.gql<{ reportContent: { ok: boolean; userErrors: { message: string }[] } }>('mutation ($input: ReportContentInput!) { reportContent(input: $input) { ok userErrors { message } } }', { input: { entityType: 'RESOURCE', entityId: r.id, reason: 'SPAM' } }, who.token)).data!.reportContent
    expect((await report(me)).userErrors[0]!.message).toBe('This is your own.')
    for (let i = 0; i < 3; i++) expect((await report(await person())).ok).toBe(true)
    expect(await read(r.id)).toBeNull()
    expect((await read(r.id, me))?.status).toBe('PENDING')
    // Dismissing people's reports puts it back.
    expect((await decide(r.id, 'DISMISS')).ok).toBe(true)
    expect((await read(r.id))?.status).toBe('APPROVED')
    await report(await person())
    expect((await decide(r.id, 'REMOVE', 'The link now leads to a shop.')).ok).toBe(true)
    expect(await read(r.id)).toBeNull()
    expect(await read(r.id, me)).toMatchObject({ status: 'REJECTED', reason: 'The link now leads to a shop.' })
    // Approved, then removed: putting it back after the hold tells nobody, since nobody was told of the hold.
    expect(await eventually(async () => ((await db.notification.count({ where: { userId: me.id, category: 'RESOURCE' } })) === 2 ? 2 : null))).toBe(2)
  })

  it('deletes: its submitter or a moderator; the cover and the case go too; data export and account deletion', async () => {
    const me = await person()
    const fileId = await upload(t, me.token, 'COVER', 'image/png', SAMPLES.png, 'cover.png')
    const r = (await submit(me, { coverFileId: fileId })).resource!
    const del = async (id: string, who: Person) => (await t.gql<{ deleteResource: { ok: boolean; userErrors: { message: string; code: string }[] } }>('mutation ($input: ResourceIdInput!) { deleteResource(input: $input) { ok userErrors { message code } } }', { input: { id } }, who.token)).data?.deleteResource
    const other = await person()
    expect((await del(r.id, other))?.userErrors[0]).toMatchObject({ code: 'NOT_FOUND', message: 'Resource not found.' })
    expect((await del(r.id, me))?.ok).toBe(true)
    expect(await db.resource.findUnique({ where: { id: r.id } })).toBeNull()
    expect((await db.fileObject.findUnique({ where: { id: fileId } }))?.status).toBe('DELETED')
    expect((await queue()).some((c) => c.entityId === r.id)).toBe(false)

    const kept = (await submit(me, {})).resource!
    const byAdmin = (await submit(me, {})).resource!
    expect((await del(byAdmin.id, admin))?.ok).toBe(true)
    expect(await db.auditLog.count({ where: { action: 'resource.deleted', targetId: byAdmin.id } })).toBe(1)
    bus.publish('UserDeleted', { userId: me.id })
    for (let i = 0; i < 50 && (await db.resource.count({ where: { id: kept.id } })); i++) await new Promise((r2) => setTimeout(r2, 100))
    expect(await db.resource.count({ where: { submittedById: me.id } })).toBe(0)
  })

  it('keeps no commerce fields: no price, store, seller or affiliate column on a resource', async () => {
    const columns = await db.$queryRaw<{ column_name: string }[]>`SELECT column_name FROM information_schema.columns WHERE table_schema = 'core' AND table_name IN ('Resource', 'ResourceTopic')`
    const names = columns.map((c) => c.column_name.toLowerCase())
    expect(names).toContain('url')
    for (const word of COMMERCE_WORDS) expect(names.filter((n) => n.includes(word))).toEqual([])
  })
})
