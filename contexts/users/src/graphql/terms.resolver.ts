import { UseGuards } from '@nestjs/common'
import { Args, Mutation, Parent, ResolveField, Resolver } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { withUserErrors } from '@lvn-backend/errors'
import { ConsentService } from '../application/consent.service'
import type { MutationAcceptTermsArgs, OkPayload, User } from './schema.types'

@Resolver('User')
export class TermsResolver {
  constructor(private readonly consent: ConsentService) {}

  @ResolveField('termsAccepted')
  termsAccepted(@Parent() user: User, @CurrentViewer() viewer: Viewer | null): Promise<boolean> | null {
    return viewer?.userId === user.id ? this.consent.accepted(user.id) : null
  }

  @Mutation('acceptTerms')
  @UseGuards(SignedInGuard)
  acceptTerms(@Args() { input }: MutationAcceptTermsArgs, @CurrentViewer() viewer: Viewer): Promise<OkPayload> {
    return withUserErrors<OkPayload>(async () => {
      await this.consent.accept(viewer.userId, input.version)
      return { ok: true }
    }, { ok: false })
  }
}
