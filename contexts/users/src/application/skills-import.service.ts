import { randomInt } from 'node:crypto'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { Errors } from '@lvn-backend/errors'
import { SKILLS_READER, type ReadSkill, type SkillsReader } from '@lvn-backend/facades'
import { newId, PrismaService, type Prisma } from '@lvn-backend/prisma-base'
import { Queues } from '@lvn-backend/queue'
import { RateLimiter } from '@lvn-backend/redis'
import { InvalidUrlError, normaliseUrl, readMetaTag, readPageMeta, readPageText, RobotsCache, SafeFetcher, SafeFetchError } from '@lvn-backend/safe-fetch'
import { USERS_CONFIG, type UsersConfig } from '../users.config'
import { AuditService } from './audit.service'
import { PolicyService } from './policy.service'
import { TEACHER_PROFILE_LIMITS } from './teacher-profile.service'

export const USERS_SKILLS_QUEUE = 'users.skills'

/** The meta tag a page carries to prove it is the teacher's (ADR-0077). */
export const VERIFICATION_META = 'learnvianotes-verification'
const CODE_LETTERS = 'abcdefghijkmnpqrstuvwxyz23456789'
const LIMITS = { identities: 10, checksPerDay: 10, drafts: 30, projects: 10, text: 12_000, refreshDays: 30, refreshBatch: 50 } as const
const GITHUB_LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/
const DAY = 86_400_000

export type IdentityKind = 'GITHUB' | 'WEBSITE' | 'ORCID' | 'OPENALEX'
type Identity = Prisma.ExternalIdentityGetPayload<object>
type Proof = { ok: true } | { ok: false; reason: string }
type Found = { kind: 'SKILL' | 'QUALIFICATION' | 'EXPERIENCE' | 'PUBLICATION' | 'PROJECT'; name: string; detail: string | null; sourceUrl: string }

type GitHubUser = { login: string; name: string | null; bio: string | null; company: string | null; blog: string | null; html_url: string }
type GitHubRepo = { name: string; description: string | null; language: string | null; topics?: string[]; stargazers_count: number; pushed_at: string | null; fork: boolean; archived?: boolean; html_url: string }
type GitHubGist = { description: string | null }

/** What the teacher does to prove an identifier, in words for the apps (ADR-0077). */
export function instructionsFor(kind: IdentityKind, code: string): string {
  switch (kind) {
    case 'GITHUB':
      return `Add ${code} to your GitHub profile's bio, or to the description of a public gist, then check again. You may take it out once checked, though a monthly re-check looks for it.`
    case 'WEBSITE':
      return `Add <meta name="${VERIFICATION_META}" content="${code}"> to the page's <head>, then check again. Keep it there: the page is checked again every month.`
    default:
      return 'Sign in with this service to prove the identifier is yours.'
  }
}

/**
 * Skills import (ADR-0077): a verified teacher proves a public identifier is theirs (a code in a GitHub bio or gist, a
 * meta tag on a page); a worker job reads its public data, GitHub's projects as they are and the rest through the
 * SKILLS_READER, into drafts the teacher publishes or discards. Proofs are checked again monthly; removing an
 * identifier removes everything from it.
 */
@Injectable()
export class SkillsImportService {
  private readonly log = new Logger('SkillsImport')
  private readonly fetcher: SafeFetcher
  private readonly robots: RobotsCache

  constructor(
    private readonly db: PrismaService,
    private readonly policy: PolicyService,
    private readonly audit: AuditService,
    private readonly limiter: RateLimiter,
    private readonly queues: Queues,
    @Inject(USERS_CONFIG) private readonly config: UsersConfig,
    @Inject(SKILLS_READER) private readonly reader: SkillsReader,
  ) {
    this.fetcher = new SafeFetcher({ userAgent: config.skillsImport.userAgent, allowHosts: config.skillsImport.allowHosts })
    this.robots = new RobotsCache(this.fetcher, 'LearnViaNotes')
  }

  /** The kinds this server can read: GitHub needs its API's address; ORCID and OpenAlex wait for ORCID's client. */
  sources(): IdentityKind[] {
    return [...(this.config.skillsImport.githubApiUrl ? (['GITHUB'] as const) : []), 'WEBSITE']
  }

  /** Whether the person may import: a verified teacher, not suspended. */
  async allowed(userId: string): Promise<boolean> {
    const actor = await this.policy.actor(userId)
    return !!actor && actor.globalRole === 'TEACHER' && !actor.suspended
  }

  list(userId: string): Promise<Identity[]> {
    return this.db.externalIdentity.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } })
  }

  async add(actorId: string, kind: IdentityKind, raw: string): Promise<Identity> {
    await this.requireTeacher(actorId)
    if (!this.sources().includes(kind)) throw Errors.validation('That kind of identifier cannot be imported here.', ['input', 'kind'])
    const value = this.normalise(kind, raw)
    const existing = await this.db.externalIdentity.findUnique({ where: { userId_kind_value: { userId: actorId, kind, value } } })
    if (existing) return existing
    if ((await this.db.externalIdentity.count({ where: { userId: actorId } })) >= LIMITS.identities) throw Errors.validation(`At most ${LIMITS.identities} identifiers.`, ['input'])
    const code = `lvn-${Array.from({ length: 10 }, () => CODE_LETTERS[randomInt(CODE_LETTERS.length)]).join('')}`
    const row = await this.db.externalIdentity.create({ data: { id: newId(), userId: actorId, kind, value, code } })
    await this.audit.record({ actorId, action: 'teacher.identity.add', targetType: 'USER', targetId: actorId, metadata: { kind, value } })
    return row
  }

  /** Checks the proof now; once proven, its public data is imported by the worker. At most 10 checks a day. */
  async check(actorId: string, identityId: string): Promise<Identity> {
    await this.requireTeacher(actorId)
    const identity = await this.mine(actorId, identityId)
    const limit = await this.limiter.hit(`skills:${actorId}`, { max: LIMITS.checksPerDay, windowSeconds: 24 * 3600 })
    if (!limit.allowed) throw Errors.rateLimited(limit.retryAfter, 'You have checked a lot today. Try again tomorrow.')
    const proven = await this.prove(identity)
    const now = new Date()
    const row = await this.db.externalIdentity.update({
      where: { id: identity.id },
      data: proven.ok ? { verifiedAt: identity.verifiedAt ?? now, checkedAt: now, lastError: null } : { verifiedAt: null, checkedAt: now, lastError: proven.reason },
    })
    if (proven.ok) {
      await this.queues.queue(USERS_SKILLS_QUEUE).add('import', { identityId: identity.id }, { jobId: `${identity.id}.${now.getTime()}` })
      if (!identity.verifiedAt) await this.audit.record({ actorId, action: 'teacher.identity.verify', targetType: 'USER', targetId: actorId, metadata: { kind: identity.kind, value: identity.value } })
    }
    return row
  }

  /** The identifier and everything imported from it. */
  async remove(actorId: string, identityId: string): Promise<void> {
    const identity = await this.mine(actorId, identityId)
    await this.db.externalIdentity.delete({ where: { id: identity.id } })
    await this.audit.record({ actorId, action: 'teacher.identity.remove', targetType: 'USER', targetId: actorId, metadata: { kind: identity.kind, value: identity.value } })
  }

  /** Drafts become published, after the tab's items; the tab holds at most 60. */
  async publish(actorId: string, skillIds: string[]): Promise<void> {
    await this.requireTeacher(actorId)
    const drafts = await this.db.teacherSkill.findMany({ where: { id: { in: skillIds }, userId: actorId, status: 'DRAFT' }, orderBy: { createdAt: 'asc' } })
    if (!drafts.length) return
    const published = await this.db.teacherSkill.count({ where: { userId: actorId, status: 'PUBLISHED' } })
    if (published + drafts.length > TEACHER_PROFILE_LIMITS.skills) throw Errors.validation(`The tab holds at most ${TEACHER_PROFILE_LIMITS.skills} items: remove some first.`, ['input', 'skillIds'])
    const last = await this.db.teacherSkill.aggregate({ where: { userId: actorId, status: 'PUBLISHED' }, _max: { position: true } })
    const start = Math.max(last._max.position ?? -1, 999) + 1
    await this.db.$transaction(drafts.map((d, i) => this.db.teacherSkill.update({ where: { id: d.id }, data: { status: 'PUBLISHED', position: start + i } })))
    await this.audit.record({ actorId, action: 'teacher.skills.publish', targetType: 'USER', targetId: actorId, metadata: { count: drafts.length } })
  }

  async discard(actorId: string, skillIds: string[]): Promise<void> {
    await this.db.teacherSkill.deleteMany({ where: { id: { in: skillIds }, userId: actorId, status: 'DRAFT' } })
  }

  /** The worker's job: the public data of a proven identifier, as drafts. */
  async import(identityId: string): Promise<void> {
    const identity = await this.db.externalIdentity.findUnique({ where: { id: identityId } })
    if (!identity?.verifiedAt) return
    let found: Found[]
    let note: string | null = null
    try {
      ;({ found, note } = identity.kind === 'GITHUB' ? await this.fromGitHub(identity.value) : await this.fromWebsite(identity.value))
    } catch (err) {
      const reason = err instanceof SafeFetchError || err instanceof ImportError ? err.message : 'The source could not be read just now; it is tried again next month, or check it again.'
      if (!(err instanceof SafeFetchError || err instanceof ImportError)) this.log.warn(`import ${identity.id}: ${(err as Error).message}`)
      await this.db.externalIdentity.update({ where: { id: identity.id }, data: { lastError: reason } })
      return
    }
    await this.keep(identity, found.slice(0, LIMITS.drafts))
    await this.db.externalIdentity.update({ where: { id: identity.id }, data: { fetchedAt: new Date(), lastError: note } })
  }

  /** Daily: proven identifiers last read over 30 days ago are checked again and read again. */
  async refreshDue(now = new Date()): Promise<number> {
    const due = await this.db.externalIdentity.findMany({
      where: { verifiedAt: { not: null }, kind: { in: this.sources() }, OR: [{ fetchedAt: null }, { fetchedAt: { lt: new Date(now.getTime() - LIMITS.refreshDays * DAY) } }] },
      orderBy: { fetchedAt: { sort: 'asc', nulls: 'first' } },
      take: LIMITS.refreshBatch,
    })
    for (const identity of due) {
      const proven = await this.prove(identity).catch((): Proof => ({ ok: false, reason: 'The proof could not be checked just now.' }))
      if (!proven.ok) {
        // The proof is gone: its items leave the tab until it is proven again; nothing is deleted.
        await this.db.externalIdentity.update({ where: { id: identity.id }, data: { verifiedAt: null, checkedAt: now, lastError: proven.reason } })
        continue
      }
      await this.db.externalIdentity.update({ where: { id: identity.id }, data: { checkedAt: now } })
      await this.import(identity.id)
    }
    return due.length
  }

  // ── Proofs ──

  async prove(identity: Identity): Promise<Proof> {
    if (identity.kind === 'GITHUB') {
      const user = await this.github<GitHubUser>(`/users/${identity.value}`).catch((e: Error) => e)
      if (user instanceof Error) return { ok: false, reason: user.message }
      if (user.bio?.includes(identity.code)) return { ok: true }
      const gists = await this.github<GitHubGist[]>(`/users/${identity.value}/gists?per_page=30`).catch(() => [] as GitHubGist[])
      return gists.some((g) => g.description?.includes(identity.code)) ? { ok: true } : { ok: false, reason: `${identity.code} is not in the GitHub profile's bio or a public gist's description yet.` }
    }
    if (identity.kind === 'WEBSITE') {
      try {
        const html = await this.page(identity.value)
        return readMetaTag(html, VERIFICATION_META) === identity.code ? { ok: true } : { ok: false, reason: `The page has no ${VERIFICATION_META} meta tag with ${identity.code} in its head yet.` }
      } catch (err) {
        return { ok: false, reason: err instanceof SafeFetchError || err instanceof ImportError ? err.message : 'The page could not be read.' }
      }
    }
    return { ok: false, reason: 'This kind of identifier cannot be checked here.' }
  }

  // ── Sources ──

  /** GitHub: the most starred own repositories as projects, as GitHub gives them; skills read from the bio and repositories. */
  private async fromGitHub(login: string): Promise<{ found: Found[]; note: string | null }> {
    const user = await this.github<GitHubUser>(`/users/${login}`)
    const repos = (await this.github<GitHubRepo[]>(`/users/${login}/repos?type=owner&sort=updated&per_page=30`)).filter((r) => !r.fork && !r.archived)
    const projects: Found[] = [...repos]
      .sort((a, b) => b.stargazers_count - a.stargazers_count || (b.pushed_at ?? '').localeCompare(a.pushed_at ?? ''))
      .slice(0, LIMITS.projects)
      .map((r) => ({ kind: 'PROJECT', name: r.name.slice(0, 120), detail: [r.description?.trim(), r.language].filter(Boolean).join(' · ').slice(0, 500) || null, sourceUrl: r.html_url }))
    if (!(await this.reader.available())) return { found: projects, note: 'AI is not set up here yet, so skills were not read; projects were imported.' }
    const text = [
      `Name: ${user.name ?? user.login}`,
      user.bio ? `Bio: ${user.bio}` : null,
      user.company ? `Company: ${user.company}` : null,
      'Repositories:',
      ...repos.map((r) => `- ${r.name}${r.language ? ` (${r.language})` : ''}${r.description ? `: ${r.description}` : ''}${r.topics?.length ? ` [${r.topics.join(', ')}]` : ''}`),
    ]
      .filter(Boolean)
      .join('\n')
      .slice(0, LIMITS.text)
    const read = await this.reader.read('a GitHub profile', text)
    const skills: Found[] = read.filter((i) => i.kind === 'SKILL').map((i) => ({ ...i, sourceUrl: user.html_url }))
    return { found: [...projects, ...skills], note: null }
  }

  /** A personal or faculty page: what it says, read into items. */
  private async fromWebsite(url: string): Promise<{ found: Found[]; note: string | null }> {
    if (!(await this.reader.available())) return { found: [], note: 'AI is not set up here yet, so the page could not be read into items.' }
    const html = await this.page(url)
    const meta = readPageMeta(html, url)
    const text = [meta.title, meta.description, readPageText(html.slice(Math.max(html.search(/<body\b/i), 0)), LIMITS.text)].filter(Boolean).join('\n').slice(0, LIMITS.text)
    const read: ReadSkill[] = await this.reader.read('a personal or faculty page', text)
    return { found: read.map((i) => ({ ...i, sourceUrl: url })), note: null }
  }

  /** New drafts in place of the identifier's old ones; a published item with the same kind and name is only renewed. */
  private async keep(identity: Identity, found: Found[]): Promise<void> {
    const now = new Date()
    const source = identity.kind as 'GITHUB' | 'WEBSITE'
    const published = await this.db.teacherSkill.findMany({ where: { identityId: identity.id, status: 'PUBLISHED' }, select: { id: true, kind: true, name: true } })
    const key = (kind: string, name: string) => `${kind}:${name.toLowerCase()}`
    const shown = new Map(published.map((p) => [key(p.kind, p.name), p.id]))
    const renewed = found.flatMap((f) => shown.get(key(f.kind, f.name)) ?? [])
    const fresh = found.filter((f) => !shown.has(key(f.kind, f.name)))
    await this.db.$transaction([
      this.db.teacherSkill.deleteMany({ where: { identityId: identity.id, status: 'DRAFT' } }),
      this.db.teacherSkill.updateMany({ where: { id: { in: renewed } }, data: { fetchedAt: now } }),
      this.db.teacherSkill.createMany({
        data: fresh.map((f, i) => ({ id: newId(), userId: identity.userId, kind: f.kind, name: f.name, detail: f.detail, position: i, source, status: 'DRAFT' as const, sourceUrl: f.sourceUrl, fetchedAt: now, identityId: identity.id })),
      }),
    ])
  }

  // ── Helpers ──

  /** GitHub's REST API, a fixed host: JSON, 5 seconds; with the token when one is configured, for its larger allowance. */
  private async github<T>(path: string): Promise<T> {
    const base = this.config.skillsImport.githubApiUrl
    if (!base) throw new ImportError('GitHub is not set up here.')
    const res = await fetch(`${base.replace(/\/$/, '')}${path}`, {
      headers: { accept: 'application/vnd.github+json', 'user-agent': this.config.skillsImport.userAgent, ...(this.config.skillsImport.githubToken ? { authorization: `Bearer ${this.config.skillsImport.githubToken}` } : {}) },
      signal: AbortSignal.timeout(5_000),
    }).catch(() => null)
    if (!res) throw new ImportError('GitHub could not be reached just now.')
    if (res.status === 404) throw new ImportError('GitHub has no account by that name.')
    if (res.status === 403 || res.status === 429) throw new ImportError('GitHub is limiting how often it is asked; try again in an hour.')
    if (!res.ok) throw new ImportError(`GitHub answered ${res.status}.`)
    return (await res.json()) as T
  }

  /** A page through the safe fetcher, when its robots.txt lets LearnViaNotes read it. */
  private async page(url: string): Promise<string> {
    if (!(await this.robots.allows(url))) throw new ImportError("The site's robots.txt does not let LearnViaNotes read this page.")
    const res = await this.fetcher.fetch({ url, accept: 'text/html,application/xhtml+xml', maxBytes: 1024 * 1024, types: /^(text\/html|application\/xhtml\+xml)$/ })
    return res.body.toString('utf8')
  }

  private normalise(kind: IdentityKind, raw: string): string {
    const v = raw.trim()
    if (kind === 'GITHUB') {
      const login = v.replace(/^@/, '').replace(/^https?:\/\/(www\.)?github\.com\//i, '').replace(/\/.*$/, '')
      if (!GITHUB_LOGIN.test(login)) throw Errors.validation('That is not a GitHub user name.', ['input', 'value'])
      return login.toLowerCase()
    }
    try {
      return normaliseUrl(v)
    } catch (err) {
      throw Errors.validation(err instanceof InvalidUrlError ? err.message : 'That is not a web address.', ['input', 'value'])
    }
  }

  private async mine(actorId: string, identityId: string): Promise<Identity> {
    const identity = await this.db.externalIdentity.findFirst({ where: { id: identityId, userId: actorId } })
    if (!identity) throw Errors.notFound('Identifier not found.')
    return identity
  }

  private async requireTeacher(actorId: string): Promise<void> {
    const actor = await this.policy.actor(actorId)
    if (!actor || actor.globalRole !== 'TEACHER') throw Errors.forbidden('Importing is for verified teachers.')
    if (actor.suspended) throw Errors.forbidden('Your account is suspended.')
  }
}

/** Why an import or proof did not work, in words for the teacher. */
class ImportError extends Error {}
