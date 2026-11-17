import { createHmac, generateKeyPairSync, randomUUID } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { GitHubAppService } from '@lvn-backend/core'
import { PrismaService } from '@lvn-backend/prisma-base'
import request from 'supertest'
import { createTestApp, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'

/**
 * Repository activity from a GitHub App (ADR-0078): a workspace admin connects it only when GitHub confirms they made
 * the installation and it covers the workspace's repository; deliveries count only with a good signature, once; the
 * worker turns them into commits, pull requests and issues for members; uninstalling unlinks and forgets.
 */
describe('GitHub App repository activity', () => {
  let t: TestApp
  let db: PrismaService
  let github: Server
  let jwtSeen = ''
  const SECRET = 'webhook-secret-0123456789'
  type Person = { id: string; token: string }

  beforeAll(async () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } })
    github = createServer((req, res) => {
      const json = (body: unknown, status = 200) => res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body))
      const auth = req.headers.authorization ?? ''
      if (req.url === '/login/oauth/access_token') {
        let raw = ''
        req.on('data', (c) => (raw += c))
        req.on('end', () => json((JSON.parse(raw) as { code: string }).code === 'good' ? { access_token: 'user-token' } : { error: 'bad_verification_code' }))
        return
      }
      if (req.url?.startsWith('/user/installations')) return auth === 'Bearer user-token' ? json({ installations: [{ id: 42, account: { login: 'team' } }, { id: 44, account: { login: 'team' } }] }) : json({}, 401)
      const token = /^\/app\/installations\/(\d+)\/access_tokens$/.exec(req.url ?? '')
      if (token && req.method === 'POST') {
        jwtSeen = auth
        return json({ token: `installation-${token[1]}` })
      }
      if (req.url?.startsWith('/installation/repositories')) return json({ repositories: auth === 'Bearer installation-42' ? [{ full_name: 'team/heap-viz' }] : [{ full_name: 'team/other' }] })
      if (req.url === '/repos/team/heap-viz') return json({ full_name: 'team/heap-viz', description: 'Watch a heap grow', language: 'TypeScript', stargazers_count: 1, pushed_at: '2026-10-10T09:00:00Z', private: false })
      json({ message: 'Not Found' }, 404)
    })
    await new Promise<void>((r) => github.listen(0, '127.0.0.1', r))
    const base = `http://127.0.0.1:${(github.address() as AddressInfo).port}`
    t = await createTestApp({
      GITHUB_API_URL: base,
      GITHUB_APP_URL: base,
      GITHUB_APP_ID: '1234',
      GITHUB_APP_SLUG: 'learnvianotes-test',
      GITHUB_APP_PRIVATE_KEY: privateKey.replace(/\n/g, '\\n'),
      GITHUB_APP_WEBHOOK_SECRET: SECRET,
      GITHUB_APP_CLIENT_ID: 'Iv1.test',
      GITHUB_APP_CLIENT_SECRET: 'client-secret',
    })
    db = t.app.get(PrismaService)
  })
  afterAll(async () => {
    await t?.close()
    await new Promise<void>((r) => github.close(() => r()))
  })

  const person = async (): Promise<Person> => {
    const u = await seedUser(t.app, { verified: true })
    return { id: u.id, token: tokenFor(t.config, u.id) }
  }
  const gql = <T>(query: string, variables: object, who: Person) => t.gql<T>(query, variables as Record<string, unknown>, who.token)
  const repository = async (groupId: string, who: Person) =>
    (await gql<{ group: { repository: { app: { connected: boolean; installUrl: string | null } | null; events: { kind: string; action: string; title: string; authorLogin: string | null; url: string }[] | null } | null } | null }>('query ($id: UUID!) { group(id: $id) { repository { app { connected installUrl } events(first: 10) { kind action title authorLogin url } } } }', { id: groupId }, who)).data!.group?.repository ?? null
  const connect = async (who: Person, input: object) => {
    const res = await gql<{ connectRepositoryApp: { userErrors: { message: string }[] } }>('mutation ($input: ConnectRepositoryAppInput!) { connectRepositoryApp(input: $input) { userErrors { message } } }', { input }, who)
    return res.errors?.[0]?.message ?? res.data!.connectRepositoryApp.userErrors[0]?.message ?? null
  }
  const deliver = (event: string, payload: object, id = randomUUID(), signature?: string) => {
    const body = JSON.stringify(payload)
    return request(t.app.getHttpServer())
      .post('/webhooks/github')
      .set('content-type', 'application/json')
      .set('x-github-event', event)
      .set('x-github-delivery', id)
      .set('x-hub-signature-256', signature ?? `sha256=${createHmac('sha256', SECRET).update(body).digest('hex')}`)
      .send(body)
  }

  it('connects only what the admin installed on the workspace’s repository, and brings its activity to members', async () => {
    const owner = await person()
    const member = await person()
    const outsider = await person()
    const groupId = (await gql<{ createGroup: { group: { id: string } } }>('mutation ($input: CreateGroupInput!) { createGroup(input: $input) { group { id } } }', { input: { name: 'Heap visualiser', privacy: 'PRIVATE', type: 'PROJECT' } }, owner)).data!.createGroup.group.id
    await db.groupMember.create({ data: { groupId, userId: member.id, role: 'MEMBER' } })
    await gql('mutation ($input: SetGroupRepositoryInput!) { setGroupRepository(input: $input) { group { id } } }', { input: { groupId, url: 'https://github.com/team/heap-viz' } }, owner)

    // Admins get the install link; members see it is not connected; outsiders see nothing of it.
    const mine = (await repository(groupId, owner))!.app!
    expect(mine.connected).toBe(false)
    expect(mine.installUrl).toMatch(/\/apps\/learnvianotes-test\/installations\/new\?state=/)
    expect((await repository(groupId, member))!.app).toEqual({ connected: false, installUrl: null })
    const state = decodeURIComponent(new URL(mine.installUrl!).searchParams.get('state')!)

    // Refused: someone else's installation, one that does not cover the repository, a forged state, a member.
    expect(await connect(owner, { state, installationId: '43', code: 'good' })).toBe('That GitHub installation is not one you made.')
    expect(await connect(owner, { state, installationId: '44', code: 'good' })).toBe('The App is not installed on team/heap-viz: add the repository to it on GitHub, then connect again.')
    expect(await connect(owner, { state: `${groupId}.${Date.now()}.forged`, installationId: '42', code: 'good' })).toBe('That link has expired: start connecting again from the workspace.')
    expect(await connect(member, { state, installationId: '42', code: 'good' })).toBe('Only the workspace’s admins connect its repository.')
    expect(await connect(owner, { state, installationId: '42', code: 'good' })).toBeNull()
    expect(jwtSeen).toMatch(/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/)
    expect((await repository(groupId, owner))!.app).toEqual({ connected: true, installUrl: null })

    // Deliveries: a bad signature is refused; a good one is taken once; the worker makes the events.
    const push = { installation: { id: 42 }, repository: { full_name: 'Team/Heap-Viz' }, commits: [{ message: 'Add a min-heap\n\nLong body never shown', url: 'https://github.com/team/heap-viz/commit/a1', timestamp: '2026-10-14T09:00:00Z', author: { username: 'asha' } }] }
    expect((await deliver('push', push, undefined, 'sha256=00')).status).toBe(401)
    const id = randomUUID()
    expect((await deliver('push', push, id)).status).toBe(202)
    expect((await deliver('push', push, id)).body).toEqual({ ok: true, duplicate: true })
    const app = t.app.get(GitHubAppService)
    expect(await app.handle(id)).toBe(1)
    const merged = randomUUID()
    await deliver('pull_request', { action: 'closed', installation: { id: 42 }, repository: { full_name: 'team/heap-viz' }, pull_request: { title: 'Heap sort', number: 7, merged: true, html_url: 'https://github.com/team/heap-viz/pull/7', updated_at: '2026-10-14T10:00:00Z', user: { login: 'ravi' } } }, merged)
    await app.handle(merged)
    const other = randomUUID()
    await deliver('push', { ...push, repository: { full_name: 'team/other' } }, other)
    expect(await app.handle(other)).toBe(0)
    expect((await repository(groupId, member))!.events).toEqual([
      { kind: 'PULL_REQUEST', action: 'merged', title: 'Heap sort', authorLogin: 'ravi', url: 'https://github.com/team/heap-viz/pull/7' },
      { kind: 'PUSH', action: 'pushed', title: 'Add a min-heap', authorLogin: 'asha', url: 'https://github.com/team/heap-viz/commit/a1' },
    ])
    // Outsiders see the repository card, never its App or activity.
    expect(await repository(groupId, outsider)).toEqual({ app: null, events: null })
    const feed = (await gql<{ activityFeed: { edges: { node: { kind: string; actor: unknown; repositoryEvent: { title: string } | null } }[] } }>('{ activityFeed { edges { node { kind actor { id } repositoryEvent { title } } } } }', {}, member)).data!.activityFeed.edges.map((e) => e.node)
    expect(feed.filter((n) => n.kind === 'REPOSITORY')).toEqual([
      { kind: 'REPOSITORY', actor: null, repositoryEvent: { title: 'Heap sort' } },
      { kind: 'REPOSITORY', actor: null, repositoryEvent: { title: 'Add a min-heap' } },
    ])

    // Uninstalled on GitHub: unlinked, and what was kept is gone.
    const gone = randomUUID()
    await deliver('installation', { action: 'deleted', installation: { id: 42 } }, gone)
    await app.handle(gone)
    expect((await repository(groupId, owner))!.app!.connected).toBe(false)
    expect(await db.repositoryEvent.count({ where: { groupId } })).toBe(0)
    expect(await db.gitHubInstallation.count({ where: { id: '42' } })).toBe(0)
  })

  it('allows 60 signed deliveries a minute from one address, then 429 with Retry-After, and still requires the signature', async () => {
    const body = JSON.stringify({ zen: 'rate-limit' })
    const signature = `sha256=${createHmac('sha256', SECRET).update(body).digest('hex')}`
    const send = (ip: string, sig = signature) =>
      request(t.app.getHttpServer())
        .post('/webhooks/github')
        .set('content-type', 'application/json')
        .set('x-forwarded-for', ip)
        .set('x-github-event', 'ping')
        .set('x-github-delivery', randomUUID())
        .set('x-hub-signature-256', sig)
        .send(body)
    const ip = '203.0.113.60'
    for (let sent = 0; sent < 60; sent += 20) {
      const answers = await Promise.all(Array.from({ length: 20 }, () => send(ip)))
      expect(answers.every((a) => a.status === 202)).toBe(true)
    }
    const before = await db.gitHubDelivery.count()
    const refused = await send(ip)
    expect(refused.status).toBe(429)
    expect(Number(refused.headers['retry-after'])).toBeGreaterThan(0)
    expect(refused.body.error).toMatch(/webhook/)
    expect(await db.gitHubDelivery.count()).toBe(before)
    expect((await send(ip, 'sha256=00')).status).toBe(401)
    expect((await send('198.51.100.60')).status).toBe(202)
  }, 60_000)
})
