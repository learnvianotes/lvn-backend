import { UseGuards } from '@nestjs/common'
import { Mutation, Query, Resolver } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { withUserErrors } from '@lvn-backend/errors'
import { DataExportService } from '../application/data-export.service'
import type { DataExportPayload } from './schema.types'

@Resolver()
@UseGuards(SignedInGuard)
export class DataResolver {
  constructor(private readonly exports: DataExportService) {}

  @Query('myDataExports')
  myDataExports(@CurrentViewer() viewer: Viewer) {
    return this.exports.list(viewer.userId)
  }

  @Mutation('requestDataExport')
  requestDataExport(@CurrentViewer() viewer: Viewer): Promise<DataExportPayload> {
    return withUserErrors<DataExportPayload>(async () => {
      const row = await this.exports.request(viewer.userId)
      return { export: { ...row, sizeBytes: null, downloadUrl: null } as unknown as DataExportPayload['export'] }
    }, { export: null })
  }
}
