import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { Logger } from '@nestjs/common'
import { loadWorkerConfig } from '@lvn-backend/config'
import { createLogger, PinoNestLogger } from '@lvn-backend/observability'
import { startHealthServer } from './health'
import { WorkerModule } from './worker.module'

async function bootstrap() {
  const config = loadWorkerConfig()
  const logger = createLogger({ service: 'lvn-worker', env: config.APP_ENV, level: config.LOG_LEVEL })
  const app = await NestFactory.createApplicationContext(WorkerModule.forRoot(config), { logger: new PinoNestLogger(logger) })
  app.enableShutdownHooks()
  const health = await startHealthServer(config.WORKER_HEALTH_PORT)
  new Logger('worker').log(`ready; health on :${config.WORKER_HEALTH_PORT}`)
  process.once('SIGTERM', () => health.close())
}

bootstrap().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
