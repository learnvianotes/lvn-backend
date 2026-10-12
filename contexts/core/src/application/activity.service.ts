import { Inject, Injectable } from '@nestjs/common'
import { NOTE_ACCESS, PEOPLE, type NoteAccess, type People } from '@lvn-backend/facades'
import { decodeCursor, pageSize } from '@lvn-backend/graphql'
import { PrismaService, type Prisma } from '@lvn-backend/prisma-base'

export type ActivityKind = 'GROUP_POST' | 'IDEA' | 'DOUBT' | 'CLASS_ANNOUNCEMENT' | 'SHARED_NOTE'

export interface ActivityItem {
  /** The source's id (a post, doubt, announcement, or the shared note) */
  id: string
  kind: ActivityKind
  at: Date
  actorId: string
  groupId: string | null
  classroomId: string | null
  /** The row behind it, for the GraphQL types that render it */
  post?: Prisma.GroupPostGetPayload<object>
  announcement?: Prisma.ClassroomPostGetPayload<object>
  doubt?: Prisma.DoubtGetPayload<object>
  noteId?: string
}

const PLACES = 200

/**
 * The activity of the viewer's groups and classes (ADR-0049), read at request time: each source gives its newest
 * rows before the cursor, and the sources are merged. Notes shared to a place come from `notes`, which applies its read
 * rule. The viewer's own doing and blocked people are left out (ADR-0016).
 */
@Injectable()
export class ActivityService {
  constructor(
    private readonly db: PrismaService,
    @Inject(NOTE_ACCESS) private readonly notes: NoteAccess,
    @Inject(PEOPLE) private readonly people: People,
  ) {}

  async page(viewerId: string, first: number | null | undefined, after: string | null | undefined): Promise<{ items: ActivityItem[]; size: number }> {
    const size = pageSize(first, 50)
    const take = size + 1
    const cursor = decodeCursor(after, 2) as [string, string] | null
    const before = cursor ? { at: new Date(cursor[0]), id: cursor[1] } : null
    const page = before ? { OR: [{ createdAt: { lt: before.at } }, { createdAt: before.at, id: { lt: before.id } }] } : {}
    const order = [{ createdAt: 'desc' as const }, { id: 'desc' as const }]

    const [groups, classes, blocked] = await Promise.all([
      this.db.groupMember.findMany({ where: { userId: viewerId, group: { deletedAt: null } }, orderBy: { group: { updatedAt: 'desc' } }, select: { groupId: true }, take: PLACES }),
      this.db.classroomMember.findMany({ where: { userId: viewerId, classroom: { deletedAt: null } }, orderBy: { classroom: { updatedAt: 'desc' } }, select: { classroomId: true }, take: PLACES }),
      this.people.blockedIds(viewerId),
    ])
    const groupIds = groups.map((g) => g.groupId)
    const classroomIds = classes.map((c) => c.classroomId)
    if (!groupIds.length && !classroomIds.length) return { items: [], size }
    const authors = { notIn: [viewerId, ...blocked] }

    const [posts, doubts, announcements, shares] = await Promise.all([
      groupIds.length ? this.db.groupPost.findMany({ where: { groupId: { in: groupIds }, deletedAt: null, authorId: authors, ...page }, orderBy: order, take }) : [],
      groupIds.length ? this.db.doubt.findMany({ where: { groupId: { in: groupIds }, deletedAt: null, authorId: authors, ...page }, orderBy: order, take }) : [],
      classroomIds.length ? this.db.classroomPost.findMany({ where: { classroomId: { in: classroomIds }, deletedAt: null, authorId: authors, ...page }, orderBy: order, take }) : [],
      this.notes.placeShares(viewerId, { groupIds, classroomIds }, before, take),
    ])
    const items: ActivityItem[] = [
      ...posts.map((p): ActivityItem => ({ id: p.id, kind: p.kind === 'IDEA' ? 'IDEA' : 'GROUP_POST', at: p.createdAt, actorId: p.authorId, groupId: p.groupId, classroomId: null, post: p })),
      ...doubts.map((d): ActivityItem => ({ id: d.id, kind: 'DOUBT', at: d.createdAt, actorId: d.authorId, groupId: d.groupId, classroomId: null, doubt: d })),
      ...announcements.map((a): ActivityItem => ({ id: a.id, kind: 'CLASS_ANNOUNCEMENT', at: a.createdAt, actorId: a.authorId, groupId: null, classroomId: a.classroomId, announcement: a })),
      ...shares
        .filter((s) => s.sharedBy !== viewerId && !blocked.includes(s.sharedBy))
        .map((s): ActivityItem => ({ id: s.noteId, kind: 'SHARED_NOTE', at: s.at, actorId: s.sharedBy, groupId: s.groupId, classroomId: s.classroomId, noteId: s.noteId })),
    ]
    items.sort((a, b) => b.at.getTime() - a.at.getTime() || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0))
    return { items: items.slice(0, take), size }
  }
}
