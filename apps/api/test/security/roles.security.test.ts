import { getNamedType, isEnumType, isInputObjectType, type GraphQLInputType, type GraphQLSchema } from 'graphql'
import { PrismaService } from '@lvn-backend/prisma-base'
import { createTestApp, type TestApp } from '../support/app'
import { tokenFor } from '../support/seed'
import { roleOf, seedActors, type Actors } from './support/actors'
import { operationFor, publicSchema } from './support/fuzz'

/** §17.1: a student cannot obtain TEACHER or GROUP_ADMIN through any mutation. */
describe('security: roles', () => {
  let t: TestApp
  let actors: Actors
  let schema: GraphQLSchema

  beforeAll(async () => {
    t = await createTestApp()
    actors = await seedActors(t)
    schema = await publicSchema(t)
  })
  afterAll(() => t.close())

  const mutations = () => Object.values(schema.getMutationType()!.getFields())

  it('no mutation takes a role, except the platform-admin tool setGlobalRole', () => {
    const roleInputs: string[] = []
    const visit = (type: GraphQLInputType, path: string, seen: Set<string>) => {
      const named = getNamedType(type)
      if (isEnumType(named) && /Role$/.test(named.name)) roleInputs.push(path)
      if (!isInputObjectType(named) || seen.has(named.name)) return
      for (const f of Object.values(named.getFields())) visit(f.type, `${path}.${f.name}`, new Set([...seen, named.name]))
    }
    for (const m of mutations()) for (const a of m.args) visit(a.type, `${m.name}(${a.name})`, new Set())
    expect(roleInputs).toEqual(['setGlobalRole(input).role'])
  })

  it('every mutation, called by a student with every role value and their own or a teacher’s id, leaves them a student', async () => {
    const internal: string[] = []
    // signOut last: it ends the session the token belongs to.
    const all = mutations().sort((x, y) => Number(x.name === 'signOut') - Number(y.name === 'signOut'))
    expect(all.length).toBeGreaterThan(20)
    for (const role of ['TEACHER', 'PLATFORM_ADMIN']) {
      for (const uuid of [actors.a.id, actors.teacher.id]) {
        for (const m of all) {
          if (m.name === 'signOut' && !(role === 'PLATFORM_ADMIN' && uuid === actors.teacher.id)) continue
          const { query, variables } = operationFor(m, { uuid, enums: { GlobalRole: role } })
          const res = await t.gql(query, variables, actors.a.token)
          expect(res.status).toBeLessThan(500)
          for (const e of res.errors ?? []) if (e.extensions.code === 'INTERNAL') internal.push(`${m.name}: ${e.message}`)
        }
      }
    }
    // Garbage input is a VALIDATION or FORBIDDEN answer, never an unexpected failure.
    expect(internal).toEqual([])
    expect(await roleOf(t, actors.a.id)).toBe('STUDENT')
    expect(await roleOf(t, actors.teacher.id)).toBe('TEACHER')
    expect(await t.app.get(PrismaService).user.count({ where: { globalRole: 'PLATFORM_ADMIN' } })).toBe(1)
  })

  it('refuses setGlobalRole to students and teachers, and the generated call does work for a platform admin', async () => {
    const setRole = mutations().find((m) => m.name === 'setGlobalRole')!
    for (const caller of [actors.b, actors.teacher]) {
      const { query, variables } = operationFor(setRole, { uuid: caller.id, enums: { GlobalRole: 'PLATFORM_ADMIN' } })
      const res = await t.gql<{ setGlobalRole: { __typename: string } }>(query, variables, caller.token)
      expect(res.errors?.[0]?.extensions.code ?? 'no error').toBe('FORBIDDEN')
    }
    // Positive control: the fuzzer's own call shape reaches the mutation, so the test above is not vacuous.
    const { query, variables } = operationFor(setRole, { uuid: actors.b.id, enums: { GlobalRole: 'TEACHER' } })
    expect((await t.gql(query, variables, actors.admin.token)).errors).toBeUndefined()
    expect(await roleOf(t, actors.b.id)).toBe('TEACHER')
  })

  it('takes roles from the database on every check, not from the access token', async () => {
    // A token claiming PLATFORM_ADMIN for a student (as if the signing key were misused) grants nothing.
    const forged = tokenFor(t.config, actors.a.id, undefined, ['PLATFORM_ADMIN'])
    const res = await t.gql('mutation ($id: UUID!) { setGlobalRole(input: { userId: $id, role: PLATFORM_ADMIN }) { ok } }', { id: actors.a.id }, forged)
    expect(res.errors?.[0]?.extensions.code).toBe('FORBIDDEN')
    expect(await roleOf(t, actors.a.id)).toBe('STUDENT')
  })

  it('makes every new account a student, whatever it sends', async () => {
    const res = await t.gql<{ signUp: { session: { user: { globalRole: string } } | null } }>(
      'mutation ($input: SignUpInput!) { signUp(input: $input) { session { user { globalRole } } } }',
      { input: { email: 'new-teacher-claim@example.com', password: 'a long enough passphrase', displayName: 'Claims To Teach', dateOfBirth: '1990-01-01', acceptedTermsVersion: '2026-10-08' } },
    )
    expect(res.data?.signUp.session?.user.globalRole).toBe('STUDENT')
  })

  it.todo('GROUP_ADMIN cannot be obtained through any group or classroom mutation (Phase 3: groups and classrooms)')
})
