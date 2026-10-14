import { UseGuards } from '@nestjs/common'
import { Args, Mutation, Resolver } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { withUserErrors } from '@lvn-backend/errors'
import { AccountDeletionService } from '../application/account-deletion.service'
import type { AccountDeletionPayload } from './schema.types'

/** Deleting one's account (ADR-0088). */
@Resolver()
@UseGuards(SignedInGuard)
export class AccountResolver {
  constructor(private readonly deletion: AccountDeletionService) {}

  @Mutation('requestAccountDeletion')
  requestAccountDeletion(@Args('input') input: { password?: string | null; confirm: string }, @CurrentViewer() viewer: Viewer): Promise<AccountDeletionPayload> {
    return withUserErrors<AccountDeletionPayload>(async () => ({ deletionScheduledFor: await this.deletion.request(viewer.userId, input, viewer.sessionId) }), { deletionScheduledFor: null })
  }

  @Mutation('cancelAccountDeletion')
  cancelAccountDeletion(@CurrentViewer() viewer: Viewer): Promise<AccountDeletionPayload> {
    return withUserErrors<AccountDeletionPayload>(async () => (await this.deletion.cancel(viewer.userId), { deletionScheduledFor: null }), { deletionScheduledFor: null })
  }
}
