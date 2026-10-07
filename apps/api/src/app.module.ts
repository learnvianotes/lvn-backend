import { Module } from '@nestjs/common'
import { CONTEXT_MODULES } from './contexts'
import { HealthController } from './health/health.controller'

/** Composition root for the GraphQL API (spec §3 apps/api). The Apollo Gateway is added in Phase 1. */
@Module({
  imports: CONTEXT_MODULES,
  controllers: [HealthController],
})
export class AppModule {}
