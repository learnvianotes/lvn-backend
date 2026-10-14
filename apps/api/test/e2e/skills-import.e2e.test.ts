import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { PrismaService } from '@lvn-backend/prisma-base'
import { startFakeOllama, type FakeOllama } from '@lvn-backend/testing'
import { SkillsImportService } from '@lvn-backend/users'
import { createTestApp, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'

/**
 * Skills import (ADR-0077): a verified teacher proves a GitHub account (a code in the bio or a gist) or a page (a meta
 * tag; robots.txt obeyed); the import brings GitHub's projects as they are and skills read by AI, as drafts the teacher
 * publishes or discards; a manual save keeps imported items; a lost proof hides them; removal deletes them; applicants
 * and students may not import; the export carries the tab.
 */
describe('skills import', () => {
  let t: TestApp
  let db: PrismaService
  let ollama: FakeOllama
  let server: Server
  let base: string
  // A second site (another origin) whose robots.txt keeps LearnViaNotes out.
  let closed: Server
  let closedBase: string
  const site = { bio: '', gists: [] as { description: string }[], page: '' }
  type Person = { id: string; handle: string; token: string }

  beforeAll(async () => {
    server = createServer((req, res) => {
      const json = (body: unknown, status = 200) => res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body))
      const url = req.url ?? ''
      if (url === '/gh/users/asha-rao') return json({ login: 'asha-rao', name: 'Asha Rao', bio: site.bio, company: 'IIT Madras', blog: null, html_url: 'https://github.com/asha-rao' })
      if (url.startsWith('/gh/users/asha-rao/gists')) return json(site.gists)
      if (url.startsWith('/gh/users/asha-rao/repos'))
        return json([
          { name: 'tiny-os', description: 'A teaching operating system', language: 'C', topics: ['os'], stargazers_count: 120, pushed_at: '2026-09-01T00:00:00Z', fork: false, html_url: 'https://github.com/asha-rao/tiny-os' },
          { name: 'someone-elses', description: 'A fork', language: 'Go', stargazers_count: 999, pushed_at: '2026-09-02T00:00:00Z', fork: true, html_url: 'https://github.com/asha-rao/someone-elses' },
          { name: 'compiler-notes', description: null, language: 'OCaml', stargazers_count: 5, pushed_at: '2026-08-01T00:00:00Z', fork: false, html_url: 'https://github.com/asha-rao/compiler-notes' },
        ])
      if (url.startsWith('/gh/users/')) return json({ message: 'Not Found' }, 404)
      if (url === '/robots.txt') return res.writeHead(200, { 'content-type': 'text/plain' }).end('User-agent: *\nDisallow: /private\n')
      if (url === '/~asha') return res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(site.page)
      res.writeHead(404).end()
    })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    closed = createServer((req, res) => {
      if (req.url === '/robots.txt') return res.writeHead(200, { 'content-type': 'text/plain' }).end('User-agent: LearnViaNotes\nDisallow: /~asha\n\nUser-agent: *\nDisallow:\n')
      res.writeHead(200, { 'content-type': 'text/html' }).end(site.page)
    })
    await new Promise<void>((r) => closed.listen(0, '127.0.0.1', r))
    closedBase = `http://127.0.0.1:${(closed.address() as AddressInfo).port}`
    ollama = await startFakeOllama()
    t = await createTestApp({ GITHUB_API_URL: `${base}/gh`, SAFE_FETCH_ALLOW_HOSTS: '127.0.0.1', AI_PROVIDER: 'ollama', OLLAMA_URL: ollama.url, AI_CHAT_MODEL: 'gemma4', AI_EMBED_MODEL: 'embeddinggemma' })
    db = t.app.get(PrismaService)
  })
  afterAll(async () => {
    await t?.close()
    await ollama?.stop()
    await new Promise<void>((r) => server.close(() => r()))
    await new Promise<void>((r) => closed.close(() => r()))
  })

  const person = async (role: 'STUDENT' | 'TEACHER' = 'TEACHER'): Promise<Person> => {
    const u = await seedUser(t.app, { verified: true, globalRole: role })
    return { id: u.id, handle: u.handle, token: tokenFor(t.config, u.id, undefined, [role]) }
  }
  const gql = async <T>(query: string, variables: object, who: Person) => t.gql<T>(query, variables as Record<string, unknown>, who.token)
  const IDENTITY = 'identity { id kind value code instructions verified lastError fetchedAt } userErrors { message }'
  const add = async (who: Person, kind: string, value: string) => {
    const res = await gql<{ addExternalIdentity: { identity: { id: string; code: string; value: string; instructions: string; verified: boolean } | null; userErrors: { message: string }[] } }>(`mutation ($input: AddExternalIdentityInput!) { addExternalIdentity(input: $input) { ${IDENTITY} } }`, { input: { kind, value } }, who)
    // A refusal (not a teacher) is the request's error; a bad value is a user error.
    return res.data?.addExternalIdentity ?? { identity: null, userErrors: res.errors ?? [] }
  }
  const check = async (who: Person, identityId: string) => {
    const res = await gql<{ checkExternalIdentity: { identity: { verified: boolean; lastError: string | null } | null; userErrors: { message: string }[] } }>(`mutation ($input: ExternalIdentityIdInput!) { checkExternalIdentity(input: $input) { ${IDENTITY} } }`, { input: { identityId } }, who)
    return res.data?.checkExternalIdentity ?? { identity: null, userErrors: res.errors ?? [] }
  }
  const tab = async (owner: Person, viewer: Person) =>
    (await gql<{ userByHandle: { teacherProfile: { skills: { id: string; kind: string; name: string; source: string; sourceUrl: string | null; fetchedAt: string | null }[]; drafts: { id: string; kind: string; name: string; detail: string | null; source: string; sourceUrl: string | null }[] | null } | null } }>('query ($h: String!) { userByHandle(handle: $h) { teacherProfile { skills { id kind name source sourceUrl fetchedAt } drafts { id kind name detail source sourceUrl } } } }', { h: owner.handle }, viewer)).data!.userByHandle.teacherProfile!
  const publish = (who: Person, skillIds: string[]) => gql<{ publishTeacherSkills: { userErrors: { message: string }[] } }>('mutation ($input: TeacherSkillIdsInput!) { publishTeacherSkills(input: $input) { userErrors { message } } }', { input: { skillIds } }, who)
  const importNow = (identityId: string) => t.app.get(SkillsImportService).import(identityId)

  it('a teacher proves a GitHub account and reviews its projects and the skills AI read, as drafts', async () => {
    const asha = await person()
    const student = await person('STUDENT')
    const sources = (await gql<{ mySkillsImport: { allowed: boolean; sources: string[] } }>('{ mySkillsImport { allowed sources } }', {}, asha)).data!.mySkillsImport
    expect(sources).toEqual({ allowed: true, sources: ['GITHUB', 'WEBSITE'] })
    const claimed = await add(asha, 'GITHUB', 'https://github.com/Asha-Rao')
    expect(claimed.identity).toMatchObject({ value: 'asha-rao', verified: false })
    expect(claimed.identity!.code).toMatch(/^lvn-[a-z2-9]{10}$/)
    expect(claimed.identity!.instructions).toContain(claimed.identity!.code)
    const id = claimed.identity!.id

    // Not proven yet; then the code in a gist's description proves it.
    expect((await check(asha, id)).identity).toMatchObject({ verified: false, lastError: `${claimed.identity!.code} is not in the GitHub profile's bio or a public gist's description yet.` })
    site.gists = [{ description: `LearnViaNotes ${claimed.identity!.code}` }]
    expect((await check(asha, id)).identity).toMatchObject({ verified: true, lastError: null })

    ollama.answer = () => JSON.stringify({ items: [{ kind: 'SKILL', name: 'C' }, { kind: 'SKILL', name: 'Operating systems', detail: 'teaches with tiny-os' }, { kind: 'QUALIFICATION', name: 'PhD (not from GitHub)' }] })
    await importNow(id)
    const asked = ollama.chats.at(-1)!.messages.map((m) => m.content).join('\n')
    expect(asked).toContain('tiny-os (C): A teaching operating system [os]')
    expect(asked).not.toContain('someone-elses')
    const mine = await tab(asha, asha)
    expect(mine.skills).toEqual([])
    expect(mine.drafts!.map((d) => [d.kind, d.name, d.source]).sort()).toEqual([
      ['PROJECT', 'compiler-notes', 'GITHUB'],
      ['PROJECT', 'tiny-os', 'GITHUB'],
      ['SKILL', 'C', 'GITHUB'],
      ['SKILL', 'Operating systems', 'GITHUB'],
    ])
    expect(mine.drafts!.find((d) => d.name === 'tiny-os')).toMatchObject({ detail: 'A teaching operating system · C', sourceUrl: 'https://github.com/asha-rao/tiny-os' })
    // Drafts are the teacher's alone.
    expect((await tab(asha, student)).drafts).toBeNull()

    // Published ones show to everyone with where they came from; the rest are discarded.
    const tiny = mine.drafts!.find((d) => d.name === 'tiny-os')!.id
    const os = mine.drafts!.find((d) => d.name === 'Operating systems')!.id
    expect((await publish(asha, [tiny, os])).data!.publishTeacherSkills.userErrors).toEqual([])
    await gql('mutation ($input: TeacherSkillIdsInput!) { discardTeacherSkills(input: $input) { userErrors { message } } }', { input: { skillIds: mine.drafts!.filter((d) => ![tiny, os].includes(d.id)).map((d) => d.id) } }, asha)
    const seen = await tab(asha, student)
    expect(seen.skills.map((s) => [s.name, s.source, s.sourceUrl])).toEqual([
      ['tiny-os', 'GITHUB', 'https://github.com/asha-rao/tiny-os'],
      ['Operating systems', 'GITHUB', 'https://github.com/asha-rao'],
    ])
    expect(seen.skills.every((s) => s.fetchedAt)).toBe(true)

    // A manual save keeps them; a new import renews them and brings only what is new.
    await gql('mutation ($input: UpdateTeacherProfileInput!) { updateTeacherProfile(input: $input) { userErrors { message } } }', { input: { headline: 'Systems teacher', skills: [{ kind: 'SKILL', name: 'Teaching by hand' }] } }, asha)
    expect((await tab(asha, student)).skills.map((s) => s.name)).toEqual(['Teaching by hand', 'tiny-os', 'Operating systems'])
    await importNow(id)
    expect((await tab(asha, asha)).drafts!.map((d) => d.name).sort()).toEqual(['C', 'compiler-notes'])

    // The proof gone at the monthly re-check: its items leave the tab, nothing is deleted.
    site.gists = []
    await db.externalIdentity.update({ where: { id }, data: { fetchedAt: new Date(Date.now() - 31 * 86_400_000) } })
    await t.app.get(SkillsImportService).refreshDue()
    expect((await tab(asha, student)).skills.map((s) => s.name)).toEqual(['Teaching by hand'])
    expect(await db.teacherSkill.count({ where: { identityId: id } })).toBe(4)

    // Removed: the identifier and everything from it.
    expect((await gql<{ removeExternalIdentity: { ok: boolean } }>('mutation ($input: ExternalIdentityIdInput!) { removeExternalIdentity(input: $input) { ok } }', { input: { identityId: id } }, asha)).data!.removeExternalIdentity.ok).toBe(true)
    expect(await db.teacherSkill.count({ where: { identityId: id } })).toBe(0)
    expect(await db.teacherSkill.count({ where: { userId: asha.id } })).toBe(1)
  })

  it('a page proves itself with a meta tag, read only where robots.txt allows; AI reads it into items', async () => {
    const asha = await person()
    const claimed = (await add(asha, 'WEBSITE', `${base}/~asha#top`)).identity!
    expect(claimed.value).toBe(`${base}/~asha`)
    site.page = `<html><head><title>Dr. Asha Rao</title><meta name="learnvianotes-verification" content="${claimed.code}"></head><body><h1>Asha Rao</h1><p>PhD, IIT Madras, 2012. Professor of Computer Science.</p></body></html>`
    expect((await check(asha, claimed.id)).identity).toMatchObject({ verified: true, lastError: null })
    // Where robots.txt keeps LearnViaNotes out, the page is not read.
    const elsewhere = (await add(asha, 'WEBSITE', `${closedBase}/~asha`)).identity!
    expect((await check(asha, elsewhere.id)).identity).toMatchObject({ verified: false, lastError: "The site's robots.txt does not let LearnViaNotes read this page." })
    ollama.answer = () => JSON.stringify({ items: [{ kind: 'QUALIFICATION', name: 'PhD', detail: 'IIT Madras, 2012' }, { kind: 'EXPERIENCE', name: 'Professor of Computer Science' }, { kind: 'PUBLICATION', name: '' }] })
    await importNow(claimed.id)
    expect(ollama.chats.at(-1)!.messages.map((m) => m.content).join('\n')).toContain('PhD, IIT Madras, 2012. Professor of Computer Science.')
    expect((await tab(asha, asha)).drafts!.map((d) => [d.kind, d.name, d.detail, d.source, d.sourceUrl]).sort()).toEqual([
      ['EXPERIENCE', 'Professor of Computer Science', null, 'WEBSITE', `${base}/~asha`],
      ['QUALIFICATION', 'PhD', 'IIT Madras, 2012', 'WEBSITE', `${base}/~asha`],
    ])
  })

  it('only verified teachers import; the tab holds at most 60; the export carries it', async () => {
    const student = await person('STUDENT')
    expect((await gql<{ mySkillsImport: { allowed: boolean } }>('{ mySkillsImport { allowed } }', {}, student)).data!.mySkillsImport.allowed).toBe(false)
    expect((await add(student, 'GITHUB', 'asha-rao')).userErrors[0]?.message).toBe('Importing is for verified teachers.')
    const teacher = await person()
    expect((await add(teacher, 'GITHUB', 'not a login!')).userErrors[0]?.message).toBe('That is not a GitHub user name.')
    expect((await add(teacher, 'WEBSITE', 'ftp://example.com')).userErrors[0]?.message).toBe('Use a web address that starts with http:// or https://.')
    const identity = (await add(teacher, 'GITHUB', 'asha-rao')).identity!
    // Someone else's identifier is not found.
    expect((await check(await person(), identity.id)).userErrors[0]?.message).toBe('Identifier not found.')
    // 60 published items at most, counting imported ones.
    await gql('mutation ($input: UpdateTeacherProfileInput!) { updateTeacherProfile(input: $input) { userErrors { message } } }', { input: { skills: Array.from({ length: 59 }, (_, i) => ({ kind: 'SKILL', name: `Skill ${i}` })) } }, teacher)
    await db.externalIdentity.update({ where: { id: identity.id }, data: { verifiedAt: new Date() } })
    ollama.answer = () => JSON.stringify({ items: [] })
    await importNow(identity.id)
    const drafts = (await tab(teacher, teacher)).drafts!
    expect((await publish(teacher, drafts.map((d) => d.id))).data!.publishTeacherSkills.userErrors[0]?.message).toBe('The tab holds at most 60 items: remove some first.')
    expect((await publish(teacher, [drafts[0]!.id])).data!.publishTeacherSkills.userErrors).toEqual([])
    const saved = await gql<{ updateTeacherProfile: { userErrors: { message: string }[] } }>('mutation ($input: UpdateTeacherProfileInput!) { updateTeacherProfile(input: $input) { userErrors { message } } }', { input: { skills: Array.from({ length: 60 }, (_, i) => ({ kind: 'SKILL', name: `Skill ${i}` })) } }, teacher)
    expect(saved.data!.updateTeacherProfile.userErrors[0]?.message).toBe('At most 60 items, 1 of them imported.')
  })
})
