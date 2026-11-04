import { Injectable } from '@nestjs/common'
import type { AdminDayWindow, FilePurposeKind, NotesAdminStats as NotesAdminStatsPort, NotesContentStats, SubjectActivity } from '@lvn-backend/facades'
import { Prisma, PrismaService } from '@lvn-backend/prisma-base'
import { STUDY_PUBLISHER_ID } from './study-content-sync'

/** Files that have bytes in storage. Pending uploads, failures and deletions do not. */
const STORED = ['UPLOADED', 'PROCESSING', 'READY', 'QUARANTINED'] as const

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Notes a person wrote: not the synced study pages (ADR-0098), which belong to the publisher account and arrive on
 * deploy. `n` is the Note alias.
 */
const PEOPLES_NOTES = Prisma.sql`n."ownerId" <> ${STUDY_PUBLISHER_ID}::uuid AND NOT EXISTS (SELECT 1 FROM "notes"."LegacyContentItem" l WHERE l."noteId" = n.id)`

/** Note, subject and storage totals for the admin dashboard (ADR-0101, ADR-0105). Counts only. */
@Injectable()
export class NotesAdminStats implements NotesAdminStatsPort {
  constructor(private readonly db: PrismaService) {}

  async counts(): Promise<{ notes: number; publicNotes: number; subjects: number; topics: number; storageFiles: number; storageBytes: bigint; pendingScans: number; failedScans: number }> {
    const stored = { deletedAt: null, status: { in: [...STORED] } }
    const [notes, publicNotes, subjects, topics, storageFiles, storage, pendingScans, failedScans] = await Promise.all([
      this.db.note.count({ where: { deletedAt: null } }),
      this.db.note.count({ where: { deletedAt: null, visibility: 'PUBLIC' } }),
      this.db.subject.count(),
      this.db.topic.count(),
      this.db.fileObject.count({ where: stored }),
      this.db.fileObject.aggregate({ where: stored, _sum: { sizeBytes: true } }),
      this.db.fileObject.count({ where: { deletedAt: null, scanResult: 'PENDING' } }),
      this.db.fileObject.count({ where: { deletedAt: null, scanResult: 'FAILED' } }),
    ])
    return { notes, publicNotes, subjects, topics, storageFiles, storageBytes: storage._sum.sizeBytes ?? 0n, pendingScans, failedScans }
  }

  async notesPerDay(w: AdminDayWindow): Promise<{ day: string; notes: number }[]> {
    return this.db.$queryRaw<{ day: string; notes: number }[]>`
      SELECT to_char(n."createdAt" AT TIME ZONE ${w.timeZone}, 'YYYY-MM-DD') AS day, count(*)::int AS notes
      FROM "notes"."Note" n
      WHERE n."createdAt" >= ${w.from} AND n."createdAt" < ${w.to} AND n."deletedAt" IS NULL AND ${PEOPLES_NOTES}
      GROUP BY 1`
  }

  async content(w: AdminDayWindow): Promise<NotesContentStats> {
    const [notes, uploads, scans, sharing] = await Promise.all([
      this.db.$queryRaw<{ created: number; public: number; unlisted: number; shared: number; private: number }[]>`
        SELECT count(*)::int AS created,
               count(*) FILTER (WHERE n.visibility = 'PUBLIC')::int AS public,
               count(*) FILTER (WHERE n.visibility = 'UNLISTED')::int AS unlisted,
               count(*) FILTER (WHERE n.visibility = 'SHARED')::int AS shared,
               count(*) FILTER (WHERE n.visibility = 'PRIVATE')::int AS private
        FROM "notes"."Note" n
        WHERE n."createdAt" >= ${w.from} AND n."createdAt" < ${w.to} AND n."deletedAt" IS NULL AND ${PEOPLES_NOTES}`,
      // Uploads people made that are still stored. Data exports are files the server wrote, not uploads.
      this.db.$queryRaw<{ purpose: FilePurposeKind; files: number; bytes: string; users: number }[]>`
        SELECT f.purpose::text AS purpose, count(*)::int AS files, coalesce(sum(f."sizeBytes"), 0)::text AS bytes, count(DISTINCT f."ownerId")::int AS users
        FROM "notes"."FileObject" f
        WHERE f."createdAt" >= ${w.from} AND f."createdAt" < ${w.to} AND f."deletedAt" IS NULL
          AND f.status::text IN (${Prisma.join([...STORED])}) AND f.purpose <> 'EXPORT'
        GROUP BY f.purpose`,
      this.db.$queryRaw<{ clean: number; infected: number; failed: number; pending: number }[]>`
        SELECT count(*) FILTER (WHERE f."scanResult" = 'CLEAN')::int AS clean,
               count(*) FILTER (WHERE f."scanResult" = 'INFECTED')::int AS infected,
               count(*) FILTER (WHERE f."scanResult" IN ('ERROR', 'FAILED'))::int AS failed,
               count(*) FILTER (WHERE f."scanResult" = 'PENDING')::int AS pending
        FROM "notes"."FileObject" f
        WHERE f."createdAt" >= ${w.from} AND f."createdAt" < ${w.to} AND f."deletedAt" IS NULL
          AND f.status::text IN (${Prisma.join([...STORED])}) AND f.purpose <> 'EXPORT'`,
      // CONNECTIONS rows are one owner's "share with my connections" fanned out to each connection: not a share each.
      this.db.$queryRaw<{ noteShares: number; groupShares: number; classroomShares: number; saves: number }[]>`
        SELECT (SELECT count(*) FROM "notes"."NoteShare" WHERE "createdAt" >= ${w.from} AND "createdAt" < ${w.to} AND source = 'DIRECT')::int AS "noteShares",
               (SELECT count(*) FROM "notes"."GroupShare" WHERE "createdAt" >= ${w.from} AND "createdAt" < ${w.to})::int AS "groupShares",
               (SELECT count(*) FROM "notes"."ClassroomShare" WHERE "createdAt" >= ${w.from} AND "createdAt" < ${w.to})::int AS "classroomShares",
               (SELECT count(*) FROM "notes"."NoteSave" WHERE "createdAt" >= ${w.from} AND "createdAt" < ${w.to})::int AS saves`,
    ])
    const byPurpose = uploads
      .map((row) => ({ purpose: row.purpose, files: row.files, bytes: BigInt(row.bytes), users: row.users }))
      .sort((a, b) => b.files - a.files || a.purpose.localeCompare(b.purpose))
    const n = notes[0] ?? { created: 0, public: 0, unlisted: 0, shared: 0, private: 0 }
    const s = sharing[0] ?? { noteShares: 0, groupShares: 0, classroomShares: 0, saves: 0 }
    return {
      notes: { created: n.created, public: n.public, unlisted: n.unlisted, shared: n.shared, private: n.private },
      uploads: { files: byPurpose.reduce((sum, row) => sum + row.files, 0), bytes: byPurpose.reduce((sum, row) => sum + row.bytes, 0n), byPurpose },
      scans: scans[0] ?? { clean: 0, infected: 0, failed: 0, pending: 0 },
      sharing: { noteShares: s.noteShares, placeShares: s.groupShares + s.classroomShares, saves: s.saves },
    }
  }

  async subjectActivity(w: AdminDayWindow, by: 'NOTES' | 'SAVES'): Promise<SubjectActivity[]> {
    if (by === 'NOTES') {
      return this.db.$queryRaw<SubjectActivity[]>`
        SELECT s.id AS "subjectId", s.title, count(DISTINCT n.id)::int AS value, count(DISTINCT n."ownerId")::int AS users
        FROM "notes"."Note" n
        JOIN "notes"."NoteTopic" nt ON nt."noteId" = n.id
        JOIN "notes"."Topic" t ON t.id = nt."topicId"
        JOIN "notes"."Subject" s ON s.id = t."subjectId"
        WHERE n."createdAt" >= ${w.from} AND n."createdAt" < ${w.to} AND n."deletedAt" IS NULL AND ${PEOPLES_NOTES}
        GROUP BY s.id, s.title`
    }
    // A save of a note with two topics in one subject is one save of that subject.
    return this.db.$queryRaw<SubjectActivity[]>`
      SELECT s.id AS "subjectId", s.title, count(DISTINCT (ns."noteId", ns."userId"))::int AS value, count(DISTINCT ns."userId")::int AS users
      FROM "notes"."NoteSave" ns
      JOIN "notes"."NoteTopic" nt ON nt."noteId" = ns."noteId"
      JOIN "notes"."Topic" t ON t.id = nt."topicId"
      JOIN "notes"."Subject" s ON s.id = t."subjectId"
      WHERE ns."createdAt" >= ${w.from} AND ns."createdAt" < ${w.to}
      GROUP BY s.id, s.title`
  }

  async subjectsOfTopicKeys(keys: string[]): Promise<{ key: string; subjectId: string; title: string }[]> {
    const topicIds = new Map<string, string>()
    const subjectSlugs = new Map<string, string[]>()
    for (const key of new Set(keys)) {
      if (key.startsWith('topic:')) {
        const id = key.slice('topic:'.length)
        if (UUID.test(id)) topicIds.set(key, id.toLowerCase())
      } else if (key.startsWith('core:')) {
        // core:<subject>/<topic>: the curated subjects came from the /core catalog under the same slug.
        const slug = key.slice('core:'.length).split('/')[0]
        if (slug) subjectSlugs.set(slug, [...(subjectSlugs.get(slug) ?? []), key])
      }
    }
    const [topics, subjects] = await Promise.all([
      topicIds.size ? this.db.topic.findMany({ where: { id: { in: [...new Set(topicIds.values())] } }, select: { id: true, subject: { select: { id: true, title: true } } } }) : [],
      subjectSlugs.size ? this.db.subject.findMany({ where: { slug: { in: [...subjectSlugs.keys()] } }, select: { id: true, slug: true, title: true } }) : [],
    ])
    const topicSubject = new Map(topics.map((t) => [t.id, t.subject]))
    const out: { key: string; subjectId: string; title: string }[] = []
    for (const [key, id] of topicIds) {
      const subject = topicSubject.get(id)
      if (subject) out.push({ key, subjectId: subject.id, title: subject.title })
    }
    for (const subject of subjects) for (const key of subjectSlugs.get(subject.slug) ?? []) out.push({ key, subjectId: subject.id, title: subject.title })
    return out
  }

  async firstNotes(userIds: string[]): Promise<{ userId: string; at: Date }[]> {
    if (!userIds.length) return []
    return this.db.$queryRaw<{ userId: string; at: Date }[]>`
      SELECT n."ownerId"::text AS "userId", min(n."createdAt") AS at
      FROM "notes"."Note" n
      WHERE n."ownerId" = ANY(${userIds}::uuid[]) AND ${PEOPLES_NOTES}
      GROUP BY n."ownerId"`
  }
}
