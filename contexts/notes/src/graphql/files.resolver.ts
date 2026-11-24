import { UseGuards } from '@nestjs/common'
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type RequestContext, type Viewer } from '@lvn-backend/auth-guard'
import { withUserErrors } from '@lvn-backend/errors'
import { FilesService } from '../application/files.service'
import type { MutationCompleteUploadArgs, MutationCreateUploadIntentArgs, OkPayload, UploadIntentPayload } from './schema.types'

/** ADR-0097: anyone may ask whether uploads are on (the sign-up and note screens decide what to show). */
@Resolver()
export class UploadsResolver {
  constructor(private readonly files: FilesService) {}

  @Query('uploadsEnabled')
  uploadsEnabled(): boolean {
    return this.files.uploadsEnabled
  }
}

@Resolver()
@UseGuards(SignedInGuard)
export class FilesResolver {
  constructor(private readonly files: FilesService) {}

  @Mutation('createUploadIntent')
  createUploadIntent(@Args() { input }: MutationCreateUploadIntentArgs, @CurrentViewer() viewer: Viewer, @Context() ctx: RequestContext): Promise<UploadIntentPayload> {
    return withUserErrors<UploadIntentPayload>(async () => ({ intent: await this.files.createUploadIntent(viewer.userId, input, callerIp(ctx.req)) }), { intent: null })
  }

  @Mutation('completeUpload')
  completeUpload(@Args() { fileId }: MutationCompleteUploadArgs, @CurrentViewer() viewer: Viewer): Promise<OkPayload> {
    return withUserErrors<OkPayload>(async () => {
      await this.files.completeUpload(viewer.userId, fileId)
      return { ok: true }
    }, { ok: false })
  }
}

function callerIp(req: RequestContext['req']): string {
  const raw = (req as { ip?: string }).ip ?? ''
  return raw.startsWith('::ffff:') ? raw.slice('::ffff:'.length) : raw
}
