import { isEnumType, isInputObjectType, isInterfaceType, isObjectType, type GraphQLSchema } from 'graphql'
import { COMMERCE_WORDS } from '@lvn-backend/core'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { createTestApp, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'
import { publicSchema } from './support/fuzz'

/**
 * Phase 7's exit (plans/phase-7.md): moderation on submissions and no commerce surface (ADR-0074, ADR-0075). A
 * waiting or rejected resource reaches no one but its submitter and the platform's moderators, through any channel;
 * nothing in the schema prices, sells or carts anything; and the fetchers that read people's links (resources,
 * skills import: ADR-0077) never reach this machine or private networks.
 */
describe('security: resources', () => {
  type Person = { id: string; token: string }
  let t: TestApp
  let schema: GraphQLSchema
  let admin: Person
  let topicId: string

  const person = async (role: 'STUDENT' | 'TEACHER' | 'PLATFORM_ADMIN' = 'STUDENT'): Promise<Person> => {
    const u = await seedUser(t.app, { verified: true, globalRole: role })
    return { id: u.id, token: tokenFor(t.config, u.id, undefined, [role]) }
  }

  beforeAll(async () => {
    // GitHub claims are offered once its API is configured; this one is never reached, a bad name is refused first.
    t = await createTestApp({ GITHUB_API_URL: 'http://127.0.0.1:9' })
    schema = await publicSchema(t)
    admin = await person('PLATFORM_ADMIN')
    topicId = (await t.app.get(PrismaService).topic.findFirstOrThrow({ where: { origin: 'CURATED', children: { none: {} } }, select: { id: true } })).id
  })
  afterAll(async () => {
    await t?.close()
  })

  const submit = async (who: Person, words: string) =>
    (
      await t.gql<{ submitResource: { resource: { id: string } } }>(
        'mutation ($input: SubmitResourceInput!) { submitResource(input: $input) { resource { id } } }',
        { input: { type: 'BOOK', title: `Operating Systems ${words}`, url: `https://example.org/books/${newId()}`, topicIds: [topicId] } },
        who.token,
      )
    ).data!.submitResource.resource.id
  const decide = async (entityId: string, action: 'APPROVE' | 'REMOVE') =>
    expect(
      (
        await t.gql<{ moderateContent: { ok: boolean } }>(
          'mutation ($input: ModerateContentInput!) { moderateContent(input: $input) { ok } }',
          { input: { entityType: 'RESOURCE', entityId, action, reason: action === 'REMOVE' ? 'A sales page, not a book.' : undefined } },
          admin.token,
        )
      ).data!.moderateContent.ok,
    ).toBe(true)

  /** What `who` (null: a guest) finds of a resource: by id, in the catalogue, in search, and its discussion. */
  const seen = async (who: Person | null, id: string, words: string) => {
    const ask = async <T>(query: string, variables: Record<string, unknown>) => (await t.gql<T>(query, variables, who?.token)).data
    const one = await ask<{ resource: { id: string } | null }>('query ($id: UUID!) { resource(id: $id) { id } }', { id })
    const listed = await ask<{ resources: { edges: { node: { id: string } }[] } }>('query ($q: String) { resources(filter: { query: $q }) { edges { node { id } } } }', { q: words })
    const found = await ask<{ search: { resources: { id: string }[] } }>('query ($q: String!) { search(query: $q, scopes: [RESOURCES]) { resources { id } } }', { q: words })
    const discussion = await ask<{ discussion: { commentCount: number } | null }>('query ($id: UUID!) { discussion(target: { type: RESOURCE, id: $id }) { commentCount } }', { id })
    return {
      read: !!one?.resource,
      listed: !!listed?.resources.edges.some((e) => e.node.id === id),
      searched: !!found?.search.resources.some((r) => r.id === id),
      discussion: !!discussion?.discussion,
    }
  }
  const NOTHING = { read: false, listed: false, searched: false, discussion: false }

  /** What `who` manages to do with a resource: save, comment, report, recommend to their own group. */
  const done = async (who: Person, id: string, groupId: string) => {
    const tried = async (field: string, mutation: string, input: object) => {
      const res = await t.gql<Record<string, { ok?: boolean; userErrors: { message: string }[] } | null>>(mutation, { input }, who.token)
      const payload = res.data?.[field]
      return !res.errors?.length && !!payload && !payload.userErrors.length && payload.ok !== false
    }
    const body = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Is this any good?' }] }] }
    return {
      save: await tried('saveResource', 'mutation ($input: ResourceIdInput!) { saveResource(input: $input) { userErrors { message } } }', { id }),
      comment: await tried('addComment', 'mutation ($input: AddCommentInput!) { addComment(input: $input) { userErrors { message } } }', { target: { type: 'RESOURCE', id }, body }),
      report: await tried('reportContent', 'mutation ($input: ReportContentInput!) { reportContent(input: $input) { ok userErrors { message } } }', { entityType: 'RESOURCE', entityId: id, reason: 'SPAM' }),
      recommend: await tried('recommendResource', 'mutation ($input: RecommendResourceInput!) { recommendResource(input: $input) { ok userErrors { message } } }', { resourceId: id, to: { groupId } }),
    }
  }
  const NONE = { save: false, comment: false, report: false, recommend: false }

  it('a waiting or rejected resource reaches only its submitter and the moderators, through every channel', async () => {
    const submitter = await person()
    const other = await person()
    const groupId = (
      await t.gql<{ createGroup: { group: { id: string } } }>('mutation ($input: CreateGroupInput!) { createGroup(input: $input) { group { id } } }', { input: { name: `Readers ${newId()}`, privacy: 'PRIVATE' } }, other.token)
    ).data!.createGroup.group.id

    const waitingWords = `zephyrine${Date.now()}`
    const waiting = await submit(submitter, waitingWords)
    expect(await seen(null, waiting, waitingWords)).toEqual(NOTHING)
    expect(await seen(other, waiting, waitingWords)).toEqual(NOTHING)
    expect(await seen(await person('TEACHER'), waiting, waitingWords)).toEqual(NOTHING)
    expect(await done(other, waiting, groupId)).toEqual(NONE)
    expect((await seen(submitter, waiting, waitingWords)).read).toBe(true)
    expect((await seen(admin, waiting, waitingWords)).read).toBe(true)

    const rejectedWords = `quillwort${Date.now()}`
    const rejected = await submit(submitter, rejectedWords)
    await decide(rejected, 'REMOVE')
    expect(await seen(null, rejected, rejectedWords)).toEqual(NOTHING)
    expect(await seen(other, rejected, rejectedWords)).toEqual(NOTHING)
    expect(await done(other, rejected, groupId)).toEqual(NONE)
    expect((await seen(submitter, rejected, rejectedWords)).read).toBe(true)
    expect((await seen(admin, rejected, rejectedWords)).read).toBe(true)

    // The same channels do show it once a moderator approves it, so the checks above can see a leak (discussions are
    // read signed in).
    await decide(waiting, 'APPROVE')
    expect(await seen(null, waiting, waitingWords)).toEqual({ read: true, listed: true, searched: true, discussion: false })
    expect(await seen(other, waiting, waitingWords)).toEqual({ read: true, listed: true, searched: true, discussion: true })
    expect(await done(other, waiting, groupId)).toEqual({ save: true, comment: true, report: true, recommend: true })
  })

  it('has no commerce surface: no type, field, argument or value prices, sells, stocks or carts anything', () => {
    const names: string[] = []
    for (const type of Object.values(schema.getTypeMap())) {
      if (type.name.startsWith('__')) continue
      names.push(type.name)
      if (isObjectType(type) || isInterfaceType(type) || isInputObjectType(type))
        for (const field of Object.values(type.getFields())) {
          names.push(`${type.name}.${field.name}`)
          if ('args' in field) for (const arg of field.args) names.push(`${type.name}.${field.name}(${arg.name})`)
        }
      if (isEnumType(type)) for (const value of type.getValues()) names.push(`${type.name}.${value.name}`)
    }
    /** The words of a name's last part: `ResourceSort.MOST_SAVED` → most, saved; `viewerSaved` → viewer, saved. */
    const words = (name: string) =>
      name
        .split(/[.(]/)
        .filter(Boolean)
        .pop()!
        .replace(/\)$/, '')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/_/g, ' ')
        .toLowerCase()
        .split(' ')
    const commerce = [...COMMERCE_WORDS, 'purchase', 'payment', 'pay', 'coupon', 'sale', 'sell']
    // Plan prices and AI usage cost are configuration or a public price list (ADR-0101). Nothing is charged or sold.
    const adminConfig = new Set([
      'AdminAiMetrics.costMicroUsd',
      'AdminAiModelUsage.costMicroUsd',
      'AdminAiProviderUsage.costMicroUsd',
      'AdminAiTaskUsage.costMicroUsd',
      'AdminPlan.priceMinor',
      'AdminPlan.currency',
      'CreateAdminPlanInput.priceMinor',
      'CreateAdminPlanInput.currency',
      'UpdateAdminPlanInput.priceMinor',
      'UpdateAdminPlanInput.currency',
      'PublicPlan.priceMinor',
      'PublicPlan.currency',
    ])
    expect(names.length).toBeGreaterThan(500)
    expect(names.filter((n) => !adminConfig.has(n) && words(n).some((w) => commerce.includes(w)))).toEqual([])
  })

  it('skills import never reads this machine or a private network, whatever page a teacher claims', async () => {
    const teacher = await person('TEACHER')
    const claim = async (value: string) => {
      const added = (
        await t.gql<{ addExternalIdentity: { identity: { id: string } | null; userErrors: { message: string }[] } }>(
          'mutation ($input: AddExternalIdentityInput!) { addExternalIdentity(input: $input) { identity { id } userErrors { message } } }',
          { input: { kind: 'WEBSITE', value } },
          teacher.token,
        )
      ).data!.addExternalIdentity
      if (!added.identity) return added.userErrors[0]!.message
      const checked = (
        await t.gql<{ checkExternalIdentity: { identity: { verified: boolean; lastError: string | null } } }>(
          'mutation ($input: ExternalIdentityIdInput!) { checkExternalIdentity(input: $input) { identity { verified lastError } } }',
          { input: { identityId: added.identity.id } },
          teacher.token,
        )
      ).data!.checkExternalIdentity.identity
      expect(checked.verified).toBe(false)
      return checked.lastError
    }
    for (const value of ['http://169.254.169.254/latest/meta-data/', 'http://127.0.0.1:4000/', 'http://10.0.0.1/', 'http://[::1]/', 'http://[fd00::1]/', 'http://100.64.0.1/', 'http://localhost/'])
      expect([value, await claim(value)]).toEqual([value, expect.stringMatching(/^(That address is not on the public internet|Only the usual web ports are fetched|That is not a public web address)\.$/)])
    expect(await claim('file:///etc/passwd')).toMatch(/web address/)
    // A GitHub name only ever becomes /users/<name> on the configured API: a path in it is dropped or refused.
    const github = async (value: string) =>
      (
        await t.gql<{ addExternalIdentity: { identity: { value: string } | null; userErrors: { message: string }[] } }>(
          'mutation ($input: AddExternalIdentityInput!) { addExternalIdentity(input: $input) { identity { value } userErrors { message } } }',
          { input: { kind: 'GITHUB', value } },
          teacher.token,
        )
      ).data!.addExternalIdentity
    expect((await github('octocat/../../admin')).identity?.value).toBe('octocat')
    expect((await github('../../admin')).userErrors[0]?.message).toBe('That is not a GitHub user name.')
    expect((await github('https://evil.example/octocat')).userErrors[0]?.message).toBe('That is not a GitHub user name.')
  })
})
