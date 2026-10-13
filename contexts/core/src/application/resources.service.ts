import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { Action, can, type Actor, type ResourceStatus } from '@lvn/contracts/domain'
import { RESOURCE_LIMITS } from '@lvn/contracts/validation'
import { Errors } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { AUDIT, FILES, POLICY, TOPICS, type Audit, type Files, type Policy, type Topics } from '@lvn-backend/facades'
import { newId, PrismaService, type Prisma } from '@lvn-backend/prisma-base'
import { RateLimiter } from '@lvn-backend/redis'
import { InvalidUrlError, isbn13, normaliseUrl, readPageMeta, SafeFetcher, SafeFetchError } from '@lvn-backend/safe-fetch'
import { CORE_CONFIG, type CoreConfig } from '../core.config'
import { hostOf, pictureType, suggestType, urlKeyOf, type ResourceTypeKind } from '../domain/resources'
import { OpenLibrary } from '../infrastructure/open-library'
import { ModerationService } from './moderation.service'

type Row = Prisma.ResourceGetPayload<{ include: { topics: true } }>

export interface ResourceInput {
  type: ResourceTypeKind
  title: string
  description?: string | null
  url: string
  isbn?: string | null
  author?: string | null
  topicIds: string[]
  /** A COVER upload of the submitter's */
  coverFileId?: string | null
  /** Else a picture a preview found, copied into storage */
  imageUrl?: string | null
}

export interface ResourcePreview {
  url: string | null
  title: string | null
  description: string | null
  author: string | null
  isbn: string | null
  type: ResourceTypeKind | null
  siteName: string | null
  imageUrl: string | null
  /** The page or book was read; false leaves every field to the person */
  found: boolean
  /** An approved resource with this link or ISBN already */
  existingId: string | null
}

/** A resource as the GraphQL layer shapes it. */
export interface ResourceView extends Row {
  topicIds: string[]
  host: string
  viewerCan: { edit: boolean; delete: boolean; report: boolean; seeReason: boolean }
}

const field = (name: string) => ['input', name]
const DAY_MS = 86_400_000

/**
 * Resources (§14.4, ADR-0074): people submit books, courses, tools, software and hardware; every submission waits in
 * the platform moderation queue; approved ones are public. Links and pictures are fetched only through the safe
 * fetcher, and only when a person asks (a preview) or sends a picture the preview found.
 */
@Injectable()
export class ResourcesService implements OnModuleInit {
  private readonly log = new Logger('Resources')
  private readonly fetcher: SafeFetcher
  private readonly openLibrary: OpenLibrary | null

  constructor(
    private readonly db: PrismaService,
    private readonly limiter: RateLimiter,
    private readonly moderation: ModerationService,
    @Inject(POLICY) private readonly policy: Policy,
    @Inject(TOPICS) private readonly topics: Topics,
    @Inject(FILES) private readonly files: Files,
    @Inject(AUDIT) private readonly audit: Audit,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(CORE_CONFIG) config: CoreConfig,
  ) {
    this.fetcher = new SafeFetcher({ userAgent: config.resources.userAgent, allowHosts: config.resources.allowHosts })
    this.openLibrary = config.resources.openLibraryUrl ? new OpenLibrary(this.fetcher, config.resources.openLibraryUrl, config.resources.openLibraryCoversUrl) : null
  }

  onModuleInit(): void {
    this.events.subscribe('UserDeleted', ({ payload }) => this.erase(payload.userId))
  }

  private facts(row: { submittedById: string; status: ResourceStatus }) {
    return { kind: 'learningResource' as const, submittedById: row.submittedById, status: row.status }
  }

  /** Why a person may not submit, in words; null when they may. */
  private async refusal(viewerId: string): Promise<{ actor: Actor; why: string | null }> {
    const actor = await this.policy.actor(viewerId)
    if (!actor) throw Errors.unauthenticated()
    if (can(actor, Action.RESOURCE_SUBMIT)) return { actor, why: null }
    if (actor.suspended) return { actor, why: 'Your account is suspended: resources wait until it ends.' }
    if (actor.restrictedMinor) return { actor, why: 'Resources are public with your name, so child accounts do not add them.' }
    return { actor, why: 'Verify your account to add resources.' }
  }

  // ── Reading ──────────────────────────────────────────────────────────────────────────────────────────────────

  private async view(actor: Actor | null, row: Row): Promise<ResourceView> {
    const mine = actor?.id === row.submittedById
    return {
      ...row,
      topicIds: row.topics.map((t) => t.topicId),
      host: hostOf(row.url),
      viewerCan: {
        edit: can(actor, Action.RESOURCE_EDIT, this.facts(row)),
        delete: can(actor, Action.RESOURCE_DELETE, this.facts(row)),
        report: !!actor && !mine && row.status === 'APPROVED' && can(actor, Action.CONTENT_REPORT),
        seeReason: mine || can(actor, Action.CONTENT_MODERATE),
      },
    }
  }

  /** A resource the viewer may read (an approved one, or their own, or any for moderators); null otherwise. */
  async one(viewerId: string | null, id: string): Promise<ResourceView | null> {
    const row = await this.db.resource.findUnique({ where: { id }, include: { topics: true } })
    if (!row) return null
    const actor = viewerId ? await this.policy.actor(viewerId) : null
    return can(actor, Action.RESOURCE_READ, this.facts(row)) ? this.view(actor, row) : null
  }

  /** The viewer's own resources, newest first, whatever their state. */
  async mine(viewerId: string): Promise<ResourceView[]> {
    const actor = await this.policy.actor(viewerId)
    const rows = await this.db.resource.findMany({ where: { submittedById: viewerId }, include: { topics: true }, orderBy: { createdAt: 'desc' }, take: 200 })
    return Promise.all(rows.map((r) => this.view(actor, r)))
  }

  /** A read URL for an approved or permitted resource's cover; the caller has already read the resource. */
  async coverUrl(row: { coverFileId: string | null }): Promise<string | null> {
    if (!row.coverFileId) return null
    try {
      return (await this.files.readUrl(row.coverFileId)).url
    } catch {
      return null
    }
  }

  /** Topics a resource may have: curated ones, never a person's own proposals (ADR-0074). */
  async topicOptions(viewerId: string, query: string) {
    return (await this.topics.find(viewerId, query)).filter((t) => t.curated)
  }

  // ── Preview ──────────────────────────────────────────────────────────────────────────────────────────────────

  /**
   * What a link's page or an ISBN's book says, for the person to edit before they send it. A page that cannot be read
   * is not an error: the person fills the fields themselves.
   */
  async preview(viewerId: string, input: { url?: string | null; isbn?: string | null }): Promise<ResourcePreview> {
    const { why } = await this.refusal(viewerId)
    if (why) throw Errors.forbidden(why)
    const limit = await this.limiter.hit(`resource-previews:${viewerId}`, { max: RESOURCE_LIMITS.previewsPerHour, windowSeconds: 3600 })
    if (!limit.allowed) throw Errors.rateLimited(limit.retryAfter, 'You have looked up many links in the last hour. Fill in the details yourself, or try again later.')
    const empty: ResourcePreview = { url: null, title: null, description: null, author: null, isbn: null, type: null, siteName: null, imageUrl: null, found: false, existingId: null }

    if (input.isbn?.trim()) {
      const isbn = isbn13(input.isbn)
      if (!isbn) throw Errors.validation('That ISBN is not valid. Check its digits.', field('isbn'))
      const book = this.openLibrary ? await this.openLibrary.byIsbn(isbn) : null
      const preview: ResourcePreview = book
        ? { ...empty, url: normaliseUrl(book.pageUrl), title: book.title, description: book.description, author: book.author, isbn, type: 'BOOK', siteName: 'Open Library', imageUrl: book.coverUrl, found: true }
        : { ...empty, isbn, type: 'BOOK' }
      return { ...preview, existingId: await this.approvedDuplicate(preview.url ? urlKeyOf(preview.url) : null, isbn) }
    }

    const url = this.normalised(input.url ?? '')
    let preview: ResourcePreview = { ...empty, url, type: suggestType(url, null, null) }
    try {
      const page = await this.fetcher.fetch({ url, accept: 'text/html,application/xhtml+xml', maxBytes: 1024 * 1024, types: /^(text\/html|application\/xhtml\+xml)$/ })
      const meta = readPageMeta(page.body.toString('utf8'), page.url)
      const isbn = meta.isbn ? isbn13(meta.isbn) : null
      preview = { ...preview, title: meta.title, description: meta.description, author: meta.author, isbn, type: suggestType(url, meta.type, isbn), siteName: meta.siteName, imageUrl: meta.image, found: true }
    } catch (err) {
      if (!(err instanceof SafeFetchError)) throw err
      this.log.debug(`preview of ${url}: ${err.code}`)
      if (err.code === 'BLOCKED' || err.code === 'INVALID_URL') throw Errors.validation('That address is not on the public internet.', field('url'))
    }
    return { ...preview, existingId: await this.approvedDuplicate(urlKeyOf(url), preview.isbn) }
  }

  private normalised(raw: string): string {
    try {
      const url = normaliseUrl(raw)
      if (url.length > RESOURCE_LIMITS.url) throw new InvalidUrlError('That address is too long.')
      return url
    } catch (err) {
      if (err instanceof InvalidUrlError) throw Errors.validation(err.message, field('url'))
      throw err
    }
  }

  private async approvedDuplicate(urlKey: string | null, isbn: string | null): Promise<string | null> {
    const or = [...(urlKey ? [{ urlKey }] : []), ...(isbn ? [{ isbn }] : [])]
    if (!or.length) return null
    return (await this.db.resource.findFirst({ where: { status: 'APPROVED', OR: or }, select: { id: true } }))?.id ?? null
  }

  // ── Submitting and editing ───────────────────────────────────────────────────────────────────────────────────

  private async fields(viewerId: string, input: ResourceInput) {
    const title = input.title.replace(/\s+/g, ' ').trim()
    if (title.length < RESOURCE_LIMITS.title.min || title.length > RESOURCE_LIMITS.title.max) throw Errors.validation(`Give it a title of ${RESOURCE_LIMITS.title.min} to ${RESOURCE_LIMITS.title.max} characters.`, field('title'))
    const description = input.description?.trim() || null
    if (description && description.length > RESOURCE_LIMITS.description) throw Errors.validation(`Keep the description under ${RESOURCE_LIMITS.description} characters.`, field('description'))
    const author = input.author?.replace(/\s+/g, ' ').trim() || null
    if (author && author.length > RESOURCE_LIMITS.author) throw Errors.validation(`Keep "by" under ${RESOURCE_LIMITS.author} characters.`, field('author'))
    const url = this.normalised(input.url)
    let isbn: string | null = null
    if (input.isbn?.trim()) {
      if (input.type !== 'BOOK') throw Errors.validation('Only books have an ISBN.', field('isbn'))
      isbn = isbn13(input.isbn)
      if (!isbn) throw Errors.validation('That ISBN is not valid. Check its digits.', field('isbn'))
    }
    const topicIds = [...new Set(input.topicIds)]
    if (topicIds.length < RESOURCE_LIMITS.topics.min || topicIds.length > RESOURCE_LIMITS.topics.max) throw Errors.validation(`Choose ${RESOURCE_LIMITS.topics.min} to ${RESOURCE_LIMITS.topics.max} topics.`, field('topicIds'))
    const usable = await this.topics.usable(viewerId, topicIds)
    if (usable.length !== topicIds.length || usable.some((t) => !t.curated)) throw Errors.validation('Choose topics from LearnViaNotes’ list: your own topics are private to you.', field('topicIds'))
    return { type: input.type, title, description, author, url, urlKey: urlKeyOf(url), isbn, topicIds }
  }

  /** A pending or approved resource with the same link or ISBN: an approved one is named, a pending one is not. */
  private async assertNew(urlKey: string, isbn: string | null, except: string | null): Promise<void> {
    const found = await this.db.resource.findFirst({
      where: { status: { in: ['PENDING', 'APPROVED'] }, OR: [{ urlKey }, ...(isbn ? [{ isbn }] : [])], ...(except ? { id: { not: except } } : {}) },
      select: { id: true, status: true, title: true },
    })
    if (!found) return
    if (found.status === 'APPROVED') throw Errors.conflict(`“${found.title}” is already in the catalogue.`, field('url'))
    throw Errors.conflict('Someone has already sent this; it is waiting for moderators.', field('url'))
  }

  async submit(viewerId: string, input: ResourceInput): Promise<string> {
    const { why } = await this.refusal(viewerId)
    if (why) throw Errors.forbidden(why)
    const [today, waiting] = await Promise.all([
      this.db.resource.count({ where: { submittedById: viewerId, createdAt: { gte: new Date(Date.now() - DAY_MS) } } }),
      this.db.resource.count({ where: { submittedById: viewerId, status: 'PENDING' } }),
    ])
    if (today >= RESOURCE_LIMITS.perDay) throw Errors.rateLimited(3600, `You can add ${RESOURCE_LIMITS.perDay} resources a day. Add more tomorrow.`)
    if (waiting >= RESOURCE_LIMITS.waiting) throw Errors.validation(`${RESOURCE_LIMITS.waiting} of your resources are waiting for moderators. Add more once some are approved.`)
    const f = await this.fields(viewerId, input)
    await this.assertNew(f.urlKey, f.isbn, null)

    const id = newId()
    await this.db.resource.create({ data: { id, type: f.type, title: f.title, description: f.description, url: f.url, urlKey: f.urlKey, isbn: f.isbn, author: f.author, submittedById: viewerId, topics: { create: f.topicIds.map((topicId) => ({ topicId })) } } })
    try {
      await this.setCover(viewerId, id, input, null)
    } catch (err) {
      await this.db.resource.delete({ where: { id } })
      throw err
    }
    await this.moderation.openSubmissionCase(id, `${f.title}\n${f.description ?? ''}`)
    await this.events.publish('ResourceSubmitted', { resourceId: id, submittedById: viewerId })
    return id
  }

  /** Its submitter changes a waiting or rejected resource; saving a rejected one sends it to moderators again. */
  async update(viewerId: string, input: ResourceInput & { id: string; removeCover?: boolean | null }): Promise<void> {
    const actor = await this.policy.actor(viewerId)
    const row = await this.db.resource.findUnique({ where: { id: input.id } })
    if (!row || !can(actor, Action.RESOURCE_READ, this.facts(row))) throw Errors.notFound('Resource not found.')
    if (!can(actor, Action.RESOURCE_EDIT, this.facts(row))) {
      throw Errors.forbidden(row.submittedById === viewerId && row.status === 'APPROVED' ? 'An approved resource stays as moderators saw it. Delete it and add it again if it is wrong.' : undefined)
    }
    const f = await this.fields(viewerId, input)
    await this.assertNew(f.urlKey, f.isbn, row.id)
    const resubmit = row.status === 'REJECTED'
    await this.db.$transaction([
      this.db.resourceTopic.deleteMany({ where: { resourceId: row.id } }),
      this.db.resource.update({
        where: { id: row.id },
        data: { type: f.type, title: f.title, description: f.description, url: f.url, urlKey: f.urlKey, isbn: f.isbn, author: f.author, topics: { create: f.topicIds.map((topicId) => ({ topicId })) }, ...(resubmit ? { status: 'PENDING', reason: null, decidedAt: null } : {}) },
      }),
    ])
    await this.setCover(viewerId, row.id, input, row.coverFileId, input.removeCover ?? false)
    if (resubmit) {
      await this.moderation.openSubmissionCase(row.id, `${f.title}\n${f.description ?? ''}`)
      await this.events.publish('ResourceSubmitted', { resourceId: row.id, submittedById: viewerId })
    }
  }

  /** A new uploaded cover, or a preview's picture copied in; the old one goes when it is replaced or removed. */
  private async setCover(viewerId: string, id: string, input: ResourceInput, current: string | null, remove = false): Promise<void> {
    let next: string | null | undefined
    if (input.coverFileId && input.coverFileId !== current) {
      await this.files.attach([input.coverFileId], viewerId, 'COVER', { type: 'RESOURCE', id })
      next = input.coverFileId
    } else if (input.imageUrl && !input.coverFileId) {
      next = (await this.copyPicture(viewerId, id, input.imageUrl)) ?? undefined
    } else if (remove) {
      next = null
    }
    if (next === undefined) return
    await this.db.resource.update({ where: { id }, data: { coverFileId: next } })
    if (current && current !== next) await this.files.delete([current]).catch(() => undefined)
  }

  /** Copies a picture into storage through the safe fetcher (never hot-linked); null when it cannot. */
  private async copyPicture(ownerId: string, resourceId: string, imageUrl: string): Promise<string | null> {
    try {
      const res = await this.fetcher.fetch({ url: imageUrl, accept: 'image/jpeg,image/png,image/webp', maxBytes: RESOURCE_LIMITS.coverBytes, types: /^image\/(jpeg|png|webp)$/ })
      const mimeType = pictureType(res.body)
      if (!mimeType) return null
      const ext = mimeType.split('/')[1] === 'jpeg' ? 'jpg' : mimeType.split('/')[1]
      return await this.files.store(ownerId, { purpose: 'COVER', parent: { type: 'RESOURCE', id: resourceId }, fileName: `cover.${ext}`, mimeType, bytes: res.body, restricted: false, expiresAt: null })
    } catch (err) {
      this.log.debug(`cover for ${resourceId}: ${err instanceof Error ? err.message : String(err)}`)
      return null
    }
  }

  async remove(viewerId: string, id: string): Promise<void> {
    const actor = await this.policy.actor(viewerId)
    const row = await this.db.resource.findUnique({ where: { id } })
    if (!row || !can(actor, Action.RESOURCE_READ, this.facts(row))) throw Errors.notFound('Resource not found.')
    if (!can(actor, Action.RESOURCE_DELETE, this.facts(row))) throw Errors.forbidden()
    await this.db.resource.delete({ where: { id } })
    if (row.coverFileId) await this.files.delete([row.coverFileId]).catch(() => undefined)
    await this.moderation.closeCases('RESOURCE', [id], viewerId)
    await this.events.publish('ResourceChanged', { resourceId: id })
    if (row.submittedById !== viewerId) await this.audit.record({ actorId: viewerId, action: 'resource.deleted', targetType: 'RESOURCE', targetId: id, metadata: { submittedById: row.submittedById } })
  }

  // ── Data ─────────────────────────────────────────────────────────────────────────────────────────────────────

  /** The person's resources for their data export (ADR-0018). */
  async exportOf(userId: string) {
    const rows = await this.db.resource.findMany({ where: { submittedById: userId }, include: { topics: true }, orderBy: { createdAt: 'asc' } })
    return rows.map((r) => ({ id: r.id, type: r.type, title: r.title, description: r.description, url: r.url, isbn: r.isbn, author: r.author, topicIds: r.topics.map((t) => t.topicId), status: r.status, reason: r.reason, createdAt: r.createdAt.toISOString(), decidedAt: r.decidedAt?.toISOString() ?? null }))
  }

  /** A deleted account's resources go with it, as its notes do; their open cases close. */
  async erase(userId: string): Promise<void> {
    const rows = await this.db.resource.findMany({ where: { submittedById: userId }, select: { id: true } })
    if (!rows.length) return
    await this.db.resource.deleteMany({ where: { submittedById: userId } })
    await this.moderation.closeCases('RESOURCE', rows.map((r) => r.id), null)
    for (const r of rows) await this.events.publish('ResourceChanged', { resourceId: r.id })
  }
}
