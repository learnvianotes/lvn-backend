import { Injectable } from '@nestjs/common'
import type { TopicRef, Topics } from '@lvn-backend/facades'
import { PrismaService, type Prisma } from '@lvn-backend/prisma-base'

type Row = Prisma.TopicGetPayload<{ include: { subject: true; children: { select: { id: true }; take: 1 } } }>

/** The TOPICS facade (libs/facades, ADR-0070): topics a viewer may use, found by id or words, and the topics of notes. */
@Injectable()
export class TopicsFacade implements Topics {
  constructor(private readonly db: PrismaService) {}

  private usableWhere(viewerId: string): Prisma.TopicWhereInput {
    return { OR: [{ origin: 'CURATED' }, { proposedById: viewerId }] }
  }

  private ref(t: Row): TopicRef {
    // A curated topic with no children is a /core page (scripts/curated-topics.mjs: groups became parents).
    const page = t.origin === 'CURATED' && !t.children.length
    return { id: t.id, key: `topic:${t.id}`, title: t.title, subjectTitle: t.subject.title, coreKey: page ? `core:${t.subject.slug}/${t.slug}` : null }
  }

  async usable(viewerId: string, ids: string[]): Promise<TopicRef[]> {
    if (!ids.length) return []
    const rows = await this.db.topic.findMany({ where: { id: { in: ids }, ...this.usableWhere(viewerId) }, include: { subject: true, children: { select: { id: true }, take: 1 } } })
    const byId = new Map(rows.map((r) => [r.id, r]))
    return ids.flatMap((id) => (byId.has(id) ? [this.ref(byId.get(id)!)] : []))
  }

  async find(viewerId: string, query: string): Promise<TopicRef[]> {
    const words = query.trim().split(/\s+/).filter(Boolean).slice(0, 5)
    if (!words.length) return []
    const rows = await this.db.topic.findMany({
      where: { AND: [this.usableWhere(viewerId), ...words.map((w) => ({ title: { contains: w, mode: 'insensitive' as const } }))] },
      include: { subject: true, children: { select: { id: true }, take: 1 } },
      orderBy: [{ origin: 'asc' }, { title: 'asc' }],
      take: 20,
    })
    return rows.map((r) => this.ref(r))
  }

  async ofNotes(noteIds: string[]): Promise<Map<string, string[]>> {
    const out = new Map<string, string[]>()
    if (!noteIds.length) return out
    for (const l of await this.db.noteTopic.findMany({ where: { noteId: { in: noteIds } }, select: { noteId: true, topicId: true } })) out.set(l.noteId, [...(out.get(l.noteId) ?? []), l.topicId])
    return out
  }
}
