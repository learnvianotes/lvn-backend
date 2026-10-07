import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { Logger } from '@nestjs/common'
import { loadWorkerConfig } from '@lvn-backend/config'
import { startHealthServer } from './health'
import { WorkerModule } from './worker.module'

async function bootstrap() {
  const config = loadWorkerConfig()
  const app = await NestFactory.createApplicationContext(WorkerModule)
  app.enableShutdownHooks()
  const health = await startHealthServer(config.WORKER_HEALTH_PORT)
  new Logger('worker').log(`ready; health on :${config.WORKER_HEALTH_PORT}`)
  process.once('SIGTERM', () => health.close())
}

bootstrap().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
