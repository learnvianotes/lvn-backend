import { UseGuards } from '@nestjs/common'
import { Args, Mutation, Parent, ResolveField, Resolver } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { withUserErrors, type UserError } from '@lvn-backend/errors'
import { FilesService } from '../application/files.service'
import { PagesService, type PageImageRow, type PageRow, type SavePageInput } from '../application/pages.service'
import type { NoteParent } from './notes.resolver'

const TOOLS = { pen: 'PEN', marker: 'MARKER', eraser: 'ERASER', ruler: 'RULER' } as const

type PagePayload = { page: PageRow | null; userErrors: UserError[] }
type Ok = { ok: boolean; userErrors: UserError[] }

/** Pages, their ink and the pictures on them. */
@Resolver('NotePage')
export class PagesResolver {
  constructor(
    private readonly pages: PagesService,
    private readonly files: FilesService,
  ) {}

  @ResolveField('strokes')
  strokes(@Parent() page: PageRow) {
    const strokes = page.drawing?.strokes
    if (!Array.isArray(strokes)) return []
    return strokes.flatMap((stroke) => {
      if (!stroke || typeof stroke !== 'object') return []
      const row = stroke as { id?: unknown; tool?: unknown; color?: unknown; width?: unknown; points?: unknown }
      const tool = TOOLS[row.tool as keyof typeof TOOLS]
      if (!tool || typeof row.id !== 'string' || typeof row.width !== 'number' || !Array.isArray(row.points)) return []
      return [{ id: row.id, tool, color: typeof row.color === 'string' ? row.color : null, width: row.width, points: row.points }]
    })
  }

  @ResolveField('images')
  async images(@Parent() page: PageRow) {
    const signed = await this.files.readUrls(page.images.map((image) => image.fileId))
    return page.images.map((image) => withUrl(image, signed.get(image.fileId)))
  }
}

@Resolver('Note')
export class NotePagesResolver {
  constructor(private readonly pages: PagesService) {}

  @ResolveField('pages')
  pagesOf(@Parent() note: NoteParent, @CurrentViewer() viewer: Viewer | null) {
    return this.pages.list(viewer?.userId ?? null, note.id)
  }
}

@Resolver()
export class PageMutationsResolver {
  constructor(private readonly pages: PagesService) {}

  @Mutation('saveNotePage')
  @UseGuards(SignedInGuard)
  saveNotePage(@Args('input') input: SavePageInput, @CurrentViewer() viewer: Viewer): Promise<PagePayload> {
    return withUserErrors<PagePayload>(async () => ({ page: await this.pages.save(viewer.userId, input) }), { page: null })
  }

  @Mutation('deleteNotePage')
  @UseGuards(SignedInGuard)
  deleteNotePage(@Args('input') input: { pageId: string }, @CurrentViewer() viewer: Viewer): Promise<Ok> {
    return withUserErrors<Ok>(async () => (await this.pages.remove(viewer.userId, input.pageId), { ok: true }), { ok: false })
  }

  @Mutation('placePageImage')
  @UseGuards(SignedInGuard)
  placePageImage(@Args('input') input: { pageId: string; fileId: string; x: number; y: number; width: number; height: number; rotation?: number | null }, @CurrentViewer() viewer: Viewer): Promise<PagePayload> {
    return withUserErrors<PagePayload>(async () => ({ page: await this.pages.place(viewer.userId, { ...input, rotation: input.rotation ?? 0 }) }), { page: null })
  }

  @Mutation('updatePageImage')
  @UseGuards(SignedInGuard)
  updatePageImage(@Args('input') input: { imageId: string; x: number; y: number; width: number; height: number; rotation?: number | null }, @CurrentViewer() viewer: Viewer): Promise<PagePayload> {
    return withUserErrors<PagePayload>(async () => ({ page: await this.pages.move(viewer.userId, input.imageId, input) }), { page: null })
  }

  @Mutation('removePageImage')
  @UseGuards(SignedInGuard)
  removePageImage(@Args('input') input: { imageId: string }, @CurrentViewer() viewer: Viewer): Promise<Ok> {
    return withUserErrors<Ok>(async () => (await this.pages.unplace(viewer.userId, input.imageId), { ok: true }), { ok: false })
  }
}

function withUrl(image: PageImageRow, signed: { url: string; expiresAt: Date } | undefined) {
  return { ...image, url: signed?.url ?? null, urlExpiresAt: signed?.expiresAt ?? null }
}
