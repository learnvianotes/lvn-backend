import { UseGuards } from '@nestjs/common'
import { Args, Mutation, Resolver } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { withUserErrors } from '@lvn-backend/errors'
import { FilesService } from '../application/files.service'
import type { MutationCompleteUploadArgs, MutationCreateUploadIntentArgs, OkPayload, UploadIntentPayload } from './schema.types'

@Resolver()
@UseGuards(SignedInGuard)
export class FilesResolver {
  constructor(private readonly files: FilesService) {}

  @Mutation('createUploadIntent')
  createUploadIntent(@Args() { input }: MutationCreateUploadIntentArgs, @CurrentViewer() viewer: Viewer): Promise<UploadIntentPayload> {
    return withUserErrors<UploadIntentPayload>(async () => ({ intent: await this.files.createUploadIntent(viewer.userId, input) }), { intent: null })
  }

  @Mutation('completeUpload')
  completeUpload(@Args() { fileId }: MutationCompleteUploadArgs, @CurrentViewer() viewer: Viewer): Promise<OkPayload> {
    return withUserErrors<OkPayload>(async () => {
      await this.files.completeUpload(viewer.userId, fileId)
      return { ok: true }
    }, { ok: false })
  }
}
