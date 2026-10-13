import { Injectable } from '@nestjs/common'
import { folderNameSchema, NOTE_LIMITS, slugify, tagNameSchema, topicTitleSchema } from '@lvn/contracts/validation'
import { Errors } from '@lvn-backend/errors'
import { newId, PrismaService, type Prisma } from '@lvn-backend/prisma-base'
import { RateLimiter } from '@lvn-backend/redis'

type Tx = Prisma.TransactionClient

const FOLDERS_PER_USER = 500
const TAGS_PER_USER = 1_000

function parse<T>(schema: { safeParse(v: unknown): { success: true; data: T } | { success: false; error: { issues: { message: string }[] } } }, value: unknown, field: string[]): T {
  const r = schema.safeParse(value)
  if (!r.success) throw Errors.validation(r.error.issues[0]!.message, field)
  return r.data
}

/** How a user organises notes (§4.1): their folders and tags, and the subjects and topics everyone shares. */
@Injectable()
export class OrganiseService {
  constructor(
    private readonly db: PrismaService,
    private readonly limiter: RateLimiter,
  ) {}

  // ── Folders ──────────────────────────────────────────────────────────────────────────────────────────────

  async folders(ownerId: string) {
    const [folders, counts] = await Promise.all([
      this.db.folder.findMany({ where: { ownerId }, orderBy: [{ name: 'asc' }, { id: 'asc' }] }),
      this.db.note.groupBy({ by: ['folderId'], where: { ownerId, deletedAt: null, folderId: { not: null } }, _count: { _all: true } }),
    ])
    const count = new Map(counts.map((c) => [c.folderId, c._count._all]))
    return folders.map((f) => ({ ...f, noteCount: count.get(f.id) ?? 0 }))
  }

  async assertOwnFolder(ownerId: string, folderId: string, field: string[]): Promise<void> {
    const folder = await this.db.folder.findUnique({ where: { id: folderId } })
    if (!folder || folder.ownerId !== ownerId) throw Errors.validation('That folder does not exist.', field)
  }

  async createFolder(ownerId: string, input: { name: string; parentId?: string | null }) {
    const name = parse(folderNameSchema, input.name, ['input', 'name'])
    const all = await this.db.folder.findMany({ where: { ownerId }, select: { id: true, parentId: true } })
    if (all.length >= FOLDERS_PER_USER) throw Errors.validation(`You can have at most ${FOLDERS_PER_USER} folders.`)
    if (input.parentId) {
      const parents = new Map(all.map((f) => [f.id, f.parentId]))
      if (!parents.has(input.parentId)) throw Errors.validation('That folder does not exist.', ['input', 'parentId'])
      if (depthOf(input.parentId, parents) + 1 > NOTE_LIMITS.folderDepth) throw Errors.validation(`Folders nest at most ${NOTE_LIMITS.folderDepth} levels deep.`, ['input', 'parentId'])
    }
    const folder = await this.db.folder.create({ data: { id: newId(), ownerId, name, parentId: input.parentId ?? null } })
    return { ...folder, noteCount: 0 }
  }

  /**
   * The folder at a path of names (imports, ADR-0018): existing folders are reused, missing ones made; paths deeper than
   * folders may nest stop at the deepest level allowed. Returns null when not even the first folder can be made.
   */
  async ensureFolderPath(ownerId: string, names: string[]): Promise<string | null> {
    let parentId: string | null = null
    for (const raw of names.slice(0, NOTE_LIMITS.folderDepth)) {
      const name = folderNameSchema.safeParse(raw.trim().slice(0, 100))
      if (!name.success) break
      const existing: { id: string } | null = await this.db.folder.findFirst({ where: { ownerId, parentId, name: { equals: name.data, mode: 'insensitive' } }, select: { id: true } })
      if (existing) {
        parentId = existing.id
        continue
      }
      try {
        parentId = (await this.createFolder(ownerId, { name: name.data, parentId })).id
      } catch {
        break
      }
    }
    return parentId
  }

  async updateFolder(ownerId: string, input: { id: string; name?: string | null; parentId?: string | null }) {
    const all = await this.db.folder.findMany({ where: { ownerId }, select: { id: true, parentId: true } })
    const parents = new Map(all.map((f) => [f.id, f.parentId]))
    if (!parents.has(input.id)) throw Errors.notFound('Folder not found.')
    const data: Prisma.FolderUpdateInput = {}
    if (input.name !== undefined && input.name !== null) data.name = parse(folderNameSchema, input.name, ['input', 'name'])
    if (input.parentId !== undefined) {
      const parentId = input.parentId
      if (parentId) {
        if (!parents.has(parentId)) throw Errors.validation('That folder does not exist.', ['input', 'parentId'])
        // The new parent may not be the folder itself or anything inside it.
        for (let at: string | null | undefined = parentId; at; at = parents.get(at)) {
          if (at === input.id) throw Errors.validation('A folder cannot go inside itself.', ['input', 'parentId'])
        }
        if (depthOf(parentId, parents) + subtreeHeight(input.id, all) > NOTE_LIMITS.folderDepth) {
          throw Errors.validation(`Folders nest at most ${NOTE_LIMITS.folderDepth} levels deep.`, ['input', 'parentId'])
        }
      }
      data.parent = parentId ? { connect: { id: parentId } } : { disconnect: true }
    }
    const folder = await this.db.folder.update({ where: { id: input.id }, data })
    const noteCount = await this.db.note.count({ where: { ownerId, folderId: folder.id, deletedAt: null } })
    return { ...folder, noteCount }
  }

  /** Deletes a folder; what it held — notes and subfolders — moves up one level. */
  async deleteFolder(ownerId: string, id: string): Promise<void> {
    const folder = await this.db.folder.findUnique({ where: { id } })
    if (!folder || folder.ownerId !== ownerId) throw Errors.notFound('Folder not found.')
    await this.db.$transaction([
      this.db.note.updateMany({ where: { ownerId, folderId: id }, data: { folderId: folder.parentId } }),
      this.db.folder.updateMany({ where: { ownerId, parentId: id }, data: { parentId: folder.parentId } }),
      this.db.folder.delete({ where: { id } }),
    ])
  }

  // ── Tags ─────────────────────────────────────────────────────────────────────────────────────────────────

  async tags(ownerId: string) {
    const [tags, counts] = await Promise.all([
      this.db.tag.findMany({ where: { ownerId }, orderBy: [{ name: 'asc' }, { id: 'asc' }] }),
      this.db.noteTag.groupBy({ by: ['tagId'], where: { tag: { ownerId }, note: { deletedAt: null } }, _count: { _all: true } }),
    ])
    const count = new Map(counts.map((c) => [c.tagId, c._count._all]))
    return tags.map((t) => ({ ...t, noteCount: count.get(t.id) ?? 0 }))
  }

  /** Tags of several notes at once (one query), by note id. */
  async tagsOfNotes(noteIds: string[]) {
    const links = await this.db.noteTag.findMany({ where: { noteId: { in: noteIds } }, include: { tag: true } })
    const byNote = new Map<string, { id: string; name: string; noteCount: number }[]>()
    for (const l of links) byNote.set(l.noteId, [...(byNote.get(l.noteId) ?? []), { id: l.tag.id, name: l.tag.name, noteCount: 0 }])
    for (const tags of byNote.values()) tags.sort((a, b) => a.name.localeCompare(b.name))
    return byNote
  }

  /** Replaces a note's tags with these names, creating the owner's tags that do not exist yet. */
  async setTags(tx: Tx, ownerId: string, noteId: string, names: string[], field: string[]): Promise<void> {
    // Two names differing only in case are one tag; the first spelling given wins.
    const parsed: string[] = []
    for (const name of names.map((n) => parse(tagNameSchema, n, field))) if (!parsed.some((p) => p.toLowerCase() === name.toLowerCase())) parsed.push(name)
    if (parsed.length > NOTE_LIMITS.tagsPerNote) throw Errors.validation(`A note can have at most ${NOTE_LIMITS.tagsPerNote} tags.`, field)
    const existing = await tx.tag.findMany({ where: { ownerId, name: { in: parsed } } })
    const known = new Set(existing.map((t) => t.name.toLowerCase()))
    const missing = parsed.filter((n) => !known.has(n.toLowerCase()))
    if (missing.length) {
      if ((await tx.tag.count({ where: { ownerId } })) + missing.length > TAGS_PER_USER) throw Errors.validation(`You can have at most ${TAGS_PER_USER} tags.`, field)
      await tx.tag.createMany({ data: missing.map((name) => ({ id: newId(), ownerId, name })), skipDuplicates: true })
    }
    const tags = await tx.tag.findMany({ where: { ownerId, name: { in: parsed } }, select: { id: true } })
    await tx.noteTag.deleteMany({ where: { noteId } })
    if (tags.length) await tx.noteTag.createMany({ data: tags.map((t) => ({ noteId, tagId: t.id })) })
  }

  async renameTag(ownerId: string, id: string, name: string) {
    const tag = await this.db.tag.findUnique({ where: { id } })
    if (!tag || tag.ownerId !== ownerId) throw Errors.notFound('Tag not found.')
    const newName = parse(tagNameSchema, name, ['input', 'name'])
    const clash = await this.db.tag.findFirst({ where: { ownerId, name: newName, id: { not: id } } })
    if (clash) throw Errors.conflict('You already have a tag with this name.', ['input', 'name'])
    const updated = await this.db.tag.update({ where: { id }, data: { name: newName } })
    const noteCount = await this.db.noteTag.count({ where: { tagId: id, note: { deletedAt: null } } })
    return { ...updated, noteCount }
  }

  async deleteTag(ownerId: string, id: string): Promise<void> {
    const tag = await this.db.tag.findUnique({ where: { id } })
    if (!tag || tag.ownerId !== ownerId) throw Errors.notFound('Tag not found.')
    await this.db.tag.delete({ where: { id } })
  }

  // ── Subjects and topics ──────────────────────────────────────────────────────────────────────────────────

  subjects() {
    return this.db.subject.findMany({ orderBy: { position: 'asc' } })
  }

  subject(slug: string) {
    return this.db.subject.findUnique({ where: { slug } })
  }

  /** Who may see and use a topic: curated ones, and the viewer's own proposals. */
  private usableWhere(viewerId: string | null): Prisma.TopicWhereInput {
    return viewerId ? { OR: [{ origin: 'CURATED' }, { proposedById: viewerId }] } : { origin: 'CURATED' }
  }

  /** One topic a viewer may see (a federation reference, ADR-0067's history): curated, or proposed by them. */
  topicFor(id: string, viewerId: string | null) {
    return this.db.topic.findFirst({ where: { id, ...this.usableWhere(viewerId) } })
  }

  topicsOf(subjectId: string, parentId: string | null, viewerId: string | null) {
    return this.db.topic.findMany({ where: { subjectId, parentId, ...this.usableWhere(viewerId) }, orderBy: [{ position: 'asc' }, { title: 'asc' }] })
  }

  findTopics(query: string, subjectId: string | null | undefined, viewerId: string | null) {
    const words = query.trim().split(/\s+/).filter(Boolean).slice(0, 5)
    if (!words.length) return Promise.resolve([])
    return this.db.topic.findMany({
      where: { AND: [this.usableWhere(viewerId), ...(subjectId ? [{ subjectId }] : []), ...words.map((w) => ({ title: { contains: w, mode: 'insensitive' as const } }))] },
      orderBy: [{ origin: 'asc' }, { title: 'asc' }],
      take: 50,
    })
  }

  /** Topics of several notes at once (one query), by note id. */
  async topicsOfNotes(noteIds: string[]) {
    const links = await this.db.noteTopic.findMany({ where: { noteId: { in: noteIds } }, include: { topic: true } })
    const byNote = new Map<string, (typeof links)[number]['topic'][]>()
    for (const l of links) byNote.set(l.noteId, [...(byNote.get(l.noteId) ?? []), l.topic])
    for (const topics of byNote.values()) topics.sort((a, b) => a.title.localeCompare(b.title))
    return byNote
  }

  subjectsByIds(ids: string[]) {
    return this.db.subject.findMany({ where: { id: { in: ids } } })
  }

  /** The topic ids a viewer may attach to a note, de-duplicated; VALIDATION for any other id. */
  async usableTopics(viewerId: string, topicIds: string[], field: string[]): Promise<string[]> {
    const ids = [...new Set(topicIds)]
    if (ids.length > NOTE_LIMITS.topicsPerNote) throw Errors.validation(`A note can have at most ${NOTE_LIMITS.topicsPerNote} topics.`, field)
    if (!ids.length) return []
    const found = await this.db.topic.count({ where: { id: { in: ids }, ...this.usableWhere(viewerId) } })
    if (found !== ids.length) throw Errors.validation('One of these topics does not exist.', field)
    return ids
  }

  /** A topic of one's own within a subject; usable by its proposer until LVN curates it. */
  async proposeTopic(viewerId: string, input: { subjectId: string; parentId?: string | null; title: string }) {
    const title = parse(topicTitleSchema, input.title, ['input', 'title'])
    const subject = await this.db.subject.findUnique({ where: { id: input.subjectId } })
    if (!subject) throw Errors.validation('That subject does not exist.', ['input', 'subjectId'])
    if (input.parentId) {
      const parent = await this.db.topic.findFirst({ where: { id: input.parentId, subjectId: subject.id, ...this.usableWhere(viewerId) } })
      if (!parent) throw Errors.validation('That topic does not exist in this subject.', ['input', 'parentId'])
    }
    const same = await this.db.topic.findFirst({ where: { subjectId: subject.id, parentId: input.parentId ?? null, title: { equals: title, mode: 'insensitive' }, ...this.usableWhere(viewerId) } })
    if (same) return same
    const limit = await this.limiter.hit(`topics:propose:${viewerId}`, { max: 20, windowSeconds: 24 * 3600 })
    if (!limit.allowed) throw Errors.rateLimited(limit.retryAfter, 'You can propose 20 topics a day.')
    const id = newId()
    // Proposals never take a slug a curated topic could want later: they carry part of their id.
    return this.db.topic.create({ data: { id, subjectId: subject.id, parentId: input.parentId ?? null, slug: `${slugify(title)}-${id.slice(-8)}`, title, origin: 'PROPOSED', proposedById: viewerId } })
  }
}

function depthOf(folderId: string, parents: Map<string, string | null>): number {
  let depth = 0
  for (let at: string | null | undefined = folderId; at; at = parents.get(at)) depth++
  return depth
}

/** Levels in a folder's subtree, the folder itself included. */
function subtreeHeight(folderId: string, all: { id: string; parentId: string | null }[]): number {
  const children = all.filter((f) => f.parentId === folderId)
  return 1 + Math.max(0, ...children.map((c) => subtreeHeight(c.id, all)))
}
