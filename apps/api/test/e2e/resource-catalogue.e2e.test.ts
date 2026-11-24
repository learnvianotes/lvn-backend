import { InProcessEventBus } from '@lvn-backend/event-bus'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { createTestApp, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'

/**
 * Finding resources (ADR-0075): the catalogue (guests too), private saves with public counts, recommendations with a
 * reason to a person, a group or a class, public discussion, search, and resources among learning recommendations.
 */
describe('resource catalogue', () => {
  let t: TestApp
  let db: PrismaService
  let bus: InProcessEventBus
  type Person = { id: string; token: string; handle: string }
  let topicIds: string[]
  const stamp = Date.now()

  const person = async (opts: { verified?: boolean; teacher?: boolean; dob?: string } = {}): Promise<Person> => {
    const u = await seedUser(t.app, { verified: opts.verified ?? true, globalRole: opts.teacher ? 'TEACHER' : 'STUDENT' })
    if (opts.dob) await db.user.update({ where: { id: u.id }, data: { dateOfBirth: new Date(opts.dob) } })
    return { id: u.id, token: tokenFor(t.config, u.id), handle: u.handle }
  }
  /** An approved resource, made directly: P7a's tests cover submitting and moderating. */
  const resource = async (who: Person, over: { title?: string; type?: 'BOOK' | 'COURSE' | 'TOOL'; topicId?: string; status?: 'APPROVED' | 'PENDING'; author?: string } = {}) => {
    const id = newId()
    const url = `https://example.com/r/${id}`
    await db.resource.create({ data: { id, type: over.type ?? 'COURSE', title: over.title ?? `Resource ${id.slice(-6)}`, author: over.author ?? null, url, urlKey: url.slice(8), submittedById: who.id, status: over.status ?? 'APPROVED', topics: { create: [{ topicId: over.topicId ?? topicIds[0]! }] } } })
    return id
  }
  const ok = async (name: string, inputType: string, input: object, who: Person) => {
    const res = await t.gql<Record<string, { ok?: boolean; userErrors: { message: string; code: string }[] }>>(`mutation ($input: ${inputType}!) { ${name}(input: $input) { ${name.includes('save') || name.includes('Save') ? 'resource { id }' : 'ok'} userErrors { message code } } }`, { input }, who.token)
    const error = res.errors?.[0] as { message: string; extensions: { code: string } } | undefined
    return error ? { message: error.message, code: error.extensions.code } : (res.data![name]!.userErrors[0] ?? null)
  }
  const recommend = (who: Person, resourceId: string, to: object, reason?: string) => ok('recommendResource', 'RecommendResourceInput', { resourceId, to, reason }, who)
  const list = async (args: string, who?: Person) => (await t.gql<{ resources: { edges: { node: { id: string; saveCount: number; viewerSaved: boolean } }[] } }>(`{ resources(${args}) { edges { node { id saveCount viewerSaved } } } }`, {}, who?.token)).data!.resources.edges.map((e) => e.node)

  beforeAll(async () => {
    t = await createTestApp()
    db = t.app.get(PrismaService)
    bus = t.app.get(InProcessEventBus)
    topicIds = (await db.topic.findMany({ where: { origin: 'CURATED', children: { none: {} } }, orderBy: { id: 'asc' }, take: 3, select: { id: true } })).map((x) => x.id)
  })
  afterAll(() => t?.close())

  it('lists approved resources for anyone, filtered by type, topic and words, most saved first', async () => {
    const author = await person()
    const word = `zq${stamp}`
    const a = await resource(author, { title: `Graph theory ${word}`, type: 'BOOK', topicId: topicIds[1] })
    const b = await resource(author, { title: `Graph algorithms ${word}`, author: 'Sedgewick' })
    await resource(author, { title: `Waiting ${word}`, status: 'PENDING' })
    for (let i = 0; i < 2; i++) await ok('saveResource', 'ResourceIdInput', { id: b }, await person())
    expect((await list(`filter: { query: "${word}" }`)).map((r) => r.id)).toEqual([b, a])
    expect((await list(`filter: { query: "${word}" }, sort: NEWEST`)).map((r) => r.id)).toEqual([b, a])
    expect((await list(`filter: { query: "${word}", type: BOOK }`)).map((r) => r.id)).toEqual([a])
    expect((await list(`filter: { query: "${word}", topicId: "${topicIds[1]}" }`)).map((r) => r.id)).toEqual([a])
    expect((await list(`filter: { query: "sedgewick ${word}" }`)).map((r) => r.id)).toEqual([b])
    expect((await list(`filter: { query: "${word}" }`))[0]!.saveCount).toBe(2)
    // A block keeps them apart here too.
    const blocker = await person({})
    await t.gql('mutation ($input: PersonInput!) { blockUser(input: $input) { userErrors { message } } }', { input: { userId: author.id } }, blocker.token)
    expect(await list(`filter: { query: "${word}" }`, blocker)).toEqual([])
  })

  it('saves privately: counts are public, who saved is not; the page is indexable from three saves', async () => {
    const author = await person()
    const id = await resource(author)
    const me = await person()
    expect(await ok('saveResource', 'ResourceIdInput', { id }, me)).toBeNull()
    expect(await ok('saveResource', 'ResourceIdInput', { id }, me)).toBeNull()
    const seen = async (who?: Person) => (await t.gql<{ resource: { saveCount: number; viewerSaved: boolean; indexable: boolean } }>('query ($id: UUID!) { resource(id: $id) { saveCount viewerSaved indexable } }', { id }, who?.token)).data!.resource
    expect(await seen(me)).toEqual({ saveCount: 1, viewerSaved: true, indexable: false })
    expect(await seen()).toEqual({ saveCount: 1, viewerSaved: false, indexable: false })
    for (let i = 0; i < 2; i++) await ok('saveResource', 'ResourceIdInput', { id }, await person())
    expect((await seen()).indexable).toBe(true)
    const saved = (await t.gql<{ savedResources: { edges: { node: { id: string } }[] } }>('{ savedResources { edges { node { id } } } }', {}, me.token)).data!.savedResources.edges.map((e) => e.node.id)
    expect(saved).toEqual([id])
    expect(await ok('unsaveResource', 'ResourceIdInput', { id }, me)).toBeNull()
    expect((await seen(me)).viewerSaved).toBe(false)
    // A waiting resource cannot be saved: it is not in the catalogue.
    expect((await ok('saveResource', 'ResourceIdInput', { id: await resource(author, { status: 'PENDING' }) }, me))?.code).toBe('NOT_FOUND')
    // Saves go into the data export; the list leaves out what is no longer approved.
    await ok('saveResource', 'ResourceIdInput', { id }, me)
    await db.resource.update({ where: { id }, data: { status: 'REJECTED' } })
    expect((await t.gql<{ savedResources: { edges: unknown[] } }>('{ savedResources { edges { node { id } } } }', {}, me.token)).data!.savedResources.edges).toEqual([])
  })

  it('recommends to a person one follows, is connected to or shares a place with; tells them; never to a stranger', async () => {
    const author = await person()
    const id = await resource(author)
    const me = await person()
    const friend = await person()
    const stranger = await person()
    await t.gql('mutation ($input: PersonInput!) { followUser(input: $input) { userErrors { message } } }', { input: { userId: friend.id } }, me.token)
    expect(await recommend(me, id, { userId: stranger.id }, 'Great for graphs')).toMatchObject({ code: 'FORBIDDEN', message: 'Recommend to people you follow, are connected to, or share a group or class with.' })
    expect(await recommend(me, id, { userId: me.id })).toMatchObject({ message: 'Save it instead: it is for you.' })
    expect(await recommend(me, id, { userId: friend.id, groupId: newId() })).toMatchObject({ message: 'Choose one person, group or class.' })
    expect(await recommend(me, id, { userId: friend.id }, 'Great for graphs')).toBeNull()
    expect(await recommend(me, id, { userId: friend.id })).toMatchObject({ code: 'CONFLICT' })
    const told = async () => {
      for (let i = 0; i < 50; i++) {
        const n = await db.notification.findFirst({ where: { userId: friend.id, category: 'RESOURCE' } })
        if (n) return n
        await new Promise((r) => setTimeout(r, 100))
      }
      return null
    }
    expect(await told()).toMatchObject({ actorId: me.id, path: `/resources/${id}`, data: { kind: 'RECOMMENDED' } })
    const mine = (await t.gql<{ resourceRecommendations: { edges: { node: { reason: string; from: { id: string }; resource: { id: string }; viewerCanRemove: boolean } }[] } }>('query ($to: RecommendationPlaceInput!) { resourceRecommendations(to: $to) { edges { node { reason from { id } resource { id } viewerCanRemove } } } }', { to: { userId: friend.id } }, friend.token)).data!.resourceRecommendations.edges.map((e) => e.node)
    expect(mine).toEqual([{ reason: 'Great for graphs', from: { id: me.id }, resource: { id }, viewerCanRemove: true }])
    // Someone else's list is theirs alone.
    expect((await t.gql('query ($to: RecommendationPlaceInput!) { resourceRecommendations(to: $to) { edges { cursor } } }', { to: { userId: friend.id } }, me.token)).errors?.[0]?.extensions.code).toBe('FORBIDDEN')
    // A child account hears only from people in a class with them.
    const child = await person({ dob: new Date(Date.now() - 12 * 365 * 86_400_000).toISOString().slice(0, 10) })
    await t.gql('mutation ($input: PersonInput!) { followUser(input: $input) { userErrors { message } } }', { input: { userId: child.id } }, me.token)
    expect((await recommend(me, id, { userId: child.id }))?.code).toBe('FORBIDDEN')
    // The word check reads reasons.
    expect((await recommend(me, id, { userId: (await person()).id }, 'buy followers cheap click here'))?.code).toBeTruthy()
  })

  it('recommends to a group one may post in and a class one teaches; members read them; moderators remove them', async () => {
    const author = await person()
    const id = await resource(author)
    const owner = await person()
    const member = await person()
    const outsider = await person()
    const groupId = (await t.gql<{ createGroup: { group: { id: string } } }>('mutation ($input: CreateGroupInput!) { createGroup(input: $input) { group { id } } }', { input: { name: `Readers ${stamp}`, privacy: 'PRIVATE' } }, owner.token)).data!.createGroup.group.id
    await db.groupMember.create({ data: { groupId, userId: member.id, role: 'MEMBER' } })
    await bus.drain()
    expect(await recommend(outsider, id, { groupId })).toMatchObject({ code: 'NOT_FOUND' })
    expect(await recommend(member, id, { groupId }, 'For our exam')).toBeNull()
    const inGroup = async (who: Person) => t.gql<{ resourceRecommendations: { edges: { node: { id: string; reason: string; viewerCanRemove: boolean } }[] } }>('query ($to: RecommendationPlaceInput!) { resourceRecommendations(to: $to) { edges { node { id reason viewerCanRemove } } } }', { to: { groupId } }, who.token)
    const seen = (await inGroup(owner)).data!.resourceRecommendations.edges.map((e) => e.node)
    expect(seen).toMatchObject([{ reason: 'For our exam', viewerCanRemove: true }])
    expect((await inGroup(outsider)).errors?.[0]?.extensions.code).toBe('NOT_FOUND')
    expect(await ok('removeResourceRecommendation', 'ResourceRecommendationIdInput', { id: seen[0]!.id }, owner)).toBeNull()

    const teacher = await person({ teacher: true })
    const student = await person()
    const classroomId = (await t.gql<{ createClassroom: { classroom: { id: string } } }>('mutation { createClassroom(input: { name: "Algorithms" }) { classroom { id } } }', {}, teacher.token)).data!.createClassroom.classroom.id
    await db.classroomMember.create({ data: { classroomId, userId: student.id, role: 'STUDENT' } })
    await bus.drain()
    expect(await recommend(student, id, { classroomId })).toMatchObject({ code: 'FORBIDDEN', message: 'Only the class’s teacher and TAs recommend resources to it.' })
    expect(await recommend(teacher, id, { classroomId }, 'Read chapter 3')).toBeNull()
    const inClass = (await t.gql<{ resourceRecommendations: { edges: { node: { reason: string } }[] } }>('query ($to: RecommendationPlaceInput!) { resourceRecommendations(to: $to) { edges { node { reason } } } }', { to: { classroomId } }, student.token)).data!.resourceRecommendations.edges
    expect(inClass.map((e) => e.node.reason)).toEqual(['Read chapter 3'])
    // A student and a teacher who share a class: the teacher may recommend to the student directly.
    expect(await recommend(teacher, id, { userId: student.id })).toBeNull()
  })

  it('discusses an approved resource in public: verified adults comment, the submitter is told; children and the unverified read', async () => {
    const author = await person()
    const id = await resource(author)
    const target = { type: 'RESOURCE', id }
    const body = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Chapter 4 is the best part.' }] }] }
    const add = (who: Person) => t.gql<{ addComment: { comment: { id: string } | null; userErrors: { message: string }[] } }>('mutation ($input: AddCommentInput!) { addComment(input: $input) { comment { id } userErrors { message } } }', { input: { target, body } }, who.token)
    const reader = await person()
    expect((await add(reader)).data!.addComment.userErrors).toEqual([])
    // 16: under the consent age, and old enough that the under-13 social gate does not hide the discussion.
    const child = await person({ dob: new Date(Date.UTC(new Date().getUTCFullYear() - 16, 0, 15)).toISOString().slice(0, 10) })
    const place = async (who: Person) => (await t.gql<{ discussion: { viewerCanComment: boolean; whyNot: string | null; commentCount: number } | null }>('query ($target: CommentTargetInput!) { discussion(target: $target) { viewerCanComment whyNot commentCount } }', { target }, who.token)).data!.discussion
    expect(await place(child)).toEqual({ viewerCanComment: false, whyNot: 'Comments on resources are not open to your account yet.', commentCount: 1 })
    expect(await place(await person({ verified: false }))).toMatchObject({ viewerCanComment: true, whyNot: null })
    for (let i = 0; i < 50 && !(await db.notification.count({ where: { userId: author.id, category: 'COMMENT' } })); i++) await new Promise((r) => setTimeout(r, 100))
    expect(await db.notification.findFirst({ where: { userId: author.id, category: 'COMMENT' } })).toMatchObject({ path: `/resources/${id}`, actorId: reader.id })
    // A resource that is not approved has no discussion.
    expect(await place(reader)).toBeTruthy()
    await db.resource.update({ where: { id }, data: { status: 'REJECTED' } })
    expect(await place(reader)).toBeNull()
  })

  it('search finds approved resources, and nothing waiting', async () => {
    const author = await person()
    const word = `qx${stamp}`
    const approved = await resource(author, { title: `Dynamic programming ${word}` })
    await resource(author, { title: `Dynamic programming waiting ${word}`, status: 'PENDING' })
    const found = (await t.gql<{ search: { resources: { id: string; title: string }[] } }>(`{ search(query: "dynamic ${word}", scopes: [RESOURCES]) { resources { id title } } }`)).data!.search.resources
    expect(found.map((r) => r.id)).toEqual([approved])
  })

  it('recommends resources on the topics of an exam, most saved first, with why', async () => {
    const author = await person()
    const me = await person()
    const topicId = topicIds[2]!
    const popular = await resource(author, { title: `Popular ${stamp}`, topicId })
    const other = await resource(author, { title: `Other ${stamp}`, topicId })
    await ok('saveResource', 'ResourceIdInput', { id: popular }, await person())
    const date = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)
    await t.gql('mutation ($input: CreateExamInput!) { createExam(input: $input) { exam { id } } }', { input: { name: 'Algorithms', date, topicIds: [topicId] } }, me.token)
    const recs = (await t.gql<{ recommendations: { kind: string; reason: string; resource: { id: string } | null }[] }>('{ recommendations(limit: 20) { kind reason resource { id } } }', {}, me.token)).data!.recommendations.filter((r) => r.kind === 'RESOURCE')
    expect(recs.map((r) => r.resource?.id)).toEqual([popular, other])
    expect(recs[0]!.reason).toBe('For your exam, saved by 1 person')
  })
})
