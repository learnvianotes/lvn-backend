import { config, telemetry } from './instrument'
import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { createLogger, PinoNestLogger, reportError, stopOnSignals } from '@lvn-backend/observability'
import { startHealthServer } from './health'
import { WorkerModule } from './worker.module'

async function bootstrap() {
  const logger = createLogger({ service: 'lvn-worker', env: config.APP_ENV, level: config.LOG_LEVEL })
  const app = await NestFactory.createApplicationContext(WorkerModule.forRoot(config), { logger: new PinoNestLogger(logger) })
  const health = await startHealthServer(config.WORKER_HEALTH_PORT)
  stopOnSignals(app, telemetry, () => new Promise<void>((resolve) => health.close(() => resolve())))
  logger.info({ telemetry: telemetry.enabled }, `ready; health on :${config.WORKER_HEALTH_PORT}`)
}

bootstrap().catch((err: unknown) => {
  reportError(err)
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
