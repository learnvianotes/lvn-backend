import { Inject, Injectable } from '@nestjs/common'
import { TOPICS, type ResourceForSearch, type ResourceSearch, type Topics } from '@lvn-backend/facades'
import { PrismaService } from '@lvn-backend/prisma-base'

/** Curated topics are everyone's: any id finds them through TOPICS.usable. */
const NOBODY = '00000000-0000-0000-0000-000000000000'

/** The RESOURCE_SEARCH facade (ADR-0075): approved resources for notes' search, and nothing else. */
@Injectable()
export class ResourceSearchFacade implements ResourceSearch {
  constructor(
    private readonly db: PrismaService,
    @Inject(TOPICS) private readonly topics: Topics,
  ) {}

  async find(terms: string[], hiddenSubmitterIds: string[], size: number): Promise<string[]> {
    if (!terms.length) return []
    const rows = await this.db.resource.findMany({
      where: {
        status: 'APPROVED',
        ...(hiddenSubmitterIds.length ? { submittedById: { notIn: hiddenSubmitterIds } } : {}),
        AND: terms.map((w) => ({ OR: [{ title: { contains: w, mode: 'insensitive' as const } }, { author: { contains: w, mode: 'insensitive' as const } }, { description: { contains: w, mode: 'insensitive' as const } }] })),
      },
      orderBy: [{ saves: { _count: 'desc' } }, { createdAt: 'desc' }],
      take: size,
      select: { id: true },
    })
    return rows.map((r) => r.id)
  }

  async forSearch(ids: string[]): Promise<ResourceForSearch[]> {
    if (!ids.length) return []
    const rows = await this.db.resource.findMany({ where: { id: { in: ids }, status: 'APPROVED' }, include: { topics: true, _count: { select: { saves: true } } } })
    const titles = new Map((await this.topics.usable(NOBODY, [...new Set(rows.flatMap((r) => r.topics.map((t) => t.topicId)))])).map((t) => [t.id, t.title]))
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      author: r.author,
      description: r.description,
      topics: r.topics.flatMap((t) => (titles.has(t.topicId) ? [titles.get(t.topicId)!] : [])),
      saveCount: r._count.saves,
      submittedById: r.submittedById,
      createdAt: r.createdAt,
    }))
  }

  async idsAfter(after: string | null, take: number): Promise<string[]> {
    return (await this.db.resource.findMany({ where: after ? { id: { gt: after } } : {}, orderBy: { id: 'asc' }, take, select: { id: true } })).map((r) => r.id)
  }
}
