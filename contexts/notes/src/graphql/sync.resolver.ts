import { UseGuards } from '@nestjs/common'
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { SyncService, type SyncOp } from '../application/sync.service'
import { toNote } from './notes.resolver'
import type { MutationSyncPushArgs, QuerySyncPullArgs } from './schema.types'

@Resolver()
@UseGuards(SignedInGuard)
export class SyncResolver {
  constructor(private readonly sync: SyncService) {}

  @Query('syncPull')
  async syncPull(@Args() { since, after, first }: QuerySyncPullArgs, @CurrentViewer() viewer: Viewer) {
    const pulled = await this.sync.pull(viewer.userId, since, after, first)
    return { ...pulled, notes: pulled.notes.map(({ opened, cards }) => ({ note: toNote(opened), cards })) }
  }

  @Mutation('syncPush')
  async syncPush(@Args() { ops }: MutationSyncPushArgs, @CurrentViewer() viewer: Viewer) {
    return { results: await this.sync.push(viewer.userId, ops as SyncOp[]) }
  }
}
