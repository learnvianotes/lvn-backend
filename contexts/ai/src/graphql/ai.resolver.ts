import { UseGuards } from '@nestjs/common'
import { Query, Resolver } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { AiGateway } from '../application/ai-gateway'

@Resolver()
export class AiResolver {
  constructor(private readonly gateway: AiGateway) {}

  @Query('aiStatus')
  aiStatus() {
    return this.gateway.status()
  }

  @Query('myAiAllowance')
  @UseGuards(SignedInGuard)
  myAiAllowance(@CurrentViewer() viewer: Viewer) {
    return this.gateway.allowance(viewer.userId)
  }
}
