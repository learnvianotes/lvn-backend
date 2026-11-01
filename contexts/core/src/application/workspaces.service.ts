import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { Action, can, GlobalRole, GroupRole as Role, verificationBlocks } from '@lvn/contracts/domain'
import { docSchema, docText } from '@lvn/contracts/validation'
import { Errors } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { AUDIT, NOTE_ACCESS, PEOPLE, POLICY, type Audit, type DoubtForAi, type NoteAccess, type People, type Policy } from '@lvn-backend/facades'
import { newId, PrismaService, type Prisma } from '@lvn-backend/prisma-base'
import { RateLimiter } from '@lvn-backend/redis'
import { CORE_CONFIG, type CoreConfig } from '../core.config'
import { GroupsService } from './groups.service'
import { ModerationService } from './moderation.service'

export const WORKSPACE_LIMITS = { title: 200, chars: 20_000, repoRef: 300, doubtsPerHour: 20, answersPerHour: 60, invitesPerDay: 50, inviteDays: 14, ideas: 200 } as const
const DAY_MS = 86_400_000

export type DoubtRow = Prisma.DoubtGetPayload<object>
export type RepositoryRow = Prisma.GroupRepositoryGetPayload<object>
export interface RepositoryDetails {
  name: string
  description: string | null
  language: string | null
  stars: number
  pushedAt: string | null
}

/** A repository address LVN accepts (ADR-0048): a GitHub repository or a GitLab project, by its web address. */
export function parseRepository(url: string): { provider: 'GITHUB' | 'GITLAB'; path: string; url: string } | null {
  let u: URL
  try {
    u = new URL(url.trim())
  } catch {
    return null
  }
  if (u.protocol !== 'https:') return null
  const parts = u.pathname.replace(/\.git$/, '').split('/').filter(Boolean)
  const safe = parts.every((p) => /^[A-Za-z0-9_.-]+$/.test(p) && p !== '.' && p !== '..')
  if (!safe) return null
  if (u.hostname === 'github.com' && parts.length === 2) return { provider: 'GITHUB', path: parts.join('/'), url: `https://github.com/${parts.join('/')}` }
  if (u.hostname === 'gitlab.com' && parts.length >= 2 && !parts.includes('-')) return { provider: 'GITLAB', path: parts.join('/'), url: `https://gitlab.com/${parts.join('/')}` }
  return null
}

/**
 * Project workspaces (ADR-0015, ADR-0048): a group of type PROJECT with a repository card, an ideas board, doubts for
 * the mentor, mentors by invitation, and a showcase note that credits the team.
 */
@Injectable()
export class WorkspacesService implements OnModuleInit {
  private readonly log = new Logger('Workspaces')

  constructor(
    private readonly db: PrismaService,
    private readonly limiter: RateLimiter,
    private readonly groups: GroupsService,
    private readonly moderation: ModerationService,
    @Inject(NOTE_ACCESS) private readonly notes: NoteAccess,
    @Inject(PEOPLE) private readonly people: People,
    @Inject(POLICY) private readonly policy: Policy,
    @Inject(AUDIT) private readonly audit: Audit,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(CORE_CONFIG) private readonly config: CoreConfig,
  ) {}

  onModuleInit(): void {
    // The showcase credits whoever is on the team now (ADR-0048).
    this.events.subscribe('GroupMembershipChanged', async ({ payload }) => {
      const group = await this.db.group.findUnique({ where: { id: payload.groupId }, select: { type: true, showcaseNoteId: true } })
      if (group?.type === 'PROJECT' && group.showcaseNoteId) await this.publishContributors(payload.groupId)
    })
  }

  /** The workspace for an action, or NOT_FOUND; VALIDATION when it is an ordinary group. */
  private async workspace(actorId: string, groupId: string) {
    const loaded = await this.groups.require(actorId, groupId)
    if (loaded.group.type !== 'PROJECT') throw Errors.validation('This is not a project workspace.')
    return loaded
  }

  private doc(raw: unknown, what: string) {
    const parsed = docSchema.safeParse(raw)
    if (!parsed.success) throw Errors.validation(`This ${what} could not be read.`, ['input', 'body'])
    const text = docText(parsed.data).trim()
    if (!text) throw Errors.validation('Write something first.', ['input', 'body'])
    if (text.length > WORKSPACE_LIMITS.chars) throw Errors.validation(`Keep it to ${WORKSPACE_LIMITS.chars} characters.`, ['input', 'body'])
    return { doc: parsed.data as Prisma.InputJsonValue, text }
  }

  private screen(text: string, what: string) {
    const verdict = this.moderation.check(text)
    if (verdict.flagged) throw Errors.validation(`This ${what} can't be posted: ${verdict.message}`, ['input', 'body'])
  }

  private async notMuted(groupId: string, userId: string) {
    const m = await this.db.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } }, select: { mutedUntil: true } })
    if (m?.mutedUntil && m.mutedUntil > new Date()) throw Errors.forbidden('You are muted in this group for now.')
  }

  // ── Repository ───────────────────────────────────────────────────────────────────────────────────────────────

  async repository(groupId: string): Promise<RepositoryRow | null> {
    return this.db.groupRepository.findUnique({ where: { groupId } })
  }

  async setRepository(actorId: string, groupId: string, url: string | null): Promise<string> {
    const { resource, actor } = await this.workspace(actorId, groupId)
    if (!can(actor, Action.GROUP_MANAGE, resource)) throw Errors.forbidden('Only the workspace’s admins link its repository.')
    if (!url?.trim()) {
      await this.db.groupRepository.deleteMany({ where: { groupId } })
      return groupId
    }
    const repo = parseRepository(url)
    if (!repo) throw Errors.validation('Link a repository on github.com or gitlab.com, like https://github.com/owner/project.', ['input', 'url'])
    await this.db.groupRepository.upsert({
      where: { groupId },
      create: { groupId, ...repo },
      update: { ...repo, available: false, metadata: undefined, refreshedAt: null },
    })
    await this.audit.record({ actorId, action: 'group.repository', targetType: 'GROUP', targetId: groupId, metadata: { url: repo.url } })
    await this.refresh(groupId)
    return groupId
  }

  /** Public details from the provider's API, when it is configured and shows the repository; the link otherwise. */
  async refresh(groupId: string): Promise<void> {
    const repo = await this.db.groupRepository.findUnique({ where: { groupId } })
    if (!repo) return
    let details: RepositoryDetails | null = null
    try {
      details = await this.fetchDetails(repo.provider, repo.path)
    } catch (err) {
      // A provider that does not answer leaves the card as it was; the nightly refresh tries again.
      this.log.warn(`repository ${repo.url}: ${err instanceof Error ? err.message : String(err)}`)
      return
    }
    await this.db.groupRepository.update({ where: { groupId }, data: { available: !!details, metadata: details ? (details as unknown as Prisma.InputJsonValue) : undefined, refreshedAt: new Date() } })
  }

  private async fetchDetails(provider: 'GITHUB' | 'GITLAB', path: string): Promise<RepositoryDetails | null> {
    const base = provider === 'GITHUB' ? this.config.repositories.githubApiUrl : this.config.repositories.gitlabApiUrl
    if (!base) return null
    const url = provider === 'GITHUB' ? `${base.replace(/\/$/, '')}/repos/${path}` : `${base.replace(/\/$/, '')}/projects/${encodeURIComponent(path)}`
    const headers: Record<string, string> = { accept: provider === 'GITHUB' ? 'application/vnd.github+json' : 'application/json', 'user-agent': 'LearnViaNotes' }
    if (provider === 'GITHUB' && this.config.repositories.githubToken) headers.authorization = `Bearer ${this.config.repositories.githubToken}`
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(5000) })
    if (res.status === 404 || res.status === 401 || res.status === 403) return null
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const r = (await res.json()) as Record<string, unknown>
    const text = (v: unknown, max: number) => (typeof v === 'string' && v ? v.slice(0, max) : null)
    if (provider === 'GITHUB') {
      if (r.private === true) return null
      return { name: text(r.full_name, 200) ?? path, description: text(r.description, 500), language: text(r.language, 60), stars: Number(r.stargazers_count) || 0, pushedAt: text(r.pushed_at, 40) }
    }
    if (r.visibility !== undefined && r.visibility !== 'public') return null
    return { name: text(r.path_with_namespace, 200) ?? path, description: text(r.description, 500), language: null, stars: Number(r.star_count) || 0, pushedAt: text(r.last_activity_at, 40) }
  }

  /** Nightly (apps/worker): repositories whose details are more than a day old. Returns how many were refreshed. */
  async refreshStale(now = new Date()): Promise<number> {
    const stale = await this.db.groupRepository.findMany({ where: { OR: [{ refreshedAt: null }, { refreshedAt: { lt: new Date(now.getTime() - DAY_MS) } }], group: { deletedAt: null } }, select: { groupId: true }, take: 200 })
    for (const r of stale) await this.refresh(r.groupId)
    return stale.length
  }

  // ── Ideas ────────────────────────────────────────────────────────────────────────────────────────────────────

  /** The ideas board: most reactions first, then newest; blocked people left out (ADR-0016). */
  async ideas(viewerId: string, groupId: string) {
    const { role } = await this.workspace(viewerId, groupId)
    if (!role) throw Errors.forbidden('Join the workspace to see its ideas.')
    const hidden = await this.people.blockedIds(viewerId)
    const rows = await this.db.groupPost.findMany({ where: { groupId, kind: 'IDEA', deletedAt: null, OR: [{ moderation: 'OK' }, { authorId: viewerId }], ...(hidden.length ? { authorId: { notIn: hidden } } : {}) }, orderBy: { createdAt: 'desc' }, take: WORKSPACE_LIMITS.ideas })
    if (!rows.length) return []
    const counts = await this.db.reaction.groupBy({ by: ['targetId'], where: { targetType: 'GROUP_POST', targetId: { in: rows.map((r) => r.id) } }, _count: { _all: true } })
    const score = new Map(counts.map((c) => [c.targetId, c._count._all]))
    return rows.map((r, i) => ({ row: r, score: score.get(r.id) ?? 0, i })).sort((a, b) => b.score - a.score || a.i - b.i).map((x) => x.row)
  }

  // ── Mentors ──────────────────────────────────────────────────────────────────────────────────────────────────

  async inviteMentor(actorId: string, groupId: string, person: string): Promise<string> {
    const { resource, actor } = await this.workspace(actorId, groupId)
    if (!can(actor, Action.GROUP_MANAGE, resource)) throw Errors.forbidden('Only the workspace’s admins invite mentors.')
    const found = await this.people.find(person)
    if (!found) throw Errors.validation('Nobody on LearnViaNotes has that handle or email.', ['input', 'person'])
    if (!can(actor, Action.GROUP_INVITE_MENTOR, { ...resource, inviteeGlobalRole: found.globalRole })) throw Errors.validation('Mentors are teachers. Invite a teacher.', ['input', 'person'])
    if (await this.people.blockedBetween(actorId, found.id)) throw Errors.forbidden("You can't invite that person.")
    if (await this.db.groupMember.count({ where: { groupId, userId: found.id } })) throw Errors.conflict('They are already in this workspace.')
    const open = await this.db.mentorInvite.findFirst({ where: { groupId, teacherId: found.id, acceptedAt: null, declinedAt: null, expiresAt: { gt: new Date() } }, select: { id: true } })
    if (open) return open.id
    const rate = await this.limiter.hit(`core:mentor:invite:${actorId}`, { max: WORKSPACE_LIMITS.invitesPerDay, windowSeconds: 86_400 })
    if (!rate.allowed) throw Errors.rateLimited(rate.retryAfter, 'You have sent a lot of invites today. Try again tomorrow.')
    const id = newId()
    await this.db.mentorInvite.create({ data: { id, groupId, teacherId: found.id, invitedBy: actorId, expiresAt: new Date(Date.now() + WORKSPACE_LIMITS.inviteDays * DAY_MS) } })
    await this.audit.record({ actorId, action: 'group.mentor.invite', targetType: 'GROUP', targetId: groupId, metadata: { teacherId: found.id } })
    await this.events.publish('MentorInvited', { groupId, teacherId: found.id, invitedBy: actorId })
    return id
  }

  async answerMentorInvite(teacherId: string, inviteId: string, accept: boolean): Promise<string> {
    const inv = await this.db.mentorInvite.findFirst({ where: { id: inviteId, teacherId } })
    if (!inv || inv.acceptedAt || inv.declinedAt || inv.expiresAt <= new Date()) throw Errors.notFound('That invite is not there any more.')
    const { resource, actor } = await this.workspace(teacherId, inv.groupId)
    if (!accept) {
      await this.db.mentorInvite.update({ where: { id: inviteId }, data: { declinedAt: new Date() } })
      return inv.groupId
    }
    if (!can(actor, Action.GROUP_ACCEPT_MENTOR_INVITE, resource)) throw Errors.forbidden(verificationBlocks(actor, Action.GROUP_ACCEPT_MENTOR_INVITE, resource) ? 'Verify your account to mentor.' : 'Only teachers mentor workspaces.')
    await this.db.$transaction([
      this.db.mentorInvite.update({ where: { id: inviteId }, data: { acceptedAt: new Date() } }),
      this.db.groupMember.createMany({ data: [{ groupId: inv.groupId, userId: teacherId, role: 'MENTOR' }], skipDuplicates: true }),
    ])
    await this.events.publish('GroupMembershipChanged', { groupId: inv.groupId, userId: teacherId, change: 'JOINED', role: Role.MENTOR })
    return inv.groupId
  }

  async myMentorInvites(teacherId: string) {
    return this.db.mentorInvite.findMany({ where: { teacherId, acceptedAt: null, declinedAt: null, expiresAt: { gt: new Date() }, group: { deletedAt: null } }, include: { group: true }, orderBy: { createdAt: 'desc' } })
  }

  // ── Doubts ───────────────────────────────────────────────────────────────────────────────────────────────────

  async ask(actorId: string, groupId: string, input: { title: string; body: unknown; repoRef?: string | null }): Promise<string> {
    const { resource, actor } = await this.workspace(actorId, groupId)
    if (!can(actor, Action.GROUP_ASK_DOUBT, resource)) throw Errors.forbidden(verificationBlocks(actor, Action.GROUP_ASK_DOUBT, resource) ? 'Verify your account to ask.' : 'The team asks doubts.')
    await this.notMuted(groupId, actorId)
    const title = input.title.replace(/\s+/g, ' ').trim()
    if (title.length < 3) throw Errors.validation('Give the doubt a title of at least 3 characters.', ['input', 'title'])
    if (title.length > WORKSPACE_LIMITS.title) throw Errors.validation(`Keep the title to ${WORKSPACE_LIMITS.title} characters.`, ['input', 'title'])
    const repoRef = input.repoRef?.trim() || null
    if (repoRef && repoRef.length > WORKSPACE_LIMITS.repoRef) throw Errors.validation(`Keep the reference to ${WORKSPACE_LIMITS.repoRef} characters.`, ['input', 'repoRef'])
    const { doc, text } = this.doc(input.body, 'doubt')
    this.screen(`${title}\n${text}`, 'doubt')
    const rate = await this.limiter.hit(`core:doubt:${actorId}`, { max: WORKSPACE_LIMITS.doubtsPerHour, windowSeconds: 3600 })
    if (!rate.allowed) throw Errors.rateLimited(rate.retryAfter, 'You have asked a lot in the last hour. Try again later.')
    const id = newId()
    await this.db.$transaction([
      this.db.doubt.create({ data: { id, groupId, authorId: actorId, title, body: doc, repoRef } }),
      this.db.group.update({ where: { id: groupId }, data: { updatedAt: new Date() } }),
    ])
    const mentors = await this.db.groupMember.findMany({ where: { groupId, role: 'MENTOR' }, select: { userId: true }, take: 50 })
    await this.events.publish('DoubtAsked', { doubtId: id, groupId, askedBy: actorId, mentorIds: mentors.map((m) => m.userId) })
    return id
  }

  /** The doubt with the viewer's place in its workspace; null when they may not see it. */
  async getDoubt(viewerId: string, doubtId: string) {
    const doubt = await this.db.doubt.findFirst({ where: { id: doubtId, deletedAt: null, OR: [{ moderation: 'OK' }, { authorId: viewerId }] } })
    if (!doubt) return null
    const loaded = await this.groups.load(viewerId, doubt.groupId)
    if (!loaded?.role) return null
    if (doubt.authorId !== viewerId && (await this.people.blockedBetween(viewerId, doubt.authorId))) return null
    const actor = await this.groups.actor(viewerId)
    const resource = { ...loaded.resource, isDoubtAuthor: doubt.authorId === viewerId }
    const resolve = can(actor, Action.GROUP_RESOLVE_DOUBT, resource)
    return {
      doubt,
      role: loaded.role,
      can: {
        answer: can(actor, Action.GROUP_ANSWER_DOUBT, resource) && doubt.status !== 'RESOLVED',
        resolve: resolve && doubt.status !== 'RESOLVED',
        reopen: doubt.status === 'RESOLVED' && (doubt.authorId === viewerId || loaded.role === 'MENTOR'),
        delete: doubt.authorId === viewerId || can(actor, Action.GROUP_MODERATE_POSTS, loaded.resource),
      },
    }
  }

  /**
   * The DOUBTS facade (ADR-0060): a doubt and its answers as text for Ask AI on a doubt (ADR-0015), when the viewer may
   * read it (on the workspace's team, or its mentor); else null.
   */
  async forAi(viewerId: string, doubtId: string): Promise<DoubtForAi | null> {
    const found = await this.getDoubt(viewerId, doubtId)
    if (!found) return null
    const answers = await this.db.doubtAnswer.findMany({ where: { doubtId, deletedAt: null }, orderBy: { createdAt: 'asc' }, take: 20, select: { body: true } })
    const text = [found.doubt.body, ...answers.map((a) => a.body)]
      .map((body) => {
        const parsed = docSchema.safeParse(body)
        return parsed.success ? docText(parsed.data).trim() : ''
      })
      .filter(Boolean)
      .join('\n\n')
    return { groupId: found.doubt.groupId, title: found.doubt.title, text }
  }

  private async mustDoubt(viewerId: string, doubtId: string) {
    const found = await this.getDoubt(viewerId, doubtId)
    if (!found) throw Errors.notFound('That doubt is not there any more.')
    return found
  }

  async answer(actorId: string, doubtId: string, body: unknown): Promise<string> {
    const { doubt, role, can: may } = await this.mustDoubt(actorId, doubtId)
    if (doubt.status === 'RESOLVED') throw Errors.validation('This doubt is resolved. Reopen it to answer.')
    if (!may.answer) throw Errors.forbidden('The team and the mentor answer doubts.')
    await this.notMuted(doubt.groupId, actorId)
    const { doc, text } = this.doc(body, 'answer')
    this.screen(text, 'answer')
    const rate = await this.limiter.hit(`core:doubt:answer:${actorId}`, { max: WORKSPACE_LIMITS.answersPerHour, windowSeconds: 3600 })
    if (!rate.allowed) throw Errors.rateLimited(rate.retryAfter, 'You have answered a lot in the last hour. Try again later.')
    const id = newId()
    const byMentor = role === 'MENTOR'
    await this.db.$transaction([
      this.db.doubtAnswer.create({ data: { id, doubtId, authorId: actorId, body: doc, byMentor } }),
      this.db.doubt.update({ where: { id: doubtId }, data: doubt.status === 'OPEN' ? { status: 'ANSWERED' } : { updatedAt: new Date() } }),
    ])
    await this.events.publish('DoubtAnswered', { doubtId, groupId: doubt.groupId, answerId: id, answeredBy: actorId, byMentor, askedBy: doubt.authorId })
    return doubtId
  }

  async resolve(actorId: string, doubtId: string): Promise<string> {
    const { doubt, can: may } = await this.mustDoubt(actorId, doubtId)
    if (doubt.status === 'RESOLVED') return doubtId
    if (!may.resolve) throw Errors.forbidden('The mentor, the workspace’s admins or the asker resolve a doubt.')
    await this.db.doubt.update({ where: { id: doubtId }, data: { status: 'RESOLVED', resolvedById: actorId, resolvedAt: new Date() } })
    await this.events.publish('DoubtResolved', { doubtId, groupId: doubt.groupId, resolvedBy: actorId, askedBy: doubt.authorId })
    return doubtId
  }

  async reopen(actorId: string, doubtId: string): Promise<string> {
    const { doubt, can: may } = await this.mustDoubt(actorId, doubtId)
    if (doubt.status !== 'RESOLVED') return doubtId
    if (!may.reopen) throw Errors.forbidden('The asker or the mentor reopens a doubt.')
    const answered = await this.db.doubtAnswer.count({ where: { doubtId, deletedAt: null } })
    await this.db.doubt.update({ where: { id: doubtId }, data: { status: answered ? 'ANSWERED' : 'OPEN', resolvedById: null, resolvedAt: null } })
    return doubtId
  }

  async deleteDoubt(actorId: string, doubtId: string): Promise<string> {
    const { doubt, can: may } = await this.mustDoubt(actorId, doubtId)
    if (!may.delete) throw Errors.forbidden('Only its asker or a moderator removes a doubt.')
    await this.db.doubt.update({ where: { id: doubtId }, data: { deletedAt: new Date() } })
    if (doubt.authorId !== actorId) await this.audit.record({ actorId, action: 'group.doubt.remove', targetType: 'GROUP', targetId: doubt.groupId, metadata: { doubtId, authorId: doubt.authorId } })
    return doubt.groupId
  }

  /** Doubts for the team and the mentor, newest first; by status when asked. */
  async doubts(viewerId: string, groupId: string, status: 'OPEN' | 'ANSWERED' | 'RESOLVED' | null | undefined, size: number, after: [string, string] | null) {
    const { role } = await this.workspace(viewerId, groupId)
    if (!role) throw Errors.forbidden('Join the workspace to see its doubts.')
    const hidden = await this.people.blockedIds(viewerId)
    return this.db.doubt.findMany({
      where: {
        groupId,
        deletedAt: null,
        ...(status ? { status } : {}),
        ...(hidden.length ? { authorId: { notIn: hidden } } : {}),
        AND: [{ OR: [{ moderation: 'OK' }, { authorId: viewerId }] }, ...(after ? [{ OR: [{ createdAt: { lt: new Date(after[0]) } }, { createdAt: new Date(after[0]), id: { lt: after[1] } }] }] : [])],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: size + 1,
    })
  }

  async answers(viewerId: string, doubtId: string) {
    const hidden = await this.people.blockedIds(viewerId)
    return this.db.doubtAnswer.findMany({ where: { doubtId, deletedAt: null, ...(hidden.length ? { authorId: { notIn: hidden } } : {}) }, orderBy: { createdAt: 'asc' }, take: 200 })
  }

  async answerCount(doubtId: string) {
    return this.db.doubtAnswer.count({ where: { doubtId, deletedAt: null } })
  }

  // ── Showcase ─────────────────────────────────────────────────────────────────────────────────────────────────

  async setShowcase(actorId: string, groupId: string, noteId: string | null): Promise<string> {
    const { group, resource, actor } = await this.workspace(actorId, groupId)
    if (!can(actor, Action.GROUP_MANAGE, resource)) throw Errors.forbidden('Only the workspace’s admins choose its showcase.')
    if (noteId) {
      const problem = await this.notes.showcaseProblem(noteId, groupId)
      if (problem) throw Errors.validation(problem, ['input', 'noteId'])
    }
    const previous = group.showcaseNoteId
    await this.db.group.update({ where: { id: groupId }, data: { showcaseNoteId: noteId } })
    await this.audit.record({ actorId, action: 'group.showcase', targetType: 'GROUP', targetId: groupId, metadata: { noteId } })
    if (previous && previous !== noteId) await this.events.publish('ProjectContributorsChanged', { noteId: previous, groupId, contributors: [] })
    if (noteId) await this.publishContributors(groupId)
    return groupId
  }

  /** The team and the mentors, credited on the showcase; restricted minors are named nowhere public (§15.2). */
  private async publishContributors(groupId: string): Promise<void> {
    const group = await this.db.group.findUnique({ where: { id: groupId }, select: { showcaseNoteId: true } })
    if (!group?.showcaseNoteId) return
    const members = await this.db.groupMember.findMany({ where: { groupId }, select: { userId: true, role: true }, take: 2000 })
    const contributors: { userId: string; role: 'CONTRIBUTOR' | 'MENTOR' }[] = []
    for (const m of members) {
      const actor = await this.policy.actor(m.userId)
      if (!actor || actor.restrictedMinor) continue
      contributors.push({ userId: m.userId, role: m.role === 'MENTOR' && actor.globalRole === GlobalRole.TEACHER ? 'MENTOR' : 'CONTRIBUTOR' })
    }
    await this.events.publish('ProjectContributorsChanged', { noteId: group.showcaseNoteId, groupId, contributors })
  }
}
