import { newId, PrismaService } from '@lvn-backend/prisma-base'
import request from 'supertest'
import { MAX_COMPLEXITY, MAX_DEPTH, OPERATIONS_PER_MINUTE } from '@lvn-backend/graphql'
import { createTestApp, type TestApp } from '../support/app'
import { seedActors, type Actors } from './support/actors'
import { seedUser, tokenFor } from '../support/seed'

/**
 * §17.1: depth, complexity, pagination caps and rate limits reject abuse; brute force and credential stuffing are
 * rate-limited; refresh-token reuse revokes the session family.
 */
const SIGN_UP = 'mutation ($input: SignUpInput!) { signUp(input: $input) { session { refreshToken } userErrors { message } } }'
const SIGN_IN = 'mutation ($input: SignInInput!) { signIn(input: $input) { session { accessToken } userErrors { message code } } }'
const REFRESH = 'mutation ($t: String!) { refreshSession(input: { refreshToken: $t }) { session { accessToken refreshToken } } }'

describe('security: abuse', () => {
  let t: TestApp
  let actors: Actors

  beforeAll(async () => {
    t = await createTestApp()
    actors = await seedActors(t)
  })
  afterAll(() => t.close())

  /** POST /graphql from a chosen client address (the test app trusts one proxy hop). */
  const from = (ip: string, query: string, variables: object, headers: Record<string, string> = {}) =>
    request(t.app.getHttpServer()).post('/graphql').set('content-type', 'application/json').set('x-forwarded-for', ip).set(headers).send({ query, variables })

  const account = async (label: string) => {
    const email = `${label}-${newId().slice(-8)}@example.com`
    const password = `${label} long passphrase`
    const res = await from('198.51.100.1', SIGN_UP, { input: { email, password, displayName: label, dateOfBirth: '2003-03-03', acceptedTermsVersion: '2026-11-03' } }, { 'x-lvn-client': 'mobile' })
    return { email, password, refreshToken: res.body.data.signUp.session.refreshToken as string }
  }

  describe('query limits', () => {
    it(`rejects queries deeper than ${MAX_DEPTH}`, async () => {
      // Introspection types nest as deep as asked. Alone, an introspection query is exempt (development tooling);
      // next to a real field it counts like any other selection.
      const nested = Array.from({ length: MAX_DEPTH }).reduce<string>((inner) => `ofType { ${inner} }`, 'name')
      const res = await t.gql(`{ termsVersion __schema { types { ${nested} } } }`)
      expect(res.status).toBe(400)
      expect(res.errors?.[0]).toMatchObject({ extensions: { code: 'VALIDATION' }, message: expect.stringMatching(/too deep/) })
    })

    it(`rejects queries more complex than ${MAX_COMPLEXITY}`, async () => {
      const aliases = Array.from({ length: MAX_COMPLEXITY + 1 }, (_, i) => `t${i}: termsVersion`).join(' ')
      const res = await t.gql(`{ ${aliases} }`)
      expect(res.status).toBe(400)
      expect(res.errors?.[0]).toMatchObject({ extensions: { code: 'VALIDATION' }, message: expect.stringMatching(/too complex/) })
    })

    it('answers a missing or ill-typed variable as the client’s mistake (400), not a server failure', async () => {
      for (const variables of [{}, { t: null }, { t: 42 }]) {
        const res = await t.gql(REFRESH, variables)
        expect(res.status).toBe(400)
        expect(res.errors?.[0]?.extensions.code).toBe('VALIDATION')
      }
    })

    it(`lets a signed-in person send ${OPERATIONS_PER_MINUTE} operations a minute, then answers 429 with Retry-After (ADR-0090)`, async () => {
      const person = await seedUser(t.app)
      const token = tokenFor(t.config, person.id)
      const ask = () => request(t.app.getHttpServer()).post('/graphql').set('content-type', 'application/json').set('authorization', `Bearer ${token}`).send({ query: '{ viewer { id } }' })
      for (let sent = 0; sent < OPERATIONS_PER_MINUTE; sent += 50) {
        const answers = await Promise.all(Array.from({ length: Math.min(50, OPERATIONS_PER_MINUTE - sent) }, ask))
        expect(answers.every((a) => a.status === 200)).toBe(true)
      }
      const refused = await ask()
      expect(refused.status).toBe(429)
      expect(Number(refused.headers['retry-after'])).toBeGreaterThan(0)
      expect(refused.body.errors[0].extensions).toMatchObject({ code: 'RATE_LIMITED' })
      // Everyone else carries on.
      expect((await t.gql<{ viewer: { id: string } }>('{ viewer { id } }', {}, actors.a.token)).data?.viewer).toBeTruthy()
    }, 60_000)

    it('answers a subscription sent over HTTP with 400, not a failure (found by ZAP, Phase 9)', async () => {
      const res = await request(t.app.getHttpServer()).post('/graphql').set('content-type', 'application/json').set('authorization', `Bearer ${actors.a.token}`).send({ query: 'subscription { live { kind id at } }' })
      expect(res.status).toBe(400)
      expect(res.body.errors[0].extensions).toMatchObject({ code: 'VALIDATION' })
    })

    it('refuses batched operations, and counts every alias towards complexity (OWASP GraphQL Cheat Sheet)', async () => {
      const post = (body: string | object) => request(t.app.getHttpServer()).post('/graphql').set('content-type', 'application/json').send(body)
      const batched = await post([{ query: '{ termsVersion }' }, { query: '{ termsVersion }' }])
      expect(batched.status).toBe(400)
      const aliases = await post({ query: `{ ${Array.from({ length: MAX_COMPLEXITY + 1 }, (_, i) => `a${i}: termsVersion`).join(' ')} }` })
      expect(aliases.status).toBe(400)
      expect(aliases.body.errors[0].message).toMatch(/too complex/)
    })

    it('caps list sizes whatever `first` asks for', async () => {
      const db = t.app.get(PrismaService)
      const ids = Array.from({ length: 105 }, () => newId())
      await db.user.createMany({ data: ids.map((id) => ({ id, email: `queue-${id}@example.com`, handle: `q${id.slice(-12)}`, displayName: 'Queued', dateOfBirth: new Date('2004-01-01'), registrationCompletedAt: new Date() })) })
      await db.verificationRequest.createMany({ data: ids.map((userId) => ({ id: newId(), userId, method: 'DOCUMENTS' as const, status: 'PENDING' as const, documentIds: [] })) })
      const res = await t.gql<{ verificationRequestsToReview: unknown[] }>('{ verificationRequestsToReview(first: 100000) { id } }', {}, actors.admin.token)
      expect(res.data!.verificationRequestsToReview.length).toBe(100)
    })
  })

  describe('sign-in', () => {
    it('stops guessing one account’s password after 5 failures, even when the 6th guess is right', async () => {
      const victim = await account('brute')
      for (let i = 0; i < 5; i++) await from('198.51.100.2', SIGN_IN, { input: { email: victim.email, password: `guess number ${i}` } })
      const res = await from('198.51.100.3', SIGN_IN, { input: { email: victim.email, password: victim.password } })
      expect(res.body.data.signIn).toMatchObject({ session: null, userErrors: [{ code: 'RATE_LIMITED' }] })
    })

    it('stops credential stuffing: 50 failed sign-ins from one network across many accounts', async () => {
      const real = await account('stuffed')
      for (let i = 0; i < 50; i++) {
        const res = await from('203.0.113.50', SIGN_IN, { input: { email: `leaked-${i}@example.com`, password: 'password from a leak' } })
        expect(res.body.data?.signIn.userErrors[0]?.message).toBe('Email or password is incorrect.')
      }
      const blocked = await from('203.0.113.50', SIGN_IN, { input: { email: real.email, password: real.password } })
      expect(blocked.body.data.signIn).toMatchObject({ session: null, userErrors: [{ code: 'RATE_LIMITED', message: expect.stringMatching(/your network/) }] })
      const elsewhere = await from('203.0.113.51', SIGN_IN, { input: { email: real.email, password: real.password } })
      expect(elsewhere.body.data.signIn.session.accessToken).toBeTruthy()
    })

    it('counts an IPv6 attacker by /64, so rotating addresses does not help', async () => {
      for (let i = 1; i <= 50; i++) await from(`2001:db8:5:6::${i.toString(16)}`, SIGN_IN, { input: { email: `v6-leaked-${i}@example.com`, password: 'password from a leak' } })
      const res = await from('2001:db8:5:6:ffff::99', SIGN_IN, { input: { email: 'anyone@example.com', password: 'anything at all' } })
      expect(res.body.data.signIn.userErrors[0]?.code).toBe('RATE_LIMITED')
    })

    it('does not count successful sign-ins against the network (a campus behind one address)', async () => {
      const people = await Promise.all(Array.from({ length: 3 }, (_, i) => account(`campus${i}`)))
      for (let round = 0; round < 20; round++) {
        for (const p of people) {
          const res = await from('192.0.2.77', SIGN_IN, { input: { email: p.email, password: p.password } })
          expect(res.body.data.signIn.userErrors).toEqual([])
        }
      }
    })
  })

  it('revokes the whole session family when a used refresh token comes back', async () => {
    const { refreshToken: first } = await account('reuse')
    const refresh = (token: string) => from('198.51.100.9', REFRESH, { t: token }, { 'x-lvn-client': 'mobile' })
    const { accessToken, refreshToken: second } = (await refresh(first)).body.data.refreshSession.session as { accessToken: string; refreshToken: string }
    // The stolen first token is replayed: refused, and the legitimate holder's session ends too.
    expect((await refresh(first)).body.errors?.[0]?.extensions.code).toBe('UNAUTHENTICATED')
    expect((await refresh(second)).body.errors?.[0]?.extensions.code).toBe('UNAUTHENTICATED')
    expect((await t.gql<{ viewer: unknown }>('{ viewer { id } }', {}, accessToken)).data?.viewer).toBeNull()
  })
})
