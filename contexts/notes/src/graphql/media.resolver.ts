import { Context, Parent, ResolveField, Resolver } from '@nestjs/graphql'
import type { CardType } from '@lvn/contracts/domain'
import type { RequestContext } from '@lvn-backend/auth-guard'
import { requestLoader } from '@lvn-backend/graphql'
import { AttachmentsService, mediaFileId, type MediaFile } from '../application/attachments.service'

/**
 * Fields of Card. Cards are only reachable through a note (or a version of it) the viewer may read, so their media
 * may be read too — as long as the file is linked to that note (AttachmentsService).
 */
@Resolver('Card')
export class CardResolver {
  constructor(private readonly attachments: AttachmentsService) {}

  @ResolveField('media')
  media(@Parent() card: { noteId?: string; type: CardType; content: unknown }, @Context() context: RequestContext) {
    const fileId = mediaFileId(card.type, card.content)
    if (!fileId || !card.noteId) return null
    return requestLoader<string, MediaFile | null>(context, 'notes.media', async (keys) => {
      const found = await this.attachments.media(keys.map((k) => ({ noteId: k.slice(0, 36), fileId: k.slice(37) })))
      return keys.map((k) => found.get(k) ?? null)
    }).load(`${card.noteId}:${fileId}`)
  }
}
