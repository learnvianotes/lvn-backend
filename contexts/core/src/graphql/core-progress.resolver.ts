import { UseGuards } from '@nestjs/common'
import { Args, Query, Resolver } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { Errors } from '@lvn-backend/errors'
import { CoreProgressService } from '../application/core-progress.service'
import type { CoreSubjectProgress, QueryCoreProgressArgs } from './schema.types'

@Resolver()
@UseGuards(SignedInGuard)
export class CoreProgressResolver {
  constructor(private readonly progress: CoreProgressService) {}

  @Query('coreProgress')
  coreProgress(@Args() { subjectId }: QueryCoreProgressArgs, @CurrentViewer() viewer: Viewer): Promise<CoreSubjectProgress> {
    if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(subjectId)) throw Errors.validation('Unknown subject.', ['subjectId'])
    return this.progress.forSubject(viewer.userId, subjectId)
  }
}
