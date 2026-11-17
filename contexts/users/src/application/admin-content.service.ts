import { Injectable } from '@nestjs/common'
import { Errors } from '@lvn-backend/errors'
import { connection, decodeCursor, pageSize, type Connection } from '@lvn-backend/graphql'
import { PrismaService } from '@lvn-backend/prisma-base'
import { ADMIN_CONTENT_TYPES, richText, titleAndExcerpt, type AdminContentType, type AdminContentVisibility } from '../domain/admin-content'
import { AuditService } from './audit.service'
import { PolicyService } from './policy.service'

const PRIVATE_NOTE = { not: 'PRIVATE' as const }
const HIDDEN_FILE_PURPOSES = ['COLLEGE_ID', 'VERIFICATION_DOCUMENT'] as const

export interface AdminContentFilter {
  type?: AdminContentType | null
  userId?: string | null
  handle?: string | null
  from?: Date | string | null
  to?: Date | string | null
  visibility?: AdminContentVisibility | null
}

export interface AdminContentItem {
  id: string
  type: AdminContentType
  title: string | null
  excerpt: string | null
  author: { id: string; handle: string; email: string }
  visibility: AdminContentVisibility
  createdAt: Date
  updatedAt: Date
  moderation: string | null
  deepLink: string
}

interface Raw {
  id: string
  /** Sort key. Opaque in the cursor. The node's type is the public kind. */
  rank: string
  type: AdminContentType
  title: string | null
  excerpt: string | null
  authorId: string
  visibility: AdminContentVisibility
  createdAt: Date
  updatedAt: Date
  moderation: string | null
  deepLink: string
}

interface Cursor {
  at: Date
  rank: string
  id: string
}

interface Window {
  from: Date | null
  to: Date | null
  authorId: string | null
  visibility: AdminContentVisibility | null
}

/**
 * Platform-admin browser of content that is not private. Private notes, shares of them, files and highlights on them,
 * and college ID cards are excluded in the queries (a college ID stays on the student-id queue). There is no new
 * takedown: moderators keep using moderateContent.
 */
@Injectable()
export class AdminContentService {
  constructor(
    private readonly db: PrismaService,
    private readonly policy: PolicyService,
    private readonly audit: AuditService,
  ) {}

  async list(actorId: string, filter: AdminContentFilter | null | undefined, first?: number | null, after?: string | null): Promise<Connection<AdminContentItem>> {
    await this.assertAdmin(actorId)
    const window = await this.window(filter ?? {}, true)
    const size = pageSize(first)
    const cursor = readCursor(after)
    const ranks = ranksFor(filter?.type ?? null)
    const lists = await Promise.all(ranks.map((rank) => this.load(rank, window, cursor, size + 1)))
    const merged = lists.flat().sort(byRank).filter((row) => afterCursor(row, cursor)).slice(0, size + 1)
    const authors = await this.authors(merged.map((row) => row.authorId))
    const nodes = merged.map((row) => ({ ...row, author: authors.get(row.authorId) ?? { id: row.authorId, handle: 'unknown', email: '' } }))
    await this.audit.record({
      actorId,
      action: 'admin.content.browse',
      targetType: 'CONTENT',
      metadata: {
        type: filter?.type ?? null,
        userId: filter?.userId ?? null,
        handle: filter?.handle?.trim() || null,
        from: window.from?.toISOString() ?? null,
        to: window.to?.toISOString() ?? null,
        visibility: filter?.visibility ?? null,
      },
    })
    return connection(nodes, size, (node) => [node.createdAt.toISOString(), node.rank, node.id], (node) => this.toItem(node))
  }

  async counts(actorId: string, from?: Date | string | null, to?: Date | string | null): Promise<{ from: Date | null; to: Date | null; counts: { type: AdminContentType; count: number }[] }> {
    await this.assertAdmin(actorId)
    const window = await this.window({ from, to }, false)
    const hidden = await this.hiddenNoteIds()
    const counts = await Promise.all(ADMIN_CONTENT_TYPES.map(async (type) => ({ type, count: await this.countType(type, window, hidden) })))
    return { from: window.from, to: window.to, counts }
  }

  private async assertAdmin(userId: string): Promise<void> {
    const actor = await this.policy.actor(userId)
    if (!actor) throw Errors.unauthenticated()
    if (actor.globalRole !== 'PLATFORM_ADMIN') throw Errors.forbidden('Only platform admins can browse content.')
  }

  private async window(filter: AdminContentFilter, withAuthor: boolean): Promise<Window> {
    const from = instant(filter.from, 'from')
    const to = instant(filter.to, 'to')
    if (from && to && from > to) throw Errors.validation('The start has to be before the end.', ['filter', 'from'])
    let authorId: string | null = null
    if (withAuthor) {
      const handle = filter.handle?.trim()
      const byHandle = handle ? await this.db.user.findUnique({ where: { handle }, select: { id: true } }) : null
      if (handle && !byHandle) authorId = 'none'
      else if (filter.userId && byHandle && byHandle.id !== filter.userId) authorId = 'none'
      else authorId = filter.userId ?? byHandle?.id ?? null
    }
    return { from, to, authorId, visibility: filter.visibility ?? null }
  }

  private async load(rank: string, window: Window, cursor: Cursor | null, want: number): Promise<Raw[]> {
    if (window.authorId === 'none') return []
    const kept: Raw[] = []
    let local = cursor
    for (let round = 0; round < 8 && kept.length < want; round++) {
      const batch = await this.fetch(rank, window, local, Math.max(want * 2, 40))
      if (!batch.length) break
      const accepted = await this.keep(rank, batch, window)
      for (const row of accepted) {
        kept.push(row)
        if (kept.length >= want) break
      }
      const last = batch[batch.length - 1]!
      local = { at: last.createdAt, rank, id: last.id }
      if (batch.length < Math.max(want * 2, 40)) break
    }
    return kept
  }

  /** Drops comments on private notes and files that sit on one, after the query has already excluded the obvious rows. */
  private async keep(rank: string, rows: Raw[], window: Window): Promise<Raw[]> {
    if (rank === 'COMMENT') return this.keepComments(rows, window)
    if (rank === 'UPLOAD') return this.keepUploads(rows, window)
    return rows
  }

  private async keepComments(rows: Raw[], window: Window): Promise<Raw[]> {
    const noteIds = rows.filter((row) => row.deepLink.startsWith('/notes/')).map((row) => row.deepLink.slice('/notes/'.length))
    const notes = noteIds.length ? await this.db.note.findMany({ where: { id: { in: noteIds } }, select: { id: true, visibility: true, deletedAt: true } }) : []
    const byId = new Map(notes.map((note) => [note.id, note]))
    return rows.filter((row) => {
      if (!row.deepLink.startsWith('/notes/')) return matches(row.visibility, window.visibility)
      const note = byId.get(row.deepLink.slice('/notes/'.length))
      if (!note || note.deletedAt || note.visibility === 'PRIVATE') return false
      row.visibility = note.visibility as AdminContentVisibility
      return matches(row.visibility, window.visibility)
    })
  }

  private async keepUploads(rows: Raw[], window: Window): Promise<Raw[]> {
    const ids = rows.map((row) => row.id)
    const [attachments, images, parents] = await Promise.all([
      this.db.noteAttachment.findMany({ where: { fileId: { in: ids } }, select: { fileId: true, noteId: true, note: { select: { visibility: true, deletedAt: true } } } }),
      this.db.notePageImage.findMany({ where: { fileId: { in: ids } }, select: { fileId: true, page: { select: { noteId: true, note: { select: { visibility: true, deletedAt: true } } } } } }),
      this.db.note.findMany({
        where: { id: { in: rows.flatMap((row) => (row.deepLink.startsWith('/notes/') ? [row.deepLink.slice('/notes/'.length)] : [])) } },
        select: { id: true, visibility: true, deletedAt: true },
      }),
    ])
    const hidden = new Set<string>()
    const visibilityOf = new Map<string, AdminContentVisibility>()
    const see = (fileId: string, note: { visibility: string; deletedAt: Date | null }) => {
      if (note.deletedAt || note.visibility === 'PRIVATE') hidden.add(fileId)
      else if (!visibilityOf.has(fileId)) visibilityOf.set(fileId, note.visibility as AdminContentVisibility)
    }
    for (const row of attachments) see(row.fileId, row.note)
    for (const row of images) see(row.fileId, row.page.note)
    const parentById = new Map(parents.map((note) => [note.id, note]))
    return rows.filter((row) => {
      if (hidden.has(row.id)) return false
      const parentId = row.deepLink.startsWith('/notes/') ? row.deepLink.slice('/notes/'.length) : null
      const parent = parentId ? parentById.get(parentId) : undefined
      if (parent && (parent.deletedAt || parent.visibility === 'PRIVATE')) return false
      if (parent) row.visibility = parent.visibility as AdminContentVisibility
      else if (visibilityOf.has(row.id)) row.visibility = visibilityOf.get(row.id)!
      return matches(row.visibility, window.visibility)
    })
  }

  private async fetch(rank: string, window: Window, cursor: Cursor | null, take: number): Promise<Raw[]> {
    const author = window.authorId
    const range = (column: string) => onColumn(column, window.from, window.to)
    switch (rank) {
      case 'NOTE': {
        const visibility = noteVisibility(window.visibility)
        if (!visibility) return []
        const rows = await this.db.note.findMany({
          where: andWhere({ deletedAt: null, ...visibility, ...(author ? { ownerId: author } : {}) }, range('createdAt'), olderThan(cursor, rank)),
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take,
          select: { id: true, ownerId: true, title: true, visibility: true, moderation: true, createdAt: true, updatedAt: true },
        })
        return rows.map((row) => item(rank, 'NOTE', row.id, row.ownerId, row.visibility as AdminContentVisibility, row.createdAt, row.updatedAt, row.moderation, `/notes/${row.id}`, titleAndExcerpt(row.title, null)))
      }
      case 'COMMENT': {
        if (window.visibility === 'PRIVATE') return []
        const rows = await this.db.comment.findMany({
          where: andWhere({ deletedAt: null, visibleTo: null, ...(author ? { authorId: author } : {}) }, range('createdAt'), olderThan(cursor, rank)),
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take,
          select: { id: true, authorId: true, targetType: true, targetId: true, body: true, moderation: true, createdAt: true, editedAt: true },
        })
        const groupPostIds = rows.filter((row) => row.targetType === 'GROUP_POST').map((row) => row.targetId)
        const classPostIds = rows.filter((row) => row.targetType === 'CLASSROOM_POST').map((row) => row.targetId)
        const [groupPosts, classPosts] = await Promise.all([
          groupPostIds.length ? this.db.groupPost.findMany({ where: { id: { in: groupPostIds } }, select: { id: true, groupId: true } }) : [],
          classPostIds.length ? this.db.classroomPost.findMany({ where: { id: { in: classPostIds } }, select: { id: true, classroomId: true } }) : [],
        ])
        const groupOf = new Map(groupPosts.map((row) => [row.id, row.groupId]))
        const classOf = new Map(classPosts.map((row) => [row.id, row.classroomId]))
        return rows.map((row) => {
          const link = row.targetType === 'NOTE' ? `/notes/${row.targetId}` : row.targetType === 'RESOURCE' ? `/resources/${row.targetId}` : row.targetType === 'GROUP_POST' ? `/groups/${groupOf.get(row.targetId) ?? row.targetId}` : `/classes/${classOf.get(row.targetId) ?? row.targetId}`
          const visibility: AdminContentVisibility = row.targetType === 'RESOURCE' ? 'PUBLIC' : 'MEMBERS'
          return item(rank, 'COMMENT', row.id, row.authorId, visibility, row.createdAt, row.editedAt ?? row.createdAt, row.moderation, link, titleAndExcerpt(null, richText(row.body)))
        })
      }
      case 'GROUP': {
        const privacy = window.visibility === 'PUBLIC' || window.visibility === 'PRIVATE' ? window.visibility : window.visibility ? null : undefined
        if (privacy === null) return []
        const rows = await this.db.group.findMany({
          where: andWhere({ deletedAt: null, ...(privacy ? { privacy } : {}), ...(author ? { ownerId: author } : {}) }, range('createdAt'), olderThan(cursor, rank)),
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take,
          select: { id: true, ownerId: true, name: true, description: true, privacy: true, createdAt: true, updatedAt: true },
        })
        return rows.map((row) => item(rank, 'GROUP', row.id, row.ownerId, row.privacy as AdminContentVisibility, row.createdAt, row.updatedAt, 'OK', `/groups/${row.id}`, titleAndExcerpt(row.name, row.description)))
      }
      case 'GROUP_POST': {
        if (window.visibility && window.visibility !== 'MEMBERS') return []
        const rows = await this.db.groupPost.findMany({
          where: andWhere({ deletedAt: null, ...(author ? { authorId: author } : {}) }, range('createdAt'), olderThan(cursor, rank)),
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take,
          select: { id: true, groupId: true, authorId: true, body: true, moderation: true, createdAt: true, editedAt: true },
        })
        return rows.map((row) => item(rank, 'GROUP_POST', row.id, row.authorId, 'MEMBERS', row.createdAt, row.editedAt ?? row.createdAt, row.moderation, `/groups/${row.groupId}`, titleAndExcerpt(null, richText(row.body))))
      }
      case 'CLASSROOM': {
        if (window.visibility && window.visibility !== 'MEMBERS') return []
        const rows = await this.db.classroom.findMany({
          where: andWhere({ deletedAt: null, ...(author ? { ownerId: author } : {}) }, range('createdAt'), olderThan(cursor, rank)),
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take,
          select: { id: true, ownerId: true, name: true, description: true, createdAt: true, updatedAt: true },
        })
        return rows.map((row) => item(rank, 'CLASSROOM', row.id, row.ownerId, 'MEMBERS', row.createdAt, row.updatedAt, null, `/classes/${row.id}`, titleAndExcerpt(row.name, row.description)))
      }
      case 'CLASSROOM_POST': {
        if (window.visibility && window.visibility !== 'MEMBERS') return []
        const rows = await this.db.classroomPost.findMany({
          where: andWhere({ deletedAt: null, ...(author ? { authorId: author } : {}) }, range('createdAt'), olderThan(cursor, rank)),
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take,
          select: { id: true, classroomId: true, authorId: true, body: true, moderation: true, createdAt: true },
        })
        return rows.map((row) => item(rank, 'CLASSROOM_POST', row.id, row.authorId, 'MEMBERS', row.createdAt, row.createdAt, row.moderation, `/classes/${row.classroomId}`, titleAndExcerpt(null, richText(row.body))))
      }
      case 'QUIZ_CLASS': {
        if (window.visibility && window.visibility !== 'MEMBERS') return []
        const rows = await this.db.classQuiz.findMany({
          where: andWhere({ deletedAt: null, ...(author ? { authorId: author } : {}) }, range('publishedAt'), olderThan(cursor, rank, 'publishedAt')),
          orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
          take,
          select: { id: true, classroomId: true, authorId: true, title: true, publishedAt: true },
        })
        return rows.map((row) => item(rank, 'QUIZ', row.id, row.authorId, 'MEMBERS', row.publishedAt, row.publishedAt, null, `/classes/${row.classroomId}/quizzes/${row.id}`, titleAndExcerpt(row.title, null)))
      }
      case 'QUIZ_SHARED': {
        const visibility = quizVisibility(window.visibility)
        if (!visibility) return []
        const rows = await this.db.sharedQuiz.findMany({
          where: andWhere({ deletedAt: null, ...visibility, ...(author ? { ownerId: author } : {}) }, range('createdAt'), olderThan(cursor, rank)),
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take,
          select: { id: true, ownerId: true, title: true, visibility: true, linkToken: true, createdAt: true, updatedAt: true },
        })
        return rows.map((row) => item(rank, 'QUIZ', row.id, row.ownerId, row.visibility as AdminContentVisibility, row.createdAt, row.updatedAt, null, `/q/${row.linkToken}`, titleAndExcerpt(row.title, null)))
      }
      case 'DOUBT': {
        if (window.visibility && window.visibility !== 'MEMBERS') return []
        const rows = await this.db.doubt.findMany({
          where: andWhere({ deletedAt: null, ...(author ? { authorId: author } : {}) }, range('createdAt'), olderThan(cursor, rank)),
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take,
          select: { id: true, groupId: true, authorId: true, title: true, body: true, moderation: true, createdAt: true, updatedAt: true },
        })
        return rows.map((row) => item(rank, 'DOUBT', row.id, row.authorId, 'MEMBERS', row.createdAt, row.updatedAt, row.moderation, `/groups/${row.groupId}/doubts/${row.id}`, titleAndExcerpt(row.title, richText(row.body))))
      }
      case 'DOUBT_ANSWER': {
        if (window.visibility && window.visibility !== 'MEMBERS') return []
        const rows = await this.db.doubtAnswer.findMany({
          where: andWhere({ deletedAt: null, doubt: { deletedAt: null }, ...(author ? { authorId: author } : {}) }, range('createdAt'), olderThan(cursor, rank)),
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take,
          select: { id: true, authorId: true, body: true, createdAt: true, doubt: { select: { id: true, groupId: true } } },
        })
        return rows.map((row) => item(rank, 'DOUBT_ANSWER', row.id, row.authorId, 'MEMBERS', row.createdAt, row.createdAt, null, `/groups/${row.doubt.groupId}/doubts/${row.doubt.id}`, titleAndExcerpt(null, richText(row.body))))
      }
      case 'SHARE_USER':
      case 'SHARE_GROUP':
      case 'SHARE_CLASS':
        return this.fetchShare(rank, window, cursor, take)
      case 'UPLOAD': {
        if (window.visibility === 'PRIVATE') return []
        const rows = await this.db.fileObject.findMany({
          where: andWhere(this.uploadWhere(author), range('createdAt'), olderThan(cursor, rank)),
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take,
          select: { id: true, ownerId: true, originalFileName: true, parentType: true, parentId: true, createdAt: true, updatedAt: true },
        })
        return rows.map((row) => {
          const link = row.parentType === 'NOTE' && row.parentId ? `/notes/${row.parentId}` : row.parentType === 'RESOURCE' && row.parentId ? `/resources/${row.parentId}` : row.parentType === 'GROUP' && row.parentId ? `/groups/${row.parentId}` : `/u/${row.ownerId}`
          const visibility: AdminContentVisibility = row.parentType === 'GROUP' || row.parentType === 'GROUP_POST' ? 'MEMBERS' : 'PUBLIC'
          return item(rank, 'UPLOAD', row.id, row.ownerId, visibility, row.createdAt, row.updatedAt, null, link, titleAndExcerpt(row.originalFileName, null))
        })
      }
      case 'RESOURCE': {
        if (window.visibility && window.visibility !== 'PUBLIC') return []
        const rows = await this.db.resource.findMany({
          where: andWhere({ ...(author ? { submittedById: author } : {}) }, range('createdAt'), olderThan(cursor, rank)),
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take,
          select: { id: true, submittedById: true, title: true, description: true, status: true, createdAt: true, updatedAt: true },
        })
        return rows.map((row) => item(rank, 'RESOURCE', row.id, row.submittedById, 'PUBLIC', row.createdAt, row.updatedAt, row.status, `/resources/${row.id}`, titleAndExcerpt(row.title, row.description)))
      }
      case 'HIGHLIGHT': {
        const visibility = noteVisibility(window.visibility)
        if (!visibility) return []
        const rows = await this.db.noteHighlight.findMany({
          where: andWhere({ attachment: { note: { deletedAt: null, ...visibility } }, ...(author ? { createdById: author } : {}) }, range('createdAt'), olderThan(cursor, rank)),
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take,
          select: { id: true, noteId: true, createdById: true, quote: true, comment: true, createdAt: true, updatedAt: true, attachment: { select: { note: { select: { visibility: true } } } } },
        })
        return rows.map((row) => item(rank, 'HIGHLIGHT', row.id, row.createdById, row.attachment.note.visibility as AdminContentVisibility, row.createdAt, row.updatedAt, null, `/notes/${row.noteId}`, titleAndExcerpt(null, row.quote ?? row.comment)))
      }
      case 'CONTEST': {
        if (window.visibility && window.visibility !== 'PUBLIC') return []
        const rows = await this.db.contest.findMany({
          where: andWhere({ ...(author ? { createdById: author } : {}) }, range('createdAt'), olderThan(cursor, rank)),
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take,
          select: { id: true, createdById: true, title: true, status: true, createdAt: true, publishedAt: true },
        })
        return rows.map((row) => item(rank, 'CONTEST', row.id, row.createdById, 'PUBLIC', row.createdAt, row.publishedAt ?? row.createdAt, row.status, `/contests/${row.id}`, titleAndExcerpt(row.title, null)))
      }
      default:
        return []
    }
  }

  private async fetchShare(rank: string, window: Window, cursor: Cursor | null, take: number): Promise<Raw[]> {
    const visibility = noteVisibility(window.visibility)
    if (!visibility) return []
    const note = { deletedAt: null, ...visibility }
    const range = onColumn('createdAt', window.from, window.to)
    if (rank === 'SHARE_USER') {
      const rows = await this.db.noteShare.findMany({
        where: andWhere({ note, ...(window.authorId ? { createdById: window.authorId } : {}) }, range, olderThanShare(cursor, rank)),
        orderBy: [{ createdAt: 'desc' }, { noteId: 'desc' }, { userId: 'desc' }],
        take,
        select: { noteId: true, userId: true, createdById: true, createdAt: true, note: { select: { title: true, visibility: true } } },
      })
      return rows.map((row) => item(rank, 'SHARE', `${row.noteId}:${row.userId}`, row.createdById, row.note.visibility as AdminContentVisibility, row.createdAt, row.createdAt, null, `/notes/${row.noteId}`, titleAndExcerpt(row.note.title, null)))
    }
    if (rank === 'SHARE_GROUP') {
      const rows = await this.db.groupShare.findMany({
        where: andWhere({ note, ...(window.authorId ? { sharedById: window.authorId } : {}) }, range, olderThanShare(cursor, rank)),
        orderBy: [{ createdAt: 'desc' }, { noteId: 'desc' }, { groupId: 'desc' }],
        take,
        select: { noteId: true, groupId: true, sharedById: true, createdAt: true, note: { select: { title: true, visibility: true } } },
      })
      return rows.map((row) => item(rank, 'SHARE', `${row.noteId}:${row.groupId}`, row.sharedById, row.note.visibility as AdminContentVisibility, row.createdAt, row.createdAt, null, `/notes/${row.noteId}`, titleAndExcerpt(row.note.title, null)))
    }
    const rows = await this.db.classroomShare.findMany({
      where: andWhere({ note, ...(window.authorId ? { sharedById: window.authorId } : {}) }, range, olderThanShare(cursor, rank)),
      orderBy: [{ createdAt: 'desc' }, { noteId: 'desc' }, { classroomId: 'desc' }],
      take,
      select: { noteId: true, classroomId: true, sharedById: true, createdAt: true, note: { select: { title: true, visibility: true } } },
    })
    return rows.map((row) => item(rank, 'SHARE', `${row.noteId}:${row.classroomId}`, row.sharedById, row.note.visibility as AdminContentVisibility, row.createdAt, row.createdAt, null, `/notes/${row.noteId}`, titleAndExcerpt(row.note.title, null)))
  }

  private uploadWhere(authorId: string | null): object {
    return {
      deletedAt: null,
      purpose: { notIn: [...HIDDEN_FILE_PURPOSES] },
      parentType: { notIn: ['VERIFICATION_REQUEST', 'DATA_EXPORT', 'IMPORT_JOB'] },
      NOT: { visibilitySnapshot: 'PRIVATE' },
      ...(authorId ? { ownerId: authorId } : {}),
    }
  }

  private async countType(type: AdminContentType, window: Window, hidden: string[]): Promise<number> {
    const range = (column: string) => onColumn(column, window.from, window.to)
    switch (type) {
      case 'NOTE':
        return this.db.note.count({ where: andWhere({ deletedAt: null, visibility: PRIVATE_NOTE }, range('createdAt')) })
      case 'COMMENT':
        return this.countComments(range('createdAt'), hidden)
      case 'GROUP':
        return this.db.group.count({ where: andWhere({ deletedAt: null }, range('createdAt')) })
      case 'GROUP_POST':
        return this.db.groupPost.count({ where: andWhere({ deletedAt: null }, range('createdAt')) })
      case 'CLASSROOM':
        return this.db.classroom.count({ where: andWhere({ deletedAt: null }, range('createdAt')) })
      case 'CLASSROOM_POST':
        return this.db.classroomPost.count({ where: andWhere({ deletedAt: null }, range('createdAt')) })
      case 'QUIZ':
        return (await this.db.classQuiz.count({ where: andWhere({ deletedAt: null }, range('publishedAt')) })) + (await this.db.sharedQuiz.count({ where: andWhere({ deletedAt: null, visibility: PRIVATE_NOTE }, range('createdAt')) }))
      case 'DOUBT':
        return this.db.doubt.count({ where: andWhere({ deletedAt: null }, range('createdAt')) })
      case 'DOUBT_ANSWER':
        return this.db.doubtAnswer.count({ where: andWhere({ deletedAt: null, doubt: { deletedAt: null } }, range('createdAt')) })
      case 'SHARE':
        return (await this.db.noteShare.count({ where: andWhere({ note: { deletedAt: null, visibility: PRIVATE_NOTE } }, range('createdAt')) })) + (await this.db.groupShare.count({ where: andWhere({ note: { deletedAt: null, visibility: PRIVATE_NOTE } }, range('createdAt')) })) + (await this.db.classroomShare.count({ where: andWhere({ note: { deletedAt: null, visibility: PRIVATE_NOTE } }, range('createdAt')) }))
      case 'UPLOAD':
        return this.countUploads(range('createdAt'), hidden)
      case 'RESOURCE':
        return this.db.resource.count({ where: range('createdAt') })
      case 'HIGHLIGHT':
        return this.db.noteHighlight.count({ where: andWhere({ attachment: { note: { deletedAt: null, visibility: PRIVATE_NOTE } } }, range('createdAt')) })
      case 'CONTEST':
        return this.db.contest.count({ where: range('createdAt') })
    }
  }

  private async countComments(range: object, hidden: string[]): Promise<number> {
    const where = andWhere({ deletedAt: null, visibleTo: null }, range)
    const total = await this.db.comment.count({ where })
    if (!hidden.length) return total
    const onHidden = await this.db.comment.count({ where: andWhere(where, { targetType: 'NOTE', targetId: { in: hidden } }) })
    return total - onHidden
  }

  private async countUploads(range: object, hidden: string[]): Promise<number> {
    const where = andWhere(this.uploadWhere(null), range)
    const total = await this.db.fileObject.count({ where })
    if (!hidden.length) return total
    const [byParent, attachments, images] = await Promise.all([
      this.db.fileObject.findMany({ where: andWhere(where, { parentType: 'NOTE', parentId: { in: hidden } }), select: { id: true } }),
      this.db.noteAttachment.findMany({ where: { noteId: { in: hidden } }, select: { fileId: true } }),
      this.db.notePageImage.findMany({ where: { page: { noteId: { in: hidden } } }, select: { fileId: true } }),
    ])
    const ids = [...new Set([...byParent.map((row) => row.id), ...attachments.map((row) => row.fileId), ...images.map((row) => row.fileId)])]
    if (!ids.length) return total
    const eligible = await this.db.fileObject.count({ where: andWhere(where, { id: { in: ids } }) })
    return total - eligible
  }

  private async hiddenNoteIds(): Promise<string[]> {
    const rows = await this.db.note.findMany({ where: { OR: [{ visibility: 'PRIVATE' }, { deletedAt: { not: null } }] }, select: { id: true } })
    return rows.map((row) => row.id)
  }

  private async authors(ids: string[]): Promise<Map<string, { id: string; handle: string; email: string }>> {
    const unique = [...new Set(ids)]
    if (!unique.length) return new Map()
    const rows = await this.db.user.findMany({ where: { id: { in: unique } }, select: { id: true, handle: true, email: true } })
    return new Map(rows.map((row) => [row.id, row]))
  }

  private toItem(row: Raw & { author: AdminContentItem['author'] }): AdminContentItem {
    return { id: row.id, type: row.type, title: row.title, excerpt: row.excerpt, author: row.author, visibility: row.visibility, createdAt: row.createdAt, updatedAt: row.updatedAt, moderation: row.moderation, deepLink: row.deepLink }
  }
}

function item(rank: string, type: AdminContentType, id: string, authorId: string, visibility: AdminContentVisibility, createdAt: Date, updatedAt: Date, moderation: string | null, deepLink: string, text: { title: string | null; excerpt: string | null }): Raw {
  return { rank, type, id, authorId, visibility, createdAt, updatedAt, moderation, deepLink, title: text.title, excerpt: text.excerpt }
}

function noteVisibility(visibility: AdminContentVisibility | null): { visibility: AdminContentVisibility | typeof PRIVATE_NOTE } | null {
  if (visibility === 'PRIVATE' || visibility === 'MEMBERS') return null
  if (visibility) return { visibility }
  return { visibility: PRIVATE_NOTE }
}

function quizVisibility(visibility: AdminContentVisibility | null): { visibility: AdminContentVisibility | typeof PRIVATE_NOTE } | null {
  if (!visibility) return { visibility: PRIVATE_NOTE }
  if (visibility === 'PUBLIC' || visibility === 'UNLISTED') return { visibility }
  return null
}

function matches(actual: AdminContentVisibility, wanted: AdminContentVisibility | null): boolean {
  return !wanted || actual === wanted
}

function ranksFor(type: AdminContentType | null): string[] {
  if (!type) return ['NOTE', 'COMMENT', 'GROUP', 'GROUP_POST', 'CLASSROOM', 'CLASSROOM_POST', 'QUIZ_CLASS', 'QUIZ_SHARED', 'DOUBT', 'DOUBT_ANSWER', 'SHARE_USER', 'SHARE_GROUP', 'SHARE_CLASS', 'UPLOAD', 'RESOURCE', 'HIGHLIGHT', 'CONTEST']
  if (type === 'QUIZ') return ['QUIZ_CLASS', 'QUIZ_SHARED']
  if (type === 'SHARE') return ['SHARE_USER', 'SHARE_GROUP', 'SHARE_CLASS']
  return [type]
}

function byRank(a: Raw, b: Raw): number {
  const time = b.createdAt.getTime() - a.createdAt.getTime()
  if (time) return time
  if (a.rank !== b.rank) return a.rank < b.rank ? 1 : -1
  if (a.id !== b.id) return a.id < b.id ? 1 : -1
  return 0
}

function afterCursor(row: Raw, cursor: Cursor | null): boolean {
  if (!cursor) return true
  if (row.createdAt < cursor.at) return true
  if (row.createdAt > cursor.at) return false
  if (row.rank < cursor.rank) return true
  if (row.rank > cursor.rank) return false
  return row.id < cursor.id
}

function readCursor(after: string | null | undefined): Cursor | null {
  const raw = decodeCursor(after, 3)
  if (!raw) return null
  const [at, rank, id] = raw
  if (typeof at !== 'string' || typeof rank !== 'string' || typeof id !== 'string') throw Errors.validation('This page link is not valid. Start from the first page.', ['after'])
  const date = new Date(at)
  if (Number.isNaN(date.getTime())) throw Errors.validation('This page link is not valid. Start from the first page.', ['after'])
  return { at: date, rank, id }
}

function instant(value: Date | string | null | undefined, field: string): Date | null {
  if (value == null || value === '') return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) throw Errors.validation('Use an ISO-8601 date-time.', ['filter', field])
  return date
}

function onColumn(column: string, from: Date | null, to: Date | null): object {
  if (!from && !to) return {}
  return { [column]: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
}

function olderThan(cursor: Cursor | null, rank: string, column = 'createdAt'): object {
  if (!cursor) return {}
  if (rank > cursor.rank) return { [column]: { lt: cursor.at } }
  if (rank < cursor.rank) return { OR: [{ [column]: { lt: cursor.at } }, { [column]: cursor.at }] }
  return { OR: [{ [column]: { lt: cursor.at } }, { [column]: cursor.at, id: { lt: cursor.id } }] }
}

function olderThanShare(cursor: Cursor | null, rank: string): object {
  if (!cursor) return {}
  if (rank > cursor.rank) return { createdAt: { lt: cursor.at } }
  if (rank < cursor.rank) return { OR: [{ createdAt: { lt: cursor.at } }, { createdAt: cursor.at }] }
  const split = cursor.id.split(':')
  const noteId = split[0]
  const other = split[1]
  if (!noteId || !other) return { createdAt: { lt: cursor.at } }
  const second = rank === 'SHARE_USER' ? 'userId' : rank === 'SHARE_GROUP' ? 'groupId' : 'classroomId'
  return { OR: [{ createdAt: { lt: cursor.at } }, { createdAt: cursor.at, noteId: { lt: noteId } }, { createdAt: cursor.at, noteId, [second]: { lt: other } }] }
}

function andWhere(...parts: object[]): object {
  const present = parts.filter((part) => Object.keys(part).length > 0)
  if (!present.length) return {}
  if (present.length === 1) return present[0]!
  return { AND: present }
}
