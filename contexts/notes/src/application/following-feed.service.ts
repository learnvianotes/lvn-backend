import { Inject, Injectable } from '@nestjs/common'
import { PEOPLE, type People } from '@lvn-backend/facades'
import { decodeCursor, pageSize } from '@lvn-backend/graphql'
import { PrismaService } from '@lvn-backend/prisma-base'
import { visibleNotesWhere } from '../domain/note-access'

/**
 * The Following feed (ADR-0049): PUBLIC notes and publications of the people the viewer follows, newest published
 * first, read at request time with the public read predicate; blocked people left out (ADR-0016).
 */
@Injectable()
export class FollowingFeedService {
  constructor(
    private readonly db: PrismaService,
    @Inject(PEOPLE) private readonly people: People,
  ) {}

  async page(viewerId: string, first: number | null | undefined, after: string | null | undefined) {
    const size = pageSize(first, 50)
    const [following, blocked] = await Promise.all([this.people.followingIds(viewerId), this.people.blockedIds(viewerId)])
    const owners = following.filter((id) => !blocked.includes(id))
    if (!owners.length) return { rows: [], size }
    const cursor = decodeCursor(after, 2) as [string, string] | null
    const rows = await this.db.note.findMany({
      where: {
        AND: [
          visibleNotesWhere(null),
          { ownerId: { in: owners } },
          ...(cursor ? [{ OR: [{ publishedAt: { lt: new Date(cursor[0]) } }, { publishedAt: new Date(cursor[0]), id: { lt: cursor[1] } }] }] : []),
        ],
      },
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      take: size + 1,
    })
    return { rows, size }
  }
}
