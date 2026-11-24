import { UseGuards } from '@nestjs/common'
import { Query, Resolver } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { PublicPlansService } from '../application/public-plans.service'

/** Plans anyone can read, and the signed-in person's plan and usage. No payment. */
@Resolver()
export class PlansResolver {
  constructor(private readonly plans: PublicPlansService) {}

  @Query('plans')
  list(@CurrentViewer() viewer: Viewer | null) {
    return this.plans.list(viewer?.userId ?? null)
  }

  @Query('myPlan')
  @UseGuards(SignedInGuard)
  mine(@CurrentViewer() viewer: Viewer) {
    return this.plans.mine(viewer.userId)
  }
}
