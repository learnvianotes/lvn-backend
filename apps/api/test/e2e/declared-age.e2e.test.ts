import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { createTestApp, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'

/**
 * ADR-0104: accounts that typed an age instead of a date of birth. The restricted-minor rules (§15.2, ADR-0016,
 * ADR-0043) and people search read the declared age plus the whole years since it was given, which never overstates
 * it. The digital-consent age is the default 18. Docker (Postgres, Redis, S3, Mailpit) is required to run this file.
 */

const DAY = 86_400_000
const SIGN_UP = `mutation ($input: SignUpInput!) { signUp(input: $input) { session { accessToken user { id handle } } userErrors { field message code } } }`

describe('declared ages', () => {
  let t: TestApp
  let db: PrismaService
  type Person = { id: string; handle: string; token: string; name: string }
  let stranger: Person
  let teacher: Person
  /** One word every name here shares, so a search finds only this file's people. */
  const tag = `Zeph${newId().replace(/-/g, '').slice(0, 8)}`

  /** A seeded account with no date of birth that declared `age` some days ago. */
  const declared = async (label: string, age: number, daysAgo: number, role: 'STUDENT' | 'TEACHER' = 'STUDENT'): Promise<Person> => {
    const name = `${tag} ${label}`
    const u = await seedUser(t.app, { verified: true, displayName: name, globalRole: role })
    await db.user.update({ where: { id: u.id }, data: { dateOfBirth: null, declaredAge: age, ageDeclaredAt: new Date(Date.now() - daysAgo * DAY) } })
    return { id: u.id, handle: u.handle, token: tokenFor(t.config, u.id), name }
  }
  const restrictedMinor = async (who: Person) => (await t.gql<{ viewer: { restrictedMinor: boolean } }>('{ viewer { restrictedMinor } }', {}, who.token)).data!.viewer.restrictedMinor
  const found = async (who: Person) => (await t.gql<{ search: { people: { id: string }[] } }>('query ($q: String!) { search(query: $q, scopes: [PEOPLE]) { people { id } } }', { q: tag }, who.token)).data!.search.people.map((p) => p.id)
  const profile = async (handle: string, who: Person) => (await t.gql<{ userByHandle: { id: string } | null }>('query ($h: String!) { userByHandle(handle: $h) { id } }', { h: handle }, who.token)).data!.userByHandle
  const follow = async (who: Person, target: Person) => {
    const res = await t.gql<{ followUser: { userErrors: { code: string }[] } }>('mutation ($input: PersonInput!) { followUser(input: $input) { userErrors { code } } }', { input: { userId: target.id } }, who.token)
    return res.data ? res.data.followUser.userErrors.map((e) => e.code) : (res.errors ?? []).map((e) => e.extensions.code)
  }
  const followers = async (who: Person) => (await t.gql<{ myFollowers: { edges: { node: { id: string } }[] } }>('{ myFollowers { edges { node { id } } } }', {}, who.token)).data!.myFollowers.edges.map((e) => e.node.id)

  beforeAll(async () => {
    t = await createTestApp()
    db = t.app.get(PrismaService)
    const s = await seedUser(t.app, { verified: true, displayName: 'Stranger Danger' })
    stranger = { id: s.id, handle: s.handle, token: tokenFor(t.config, s.id), name: s.displayName }
    teacher = await declared('Teacher', 35, 0, 'TEACHER')
  })
  afterAll(() => t.close())

  it('treats an age typed at sign-up as the person’s age: an adult is found, followed and named', async () => {
    const res = await t.gql<{ signUp: { session: { accessToken: string; user: { id: string; handle: string } }; userErrors: unknown[] } }>(SIGN_UP, {
      input: { email: `${tag.toLowerCase()}@example.com`, password: 'correct horse battery staple', displayName: `${tag} Adult`, age: 30, acceptedTermsVersion: '2026-11-12' },
    })
    expect(res.data!.signUp.userErrors).toEqual([])
    const { accessToken, user } = res.data!.signUp.session
    const adult = { id: user.id, handle: user.handle, token: accessToken, name: `${tag} Adult` }
    await db.user.update({ where: { id: adult.id }, data: { verifiedAt: new Date(), verificationMethod: 'INSTITUTIONAL_EMAIL' } })

    expect(await restrictedMinor(adult)).toBe(false)
    expect(await found(stranger)).toContain(adult.id)
    expect(await profile(adult.handle, stranger)).toEqual({ id: adult.id })
    expect(await follow(stranger, adult)).toEqual([])
    expect(await follow(adult, teacher)).toEqual([])
    expect(await followers(teacher)).toContain(adult.id)
  })

  it('keeps a declared minor restricted: not found, no profile for others, counted but never named', async () => {
    const minor = await declared('Minor', 16, 0)
    expect(await restrictedMinor(minor)).toBe(true)
    expect(await found(stranger)).not.toContain(minor.id)
    expect(await profile(minor.handle, stranger)).toBeNull()
    expect(await profile(minor.handle, minor)).toEqual({ id: minor.id })
    expect(await follow(stranger, minor)).toEqual(['FORBIDDEN'])
    expect(await follow(minor, teacher)).toEqual([])
    expect(await followers(teacher)).not.toContain(minor.id)
  })

  it('counts a declared age forward only by whole years since it was given', async () => {
    // Said 17 more than a year ago: at least 18 now.
    const grown = await declared('Grown', 17, 370)
    // Said 17 less than a year ago: may be 18 already, but is counted 17 until the year is up.
    const notYet = await declared('NotYet', 17, 300)
    expect(await restrictedMinor(grown)).toBe(false)
    expect(await restrictedMinor(notYet)).toBe(true)
    const people = await found(stranger)
    expect(people).toContain(grown.id)
    expect(people).not.toContain(notYet.id)
    expect(await follow(stranger, grown)).toEqual([])
    expect(await follow(stranger, notYet)).toEqual(['FORBIDDEN'])
  })

  it('lets a stored date of birth decide over a declared age', async () => {
    const both = await declared('Both', 40, 0)
    await db.user.update({ where: { id: both.id }, data: { dateOfBirth: new Date(Date.now() - 15 * 365 * DAY) } })
    expect(await restrictedMinor(both)).toBe(true)
    expect(await found(stranger)).not.toContain(both.id)
  })

  it('treats an account with neither a date of birth nor an age as restricted', async () => {
    const unknown = await declared('Unknown', 30, 0)
    await db.user.update({ where: { id: unknown.id }, data: { declaredAge: null, ageDeclaredAt: null } })
    expect(await restrictedMinor(unknown)).toBe(true)
    expect(await found(stranger)).not.toContain(unknown.id)
  })
})
