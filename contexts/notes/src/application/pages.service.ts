import { Injectable } from '@nestjs/common'
import { DRAWING_LIMITS, parseDrawing, parsePageImagePlacement, type Drawing, type PageImagePlacement } from '@lvn/contracts/validation'
import { Errors } from '@lvn-backend/errors'
import { newId, PrismaService, type Prisma } from '@lvn-backend/prisma-base'
import { FilesService } from './files.service'
import { NotesService } from './notes.service'

export interface PageImageRow {
  id: string
  fileId: string
  name: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

export interface PageRow {
  id: string
  noteId: string
  index: number
  drawing: Drawing
  images: PageImageRow[]
}

export interface SavePageInput {
  noteId: string
  pageId?: string | null
  index: number
  drawing: unknown
}

export interface PlaceImageInput extends PageImagePlacement {
  pageId: string
  fileId: string
  name?: string | null
}

export interface SavePagesImageInput {
  id?: string | null
  fileId: string
  name?: string | null
  x: number
  y: number
  w: number
  h: number
  rotation?: number | null
}

export interface SavePagesPageInput {
  id?: string | null
  index: number
  drawing: unknown
  images?: SavePagesImageInput[] | null
}

/**
 * Pages of a note: a drawing layer (vector ink) and images placed on it. Pages belong to the note, not to a version.
 * Anyone who can read the note sees them. Editors change them. Images are ordinary uploads (scanned, counted as storage).
 */
@Injectable()
export class PagesService {
  constructor(
    private readonly db: PrismaService,
    private readonly notes: NotesService,
    private readonly files: FilesService,
  ) {}

  async list(viewerId: string | null, noteId: string): Promise<PageRow[]> {
    const opened = await this.notes.open(viewerId, noteId)
    if (!opened) throw Errors.notFound('Note not found.')
    return this.rows(noteId)
  }

  async save(editorId: string, input: SavePageInput): Promise<PageRow> {
    await this.notes.require(editorId, input.noteId, 'edit')
    if (!Number.isInteger(input.index) || input.index < 0 || input.index >= DRAWING_LIMITS.pages) {
      throw Errors.validation(`A note has at most ${DRAWING_LIMITS.pages} pages.`, ['input', 'index'])
    }
    const parsed = parseDrawing(input.drawing)
    if (!parsed.ok) throw Errors.validation(parsed.message, ['input', 'drawing'])
    const drawing = parsed.drawing as unknown as Prisma.InputJsonValue
    if (input.pageId) {
      const page = await this.owned(input.noteId, input.pageId)
      await this.db.notePage.update({ where: { id: page.id }, data: { index: input.index, drawing } })
      return (await this.rows(input.noteId, page.id))[0]!
    }
    const count = await this.db.notePage.count({ where: { noteId: input.noteId, deletedAt: null } })
    if (count >= DRAWING_LIMITS.pages) throw Errors.validation(`A note has at most ${DRAWING_LIMITS.pages} pages.`, ['input', 'index'])
    const id = newId()
    await this.db.notePage.create({ data: { id, noteId: input.noteId, index: input.index, drawing } })
    return (await this.rows(input.noteId, id))[0]!
  }

  /** Upsert these pages. An `images` array replaces the pictures on that page; omitting it leaves them. */
  async saveAll(editorId: string, noteId: string, pages: SavePagesPageInput[]): Promise<PageRow[]> {
    await this.notes.require(editorId, noteId, 'edit')
    if (pages.length > DRAWING_LIMITS.pages) throw Errors.validation(`A note has at most ${DRAWING_LIMITS.pages} pages.`, ['input', 'pages'])
    const seen = new Set<number>()
    for (const [i, page] of pages.entries()) {
      if (!Number.isInteger(page.index) || page.index < 0 || page.index >= DRAWING_LIMITS.pages) {
        throw Errors.validation(`A note has at most ${DRAWING_LIMITS.pages} pages.`, ['input', 'pages', String(i), 'index'])
      }
      if (seen.has(page.index)) throw Errors.validation('Two pages cannot share an index.', ['input', 'pages', String(i), 'index'])
      seen.add(page.index)
      const parsed = parseDrawing(page.drawing)
      if (!parsed.ok) throw Errors.validation(parsed.message, ['input', 'pages', String(i), 'drawing'])
      if (page.images && page.images.length > DRAWING_LIMITS.imagesPerPage) {
        throw Errors.validation(`A page holds at most ${DRAWING_LIMITS.imagesPerPage} images.`, ['input', 'pages', String(i), 'images'])
      }
    }
    for (const page of pages) {
      const saved = await this.save(editorId, { noteId, pageId: page.id, index: page.index, drawing: page.drawing })
      if (page.images) await this.syncImages(editorId, noteId, saved.id, page.images)
    }
    return this.rows(noteId)
  }

  async remove(editorId: string, pageId: string): Promise<void> {
    const page = await this.page(pageId)
    await this.notes.require(editorId, page.noteId, 'edit')
    const images = await this.db.notePageImage.findMany({ where: { pageId }, select: { fileId: true } })
    await this.db.$transaction([this.db.notePageImage.deleteMany({ where: { pageId } }), this.db.notePage.update({ where: { id: pageId }, data: { deletedAt: new Date() } })])
    for (const image of images) await this.deleteIfUnused(image.fileId)
  }

  async place(editorId: string, input: PlaceImageInput): Promise<PageRow> {
    const page = await this.page(input.pageId)
    await this.notes.require(editorId, page.noteId, 'edit')
    const placement = this.placement(input)
    await this.assertImage(editorId, page.noteId, input.fileId)
    await this.rememberName(input.fileId, input.name)
    const count = await this.db.notePageImage.count({ where: { pageId: page.id } })
    if (count >= DRAWING_LIMITS.imagesPerPage) throw Errors.validation(`A page holds at most ${DRAWING_LIMITS.imagesPerPage} images.`, ['input', 'fileId'])
    await this.db.notePageImage.create({ data: { id: newId(), pageId: page.id, fileId: input.fileId, ...placement } })
    return (await this.rows(page.noteId, page.id))[0]!
  }

  async move(editorId: string, imageId: string, raw: unknown): Promise<PageRow> {
    const image = await this.image(imageId)
    await this.notes.require(editorId, image.page.noteId, 'edit')
    const placement = this.placement(raw)
    await this.db.notePageImage.update({ where: { id: imageId }, data: placement })
    const named = raw && typeof raw === 'object' ? (raw as { name?: string | null }).name : undefined
    await this.rememberName(image.fileId, named)
    return (await this.rows(image.page.noteId, image.pageId))[0]!
  }

  async unplace(editorId: string, imageId: string): Promise<void> {
    const image = await this.image(imageId)
    await this.notes.require(editorId, image.page.noteId, 'edit')
    await this.db.notePageImage.delete({ where: { id: imageId } })
    await this.deleteIfUnused(image.fileId)
  }

  private placement(raw: unknown): PageImagePlacement {
    const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
    const parsed = parsePageImagePlacement({ x: source.x, y: source.y, width: source.width, height: source.height, rotation: source.rotation ?? 0 })
    if (!parsed.ok) throw Errors.validation(parsed.message, ['input'])
    return parsed.placement
  }

  private async syncImages(editorId: string, noteId: string, pageId: string, images: SavePagesImageInput[]): Promise<void> {
    const existing = await this.db.notePageImage.findMany({ where: { pageId } })
    const keep = new Set<string>()
    for (const image of images) {
      const placement = this.placement({ x: image.x, y: image.y, width: image.w, height: image.h, rotation: image.rotation ?? 0 })
      await this.assertImage(editorId, noteId, image.fileId)
      await this.rememberName(image.fileId, image.name)
      if (image.id) {
        const row = existing.find((item) => item.id === image.id)
        if (!row) throw Errors.notFound('Picture not found.')
        await this.db.notePageImage.update({ where: { id: image.id }, data: { fileId: image.fileId, ...placement } })
        if (row.fileId !== image.fileId) await this.deleteIfUnused(row.fileId)
        keep.add(image.id)
      } else {
        const id = newId()
        await this.db.notePageImage.create({ data: { id, pageId, fileId: image.fileId, ...placement } })
        keep.add(id)
      }
    }
    const dropped = existing.filter((item) => !keep.has(item.id))
    if (dropped.length) {
      await this.db.notePageImage.deleteMany({ where: { id: { in: dropped.map((item) => item.id) } } })
      for (const image of dropped) await this.deleteIfUnused(image.fileId)
    }
  }

  private async rememberName(fileId: string, name: string | null | undefined): Promise<void> {
    if (!name) return
    const cleaned = [...name].filter((c) => c !== '/' && c !== '\\' && c.charCodeAt(0) >= 0x20).join('').trim().slice(0, 255)
    if (!cleaned) return
    await this.db.fileObject.update({ where: { id: fileId }, data: { originalFileName: cleaned } })
  }

  /** A finished page image the editor uploaded for this note, and that a scan has not refused. */
  private async assertImage(editorId: string, noteId: string, fileId: string): Promise<void> {
    const file = await this.db.fileObject.findUnique({ where: { id: fileId } })
    if (!file || file.deletedAt || file.ownerId !== editorId || file.purpose !== 'PAGE_IMAGE' || file.parentId !== noteId) {
      throw Errors.validation('Upload the picture for this note first.', ['input', 'fileId'])
    }
    if (file.status !== 'READY') throw Errors.validation('Finish uploading the picture first.', ['input', 'fileId'])
    if (file.scanResult === 'PENDING') throw Errors.unavailable('This picture is still being scanned.')
    if (file.scanResult === 'FAILED') throw Errors.validation('This picture could not be scanned, so it cannot be placed.')
  }

  /** A page image file goes when nothing still shows it. Other purposes are left to their own owners. */
  private async deleteIfUnused(fileId: string): Promise<void> {
    const left = await this.db.notePageImage.count({ where: { fileId } })
    if (left) return
    const file = await this.db.fileObject.findUnique({ where: { id: fileId }, select: { purpose: true, deletedAt: true } })
    if (file && !file.deletedAt && file.purpose === 'PAGE_IMAGE') await this.files.delete([fileId])
  }

  private async page(pageId: string) {
    const page = await this.db.notePage.findFirst({ where: { id: pageId, deletedAt: null } })
    if (!page) throw Errors.notFound('Page not found.')
    return page
  }

  private async owned(noteId: string, pageId: string) {
    const page = await this.page(pageId)
    if (page.noteId !== noteId) throw Errors.notFound('Page not found.')
    return page
  }

  private async image(imageId: string) {
    const image = await this.db.notePageImage.findUnique({ where: { id: imageId }, include: { page: true } })
    if (!image || image.page.deletedAt) throw Errors.notFound('Picture not found.')
    return image
  }

  private async rows(noteId: string, only?: string): Promise<PageRow[]> {
    const pages = await this.db.notePage.findMany({
      where: { noteId, deletedAt: null, ...(only ? { id: only } : {}) },
      include: { images: { orderBy: { id: 'asc' }, include: { file: { select: { originalFileName: true } } } } },
      orderBy: [{ index: 'asc' }, { id: 'asc' }],
    })
    return pages.map((page) => ({
      id: page.id,
      noteId: page.noteId,
      index: page.index,
      drawing: page.drawing as Drawing,
      images: page.images.map((image) => ({ id: image.id, fileId: image.fileId, name: image.file.originalFileName, x: image.x, y: image.y, width: image.width, height: image.height, rotation: image.rotation })),
    }))
  }
}
