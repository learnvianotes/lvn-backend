import { getIntrospectionQuery } from 'graphql'
import request from 'supertest'
import { createTestApp, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'

/** The public GraphQL endpoint: the gateway over the in-process subgraphs (spec §6, §6.2). */
describe('GraphQL gateway', () => {
  let t: TestApp

  beforeAll(async () => {
    t = await createTestApp()
  })

  afterAll(() => t.close())

  it('answers viewer with null for anonymous callers', async () => {
    expect(await t.gql('{ viewer { id } }')).toMatchObject({ status: 200, data: { viewer: null } })
  })

  it('resolves the signed-in viewer through the users subgraph', async () => {
    const user = await seedUser(t.app, { displayName: 'Asha' })
    const res = await t.gql<{ viewer: { id: string; displayName: string; email: string; registrationComplete: boolean; verified: boolean } }>(
      '{ viewer { id displayName email registrationComplete verified } }',
      {},
      tokenFor(t.config, user.id),
    )
    expect(res.data?.viewer).toEqual({ id: user.id, displayName: 'Asha', email: user.email, registrationComplete: true, verified: false })
  })

  it('treats an invalid or foreign token as anonymous', async () => {
    expect((await t.gql('{ viewer { id } }', {}, 'not.a.token')).data).toEqual({ viewer: null })
    const user = await seedUser(t.app)
    const tampered = tokenFor(t.config, user.id).slice(0, -4) + 'AAAA'
    expect((await t.gql('{ viewer { id } }', {}, tampered)).data).toEqual({ viewer: null })
  })

  it('reports invalid queries as VALIDATION without internals', async () => {
    const res = await t.gql('{ viewer { password } }')
    expect(res.errors?.[0]?.extensions).toEqual({ code: 'VALIDATION' })
    expect(JSON.stringify(res.errors)).not.toMatch(/stack|node_modules/)
  })

  it('rejects queries deeper than 8 levels (§6.2)', async () => {
    // Next to a real field, introspection counts like any other selection.
    const deep = '{ termsVersion __schema { types { fields { type { ofType { ofType { ofType { ofType { name } } } } } } } } }'
    const res = await t.gql(deep)
    expect(res.status).toBe(400)
    expect(res.errors?.[0]?.extensions.code).toBe('VALIDATION')
    expect(res.errors?.[0]?.message).toMatch(/too deep/)
  })

  it('answers the standard introspection query in development (codegen, GraphiQL), deeper than the limit as it is', async () => {
    const res = await t.gql<{ __schema: { queryType: { name: string } } }>(getIntrospectionQuery())
    expect(res.errors).toBeUndefined()
    expect(res.data!.__schema.queryType.name).toBe('Query')
  })

  it('keeps the subgraph endpoints private', async () => {
    await request(t.app.getHttpServer()).post('/_subgraph/users').send({ query: '{ _service { sdl } }' }).expect(404)
  })

  it('hides federation internals from clients', async () => {
    const res = await t.gql('{ _service { sdl } }')
    expect(res.errors?.[0]?.extensions.code).toBe('VALIDATION')
  })

  it('blocks simple cross-site POSTs (CSRF prevention)', async () => {
    const res = await request(t.app.getHttpServer()).post('/graphql').set('content-type', 'text/plain').send('{"query":"{ viewer { id } }"}')
    expect(res.status).toBe(400)
  })
})
