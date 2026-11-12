import { UseGuards } from '@nestjs/common'
import { Query, ResolveField, Resolver } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { DailyLineService } from '../application/daily-line.service'

/** Home's line for the day (ADR-0087). */
@Resolver()
@UseGuards(SignedInGuard)
export class DailyLineResolver {
  constructor(private readonly lines: DailyLineService) {}

  @Query('dailyLine')
  dailyLine(@CurrentViewer() viewer: Viewer) {
    return this.lines.forViewer(viewer.userId)
  }
}

/** `fromAi` is the chosen-line flag. The label field follows it. */
@Resolver('DailyLine')
export class DailyLineLabelResolver {
  @ResolveField('aiGenerated')
  aiGenerated(parent: { fromAi?: boolean }): boolean {
    return parent.fromAi === true
  }
}
