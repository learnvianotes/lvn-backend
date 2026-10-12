import { Injectable } from '@nestjs/common'
import type { ClassroomForSearch, GroupForSearch, Places } from '@lvn-backend/facades'
import { PrismaService, type Prisma } from '@lvn-backend/prisma-base'
import { ClassroomsService } from './classrooms.service'

/** Every word in the name or the description (case-insensitive), as the Postgres search provider matches places. */
const holdsEvery = (words: string[]) =>
  words.map((w) => ({ OR: [{ name: { contains: w, mode: 'insensitive' as const } }, { description: { contains: w, mode: 'insensitive' as const } }] }))

/**
 * The PLACES facade (ADR-0050, ADR-0056): groups and classes as other contexts need them — names for messages, and
 * what search indexes and finds. Deleted and removed places are never given out.
 */
@Injectable()
export class PlacesService implements Places {
  constructor(
    private readonly db: PrismaService,
    private readonly classrooms: ClassroomsService,
  ) {}

  classroomNames(ids: string[]): Promise<Record<string, string>> {
    return this.classrooms.classroomNames(ids)
  }

  announcement(postId: string) {
    return this.classrooms.announcement(postId)
  }

  async groupsForSearch(ids: string[]): Promise<GroupForSearch[]> {
    if (!ids.length) return []
    const rows = await this.db.group.findMany({ where: { id: { in: ids }, deletedAt: null }, include: { _count: { select: { members: true } } } })
    return rows.map((g) => ({ id: g.id, name: g.name, description: g.description, type: g.type, privacy: g.privacy, memberCount: g._count.members }))
  }

  async classroomsForSearch(ids: string[]): Promise<ClassroomForSearch[]> {
    if (!ids.length) return []
    const rows = await this.db.classroom.findMany({ where: { id: { in: ids }, deletedAt: null }, include: { _count: { select: { members: true } } } })
    return rows.map((c) => ({ id: c.id, name: c.name, description: c.description, memberCount: c._count.members }))
  }

  async placeIdsAfter(kind: 'GROUP' | 'CLASSROOM', after: string | null, take: number): Promise<string[]> {
    const where = after ? { id: { gt: after } } : {}
    const rows = kind === 'GROUP' ? await this.db.group.findMany({ where, select: { id: true }, orderBy: { id: 'asc' }, take }) : await this.db.classroom.findMany({ where, select: { id: true }, orderBy: { id: 'asc' }, take })
    return rows.map((r) => r.id)
  }

  async findGroups(words: string[], memberOf: string[], take: number): Promise<string[]> {
    const where: Prisma.GroupWhereInput = { deletedAt: null, AND: [{ OR: [{ privacy: 'PUBLIC' }, { id: { in: memberOf } }] }, ...holdsEvery(words)] }
    const rows = await this.db.group.findMany({ where, select: { id: true }, orderBy: [{ members: { _count: 'desc' } }, { name: 'asc' }], take })
    return rows.map((r) => r.id)
  }

  async findClassrooms(words: string[], memberOf: string[], take: number): Promise<string[]> {
    if (!memberOf.length) return []
    const rows = await this.db.classroom.findMany({ where: { deletedAt: null, id: { in: memberOf }, AND: holdsEvery(words) }, select: { id: true }, orderBy: { name: 'asc' }, take })
    return rows.map((r) => r.id)
  }
}
