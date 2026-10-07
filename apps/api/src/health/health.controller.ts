import { Controller, Get } from '@nestjs/common'

/**
 * Probes for the load balancer and rolling deploys (spec §16.2). Readiness gains its checks (database,
 * Redis, schema version) in Phase 1, together with the clients it checks.
 */
@Controller('health')
export class HealthController {
  @Get('live')
  live() {
    return { status: 'ok' }
  }

  @Get('ready')
  ready() {
    return { status: 'ok', checks: {} }
  }
}
