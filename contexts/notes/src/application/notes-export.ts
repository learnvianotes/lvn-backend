import { Injectable } from '@nestjs/common'
import { slugify } from '@lvn/contracts/validation'
import type { CardType } from '@lvn/contracts/domain'
import type { DataExportPart, ExportFile } from '@lvn-backend/facades'
import { PrismaService } from '@lvn-backend/prisma-base'
import { Storage } from '@lvn-backend/storage'
import { stringify } from 'yaml'
import { cardToMarkdown } from '../domain/markdown'
import { mediaFileId } from './attachments.service'
import type { SnapshotCard } from './drafts.service'

const text = (s: string) => new TextEncoder().encode(s)
const json = (v: unknown) => text(JSON.stringify(v, null, 2))

/**
 * The notes part of a data export (ADR-0018): every note the person owns, of every kind, in the trash too — the draft
 * as Markdown with front matter (`index.md`, what other apps and the importer read), the draft and every version as
 * card JSON (`note.json`, lossless), and the files its cards show (`media/`). Folders, tags, topics, shares granted and
 * fork credits come along; other people's notes do not.
 */
@Injectable()
export class NotesExport implements DataExportPart {
  constructor(
    private readonly db: PrismaService,
    private readonly storage: Storage,
  ) {}

  async exportFor(userId: string, budgetBytes: number) {
    const [notes, folders, tags] = await Promise.all([
      this.db.note.findMany({
        where: { ownerId: userId },
        include: {
          tags: { include: { tag: true } },
          topics: { include: { topic: { include: { subject: true } } } },
          versions: { orderBy: { number: 'asc' } },
          shares: true,
          attachments: { include: { file: true } },
          cards: { where: { deletedAt: null }, orderBy: [{ position: 'asc' }, { id: 'asc' }] },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.db.folder.findMany({ where: { ownerId: userId } }),
      this.db.tag.findMany({ where: { ownerId: userId } }),
    ])
    const folderById = new Map(folders.map((f) => [f.id, f]))
    const folderPath = (id: string | null): string[] => {
      const out: string[] = []
      for (let f = id ? folderById.get(id) : undefined; f; f = f.parentId ? folderById.get(f.parentId) : undefined) out.unshift(f.name)
      return out
    }
    const origins = await this.db.note.findMany({ where: { id: { in: notes.flatMap((n) => (n.forkedFromNoteId ? [n.forkedFromNoteId] : [])) } }, select: { id: true, title: true } })
    const originTitle = new Map(origins.map((o) => [o.id, o.title]))

    const files: ExportFile[] = []
    const omitted: string[] = []
    let budget = budgetBytes
    for (const note of notes) {
      const base = `${slugify(note.title) || 'untitled'}-${note.id.slice(-8)}`
      const dir = `notes/${note.kind}/${base}`
      // Media first: cards point at the archive paths of the files that fit.
      const media = new Map<string, { path: string; name: string }>()
      for (const { file } of note.attachments) {
        if (file.deletedAt || file.status !== 'READY') continue
        const name = `${file.id.slice(-8)}-${file.originalFileName.replace(/[\\/]/g, '_')}`
        const size = Number(file.sizeBytes)
        if (size > budget) {
          omitted.push(`${dir}/media/${name} (${Math.round(size / 1024 ** 2)} MB: too large for this export; open the note to download it)`)
          continue
        }
        budget -= size
        files.push({ path: `${dir}/media/${name}`, bytes: await this.storage.getBytes(file.bucket, file.storageKey, size) })
        media.set(file.id, { path: `media/${name}`, name: file.originalFileName })
      }
      // Everything the credit and its rule need (ADR-0010): an import restores both.
      const forkedFrom = note.forkedFromOwnerId
        ? { noteId: note.forkedFromNoteId, versionId: note.forkedFromVersionId, ownerId: note.forkedFromOwnerId, title: note.forkedFromNoteId ? (originTitle.get(note.forkedFromNoteId) ?? null) : null, originVisibility: note.forkedFromVisibility, forkedAs: note.forkedAsRole }
        : null
      const front = {
        title: note.title,
        id: note.id,
        kind: note.kind,
        visibility: note.visibility,
        folder: folderPath(note.folderId).join('/') || undefined,
        tags: note.tags.map((t) => t.tag.name),
        topics: note.topics.map((t) => `${t.topic.subject.title} / ${t.topic.title}`),
        created: note.createdAt.toISOString(),
        updated: note.draftUpdatedAt.toISOString(),
        published: note.publishedAt?.toISOString(),
        trashed: note.deletedAt?.toISOString(),
        moderation: note.moderation === 'OK' ? undefined : { state: note.moderation, reason: note.moderationReason },
        forkedFrom: forkedFrom ?? undefined,
      }
      const body = note.cards
        .map((c) => cardToMarkdown(c.type as CardType, c.content, (id) => media.get(id) ?? null))
        .filter((s) => s.trim())
        .join('\n\n')
      files.push({ path: `${dir}/index.md`, bytes: text(`---\n${stringify(front)}---\n\n# ${note.title || 'Untitled note'}\n\n${body}\n`) })
      files.push({
        path: `${dir}/note.json`,
        bytes: json({
          format: 'lvn-note/1',
          ...front,
          topicIds: note.topics.map((t) => t.topicId),
          sharedWith: note.shares.map((s) => ({ userId: s.userId, role: s.role, since: s.createdAt })),
          forkingEnabled: note.forkingEnabled,
          draft: note.cards.map((c) => ({ id: c.id, type: c.type, position: c.position, content: c.content, media: mediaFileId(c.type as CardType, c.content) ? (media.get(mediaFileId(c.type as CardType, c.content)!)?.path ?? null) : undefined })),
          versions: note.versions.map((v) => ({ number: v.number, kind: v.kind, title: v.title, createdAt: v.createdAt, cards: v.cards as unknown as SnapshotCard[] })),
        }),
      })
    }
    files.push({ path: 'notes/folders.json', bytes: json(folders.map((f) => ({ id: f.id, name: f.name, parentId: f.parentId, path: folderPath(f.id).join('/') }))) })
    files.push({ path: 'notes/tags.json', bytes: json(tags.map((t) => ({ id: t.id, name: t.name }))) })
    return { files, counts: { notes: notes.length, versions: notes.reduce((n, x) => n + x.versions.length, 0), media: files.filter((f) => f.path.includes('/media/')).length }, omitted }
  }
}
