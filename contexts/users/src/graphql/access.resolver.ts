import { UseGuards } from '@nestjs/common'
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { AppError, ErrorCode, toUserError, withUserErrors, type UserError } from '@lvn-backend/errors'
import { INVITE_ONLY_MESSAGE } from '../domain/access-allowlist'
import { AccessAllowlistService } from '../application/access-allowlist.service'
import type {
  AccessAllowlistPayload,
  AccessPolicy,
  MutationAddAccessAllowlistEntryArgs,
  MutationRemoveAccessAllowlistEntryArgs,
  MutationUpdateAccessAllowlistEntryArgs,
  OkPayload,
  QueryAdminAccessAllowlistArgs,
} from './schema.types'

type Body<P> = Omit<P, 'userErrors'>

/**
 * Sign-in failures use FORBIDDEN, which `withUserErrors` normally rethrows. The allowlist contract returns that
 * one failure in `userErrors` instead. Every other FORBIDDEN (a student calling an admin mutation) still throws.
 */
export async function withInviteError<P extends { userErrors: UserError[] }>(run: () => Promise<Body<P>>, empty: Body<P>): Promise<P> {
  try {
    return await withUserErrors(run, empty)
  } catch (e) {
    if (e instanceof AppError && e.code === ErrorCode.FORBIDDEN && e.message === INVITE_ONLY_MESSAGE) {
      return { ...empty, userErrors: [toUserError(e)] } as P
    }
    throw e
  }
}

@Resolver()
export class AccessAllowlistResolver {
  constructor(private readonly allowlist: AccessAllowlistService) {}

  @Query('accessPolicy')
  accessPolicy(): Promise<AccessPolicy> {
    return this.allowlist.policy()
  }

  @Query('adminAccessAllowlist')
  @UseGuards(SignedInGuard)
  adminAccessAllowlist(@Args() { search }: QueryAdminAccessAllowlistArgs, @CurrentViewer() viewer: Viewer) {
    return this.allowlist.list(viewer.userId, search)
  }

  @Mutation('addAccessAllowlistEntry')
  @UseGuards(SignedInGuard)
  addAccessAllowlistEntry(@Args() { input }: MutationAddAccessAllowlistEntryArgs, @CurrentViewer() viewer: Viewer): Promise<AccessAllowlistPayload> {
    return withUserErrors<AccessAllowlistPayload>(async () => ({ entry: await this.allowlist.add(viewer.userId, input) }), { entry: null })
  }

  @Mutation('updateAccessAllowlistEntry')
  @UseGuards(SignedInGuard)
  updateAccessAllowlistEntry(@Args() { input }: MutationUpdateAccessAllowlistEntryArgs, @CurrentViewer() viewer: Viewer): Promise<AccessAllowlistPayload> {
    return withUserErrors<AccessAllowlistPayload>(async () => ({ entry: await this.allowlist.update(viewer.userId, input) }), { entry: null })
  }

  @Mutation('removeAccessAllowlistEntry')
  @UseGuards(SignedInGuard)
  removeAccessAllowlistEntry(@Args() { id }: MutationRemoveAccessAllowlistEntryArgs, @CurrentViewer() viewer: Viewer): Promise<OkPayload> {
    return withUserErrors<OkPayload>(async () => {
      await this.allowlist.remove(viewer.userId, id)
      return { ok: true }
    }, { ok: false })
  }
}
