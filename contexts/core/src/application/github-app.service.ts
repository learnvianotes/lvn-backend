import { createHmac, createSign, timingSafeEqual } from 'node:crypto'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { Action, can } from '@lvn/contracts/domain'
import { Errors } from '@lvn-backend/errors'
import { newId, Prisma, PrismaService } from '@lvn-backend/prisma-base'
import { Queues } from '@lvn-backend/queue'
import { CORE_CONFIG, type CoreConfig } from '../core.config'
import { GroupsService } from './groups.service'

export const CORE_GITHUB_QUEUE = 'core.github'
const STATE_TTL_MS = 3_600_000
const KEEP_DELIVERIES_DAYS = 30
const COMMITS_PER_PUSH = 20

type App = NonNullable<CoreConfig['githubApp']>
type Payload = Record<string, unknown>
type Repo = { full_name?: string }
type Event = { kind: 'PUSH' | 'PULL_REQUEST' | 'ISSUE'; action: string; title: string; number: number | null; authorLogin: string | null; url: string; at: Date }

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)

/**
 * Repository activity from a GitHub App (ADR-0078), off until the owner configures one. A workspace admin installs it
 * and confirms with their own GitHub token that they made the installation and that it covers the workspace's
 * repository; deliveries are checked by signature, stored once and handled by the worker into commits, pull requests
 * and issues for the workspace's members. Never code: titles, logins, links and times.
 */
@Injectable()
export class GitHubAppService {
  private readonly log = new Logger('GitHubApp')

  constructor(
    private readonly db: PrismaService,
    private readonly groups: GroupsService,
    private readonly queues: Queues,
    @Inject(CORE_CONFIG) private readonly config: CoreConfig,
  ) {}

  configured(): boolean {
    return this.config.githubApp !== null
  }

  // ── Connecting ──

  /** The App's install link for a workspace, its state signed with the group's id and the time; null when off. */
  installUrl(groupId: string, now = Date.now()): string | null {
    const app = this.config.githubApp
    if (!app) return null
    return `${app.webUrl}/apps/${app.slug}/installations/new?state=${encodeURIComponent(this.state(groupId, now))}`
  }

  async connect(actorId: string, state: string, installationId: string, code: string): Promise<string> {
    const app = this.app()
    const groupId = this.groupOf(state)
    const repo = await this.managedGitHubRepository(actorId, groupId)
    if (!/^\d{1,20}$/.test(installationId)) throw Errors.validation('That is not a GitHub installation.', ['input', 'installationId'])
    // Who installed it: GitHub lists the installation among the user's own (the redirect's id alone can be forged).
    const userToken = await this.userToken(app, code)
    const mine = await this.github<{ installations: { id: number; account: { login: string } | null }[] }>(app, '/user/installations?per_page=100', userToken)
    const found = mine.installations.find((i) => String(i.id) === installationId)
    if (!found) throw Errors.forbidden('That GitHub installation is not one you made.')
    // What it covers: the workspace's repository must be among the installation's.
    const token = await this.installationToken(app, installationId)
    const covered = await this.github<{ repositories: Repo[] }>(app, '/installation/repositories?per_page=100', token)
    if (!covered.repositories.some((r) => r.full_name?.toLowerCase() === repo.path.toLowerCase())) throw Errors.validation(`The App is not installed on ${repo.path}: add the repository to it on GitHub, then connect again.`, ['input', 'installationId'])
    await this.db.gitHubInstallation.upsert({ where: { id: installationId }, create: { id: installationId, accountLogin: found.account?.login ?? '', createdById: actorId }, update: { accountLogin: found.account?.login ?? '' } })
    await this.db.groupRepository.update({ where: { groupId }, data: { installationId } })
    return groupId
  }

  async disconnect(actorId: string, groupId: string): Promise<void> {
    await this.managedGitHubRepository(actorId, groupId)
    await this.unlink([groupId])
  }

  // ── Deliveries ──

  /** A webhook delivery: checked by its signature, stored once, handled by the worker. */
  async receive(headers: Record<string, string | string[] | undefined>, body: Buffer | undefined): Promise<'accepted' | 'duplicate'> {
    const app = this.config.githubApp
    if (!app) throw Errors.notFound('Not found.')
    const header = (name: string) => {
      const v = headers[name]
      return Array.isArray(v) ? v[0] : v
    }
    const signature = header('x-hub-signature-256') ?? ''
    const expected = `sha256=${createHmac('sha256', app.webhookSecret)
      .update(body ?? Buffer.alloc(0))
      .digest('hex')}`
    const a = Buffer.from(signature)
    const b = Buffer.from(expected)
    if (!body || a.length !== b.length || !timingSafeEqual(a, b)) throw Errors.unauthenticated('The signature does not match.')
    const id = header('x-github-delivery')
    const event = header('x-github-event')
    if (!id || !event) throw Errors.validation('A delivery needs its id and event.', ['headers'])
    let payload: Payload
    try {
      payload = JSON.parse(body.toString('utf8')) as Payload
    } catch {
      throw Errors.validation('The delivery is not JSON.', ['body'])
    }
    try {
      await this.db.gitHubDelivery.create({ data: { id, event, payload: payload as Prisma.InputJsonValue } })
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return 'duplicate'
      throw err
    }
    await this.queues.queue(CORE_GITHUB_QUEUE).add('handle', { deliveryId: id }, { jobId: `delivery.${id}` })
    return 'accepted'
  }

  /** The worker's job: a delivery into repository events, or an installation's end. */
  async handle(deliveryId: string): Promise<number> {
    const delivery = await this.db.gitHubDelivery.findUnique({ where: { id: deliveryId } })
    if (!delivery || delivery.handledAt) return 0
    const p = delivery.payload as Payload
    const installationId = String((p.installation as { id?: number } | undefined)?.id ?? '')
    let made = 0
    if (delivery.event === 'installation' && p.action === 'deleted' && installationId) {
      const linked = await this.db.groupRepository.findMany({ where: { installationId }, select: { groupId: true } })
      await this.unlink(linked.map((l) => l.groupId))
      await this.db.gitHubInstallation.deleteMany({ where: { id: installationId } })
    } else if (delivery.event === 'installation_repositories' && p.action === 'removed' && installationId) {
      const names = ((p.repositories_removed as Repo[] | undefined) ?? []).map((r) => r.full_name?.toLowerCase()).filter((n): n is string => !!n)
      const linked = await this.db.groupRepository.findMany({ where: { installationId }, select: { groupId: true, path: true } })
      await this.unlink(linked.filter((l) => names.includes(l.path.toLowerCase())).map((l) => l.groupId))
    } else if (installationId) {
      const repo = str((p.repository as Repo | undefined)?.full_name)?.toLowerCase()
      const events = repo ? this.eventsOf(delivery.event, p) : []
      if (repo && events.length) {
        const groups = (await this.db.groupRepository.findMany({ where: { installationId }, select: { groupId: true, path: true } })).filter((g) => g.path.toLowerCase() === repo)
        const rows = groups.flatMap((g) => events.map((e) => ({ id: newId(), groupId: g.groupId, ...e, deliveryId })))
        if (rows.length) await this.db.repositoryEvent.createMany({ data: rows })
        made = rows.length
      }
    }
    await this.db.gitHubDelivery.update({ where: { id: deliveryId }, data: { handledAt: new Date() } })
    return made
  }

  /** Deliveries older than 30 days are only needed to drop repeats, and GitHub never redelivers on its own. */
  async purgeDeliveries(now = new Date()): Promise<number> {
    return (await this.db.gitHubDelivery.deleteMany({ where: { receivedAt: { lt: new Date(now.getTime() - KEEP_DELIVERIES_DAYS * 86_400_000) } } })).count
  }

  /** A workspace's repository activity, newest first: members only, null for anyone else. */
  async events(viewerId: string | null, groupId: string, first: number) {
    if (!viewerId) return null
    const view = await this.groups.view(viewerId, groupId).catch(() => null)
    if (!view?.role) return null
    return this.db.repositoryEvent.findMany({ where: { groupId }, orderBy: [{ at: 'desc' }, { id: 'desc' }], take: Math.min(Math.max(first, 1), 50) })
  }

  // ── Helpers ──

  private eventsOf(event: string, p: Payload): Event[] {
    if (event === 'push') {
      const commits = (p.commits as { message?: string; url?: string; timestamp?: string; author?: { username?: string; name?: string } }[] | undefined) ?? []
      return commits.slice(-COMMITS_PER_PUSH).flatMap((c) => {
        const title = c.message?.split('\n')[0]?.trim().slice(0, 200)
        return title && c.url ? [{ kind: 'PUSH' as const, action: 'pushed', title, number: null, authorLogin: c.author?.username ?? c.author?.name ?? null, url: c.url, at: new Date(c.timestamp ?? Date.now()) }] : []
      })
    }
    if (event === 'pull_request' || event === 'issues') {
      const item = (event === 'pull_request' ? p.pull_request : p.issue) as { title?: string; number?: number; html_url?: string; updated_at?: string; merged?: boolean; pull_request?: unknown; user?: { login?: string } } | undefined
      if (!item?.title || !item.html_url || (event === 'issues' && item.pull_request)) return []
      const action = p.action === 'closed' && item.merged ? 'merged' : str(p.action)
      if (!action || !['opened', 'closed', 'reopened', 'merged'].includes(action)) return []
      return [{ kind: event === 'pull_request' ? 'PULL_REQUEST' : 'ISSUE', action, title: item.title.slice(0, 200), number: item.number ?? null, authorLogin: item.user?.login ?? null, url: item.html_url, at: new Date(item.updated_at ?? Date.now()) }]
    }
    return []
  }

  private async unlink(groupIds: string[]): Promise<void> {
    if (!groupIds.length) return
    await this.db.$transaction([this.db.groupRepository.updateMany({ where: { groupId: { in: groupIds } }, data: { installationId: null } }), this.db.repositoryEvent.deleteMany({ where: { groupId: { in: groupIds } } })])
  }

  private async managedGitHubRepository(actorId: string, groupId: string) {
    const { group, resource, actor } = await this.groups.require(actorId, groupId)
    if (!can(actor, Action.GROUP_MANAGE, resource)) throw Errors.forbidden('Only the workspace’s admins connect its repository.')
    const repo = group.type === 'PROJECT' ? await this.db.groupRepository.findUnique({ where: { groupId } }) : null
    if (!repo || repo.provider !== 'GITHUB') throw Errors.validation('Link a GitHub repository to the workspace first.', ['input'])
    return repo
  }

  private app(): App {
    if (!this.config.githubApp) throw Errors.notFound('The GitHub App is not set up here.')
    return this.config.githubApp
  }

  private state(groupId: string, now: number): string {
    const app = this.app()
    const body = `${groupId}.${now}`
    return `${body}.${createHmac('sha256', app.webhookSecret).update(`state:${body}`).digest('base64url')}`
  }

  private groupOf(state: string, now = Date.now()): string {
    const [groupId, at, sig] = state.split('.')
    const expected = groupId && at ? this.state(groupId, Number(at)).split('.')[2] : undefined
    if (!groupId || !at || !sig || !expected || sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected)) || now - Number(at) > STATE_TTL_MS) throw Errors.validation('That link has expired: start connecting again from the workspace.', ['input', 'state'])
    return groupId
  }

  /** An RS256 JWT for the App itself, valid 9 minutes (GitHub allows at most 10). */
  private appJwt(app: App, now = Math.floor(Date.now() / 1000)): string {
    const part = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
    const body = `${part({ alg: 'RS256', typ: 'JWT' })}.${part({ iat: now - 60, exp: now + 540, iss: app.appId })}`
    return `${body}.${createSign('RSA-SHA256').update(body).sign(app.privateKey, 'base64url')}`
  }

  private async installationToken(app: App, installationId: string): Promise<string> {
    const res = await this.call(app, `/app/installations/${installationId}/access_tokens`, this.appJwt(app), 'POST')
    return (res as { token: string }).token
  }

  private async userToken(app: App, code: string): Promise<string> {
    const res = await fetch(`${app.webUrl}/login/oauth/access_token`, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ client_id: app.clientId, client_secret: app.clientSecret, code }),
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null)
    const json = (res?.ok ? await res.json() : null) as { access_token?: string } | null
    if (!json?.access_token) throw Errors.forbidden('GitHub did not confirm who you are: connect again.')
    return json.access_token
  }

  private github<T>(app: App, path: string, token: string): Promise<T> {
    return this.call(app, path, token, 'GET') as Promise<T>
  }

  private async call(app: App, path: string, token: string, method: 'GET' | 'POST'): Promise<unknown> {
    const res = await fetch(`${app.apiUrl}${path}`, { method, headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${token}`, 'user-agent': 'LearnViaNotes' }, signal: AbortSignal.timeout(10_000) }).catch(() => null)
    if (!res) throw Errors.unavailable('GitHub could not be reached just now.')
    if (!res.ok) {
      this.log.warn(`GitHub ${method} ${path}: ${res.status}`)
      throw res.status === 401 || res.status === 403 || res.status === 404 ? Errors.forbidden('GitHub refused: check the App is installed, then connect again.') : Errors.unavailable('GitHub could not answer just now.')
    }
    return res.json()
  }
}
