import { Context, Parent, ResolveField, Resolver } from '@nestjs/graphql'
import type { RequestContext } from '@lvn-backend/auth-guard'
import { requestLoader } from '@lvn-backend/graphql'
import { AttachmentsService } from '../application/attachments.service'
import { DraftsService } from '../application/drafts.service'
import type { OpenedNote } from '../application/notes.service'
import type { NoteParent } from './notes.resolver'

/** A note's first picture for previews (ADR-0076), as the viewer sees the note, served like its cards' media. */
@Resolver('Note')
export class NotePreviewResolver {
  constructor(
    private readonly drafts: DraftsService,
    private readonly attachments: AttachmentsService,
  ) {}

  @ResolveField('previewPicture')
  previewPicture(@Parent() n: NoteParent, @Context() context: RequestContext) {
    return requestLoader<OpenedNote, unknown>(context, 'notes.previewPicture', async (opened) => {
      const pictures = await this.drafts.firstPictures([...opened])
      const keys = opened.flatMap((o) => (pictures.has(o.note.id) ? [{ noteId: o.note.id, fileId: pictures.get(o.note.id)! }] : []))
      const found = keys.length ? await this.attachments.media(keys) : new Map()
      return opened.map((o) => (pictures.has(o.note.id) ? (found.get(`${o.note.id}:${pictures.get(o.note.id)}`) ?? null) : null))
    }).load(n.opened)
  }
}
