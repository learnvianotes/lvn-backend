import { config, telemetry } from './instrument'
import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { createLogger, PinoNestLogger, reportError, stopOnSignals } from '@lvn-backend/observability'
import { Storage } from '@lvn-backend/storage'
import { configureHttp } from './http'
import { AppModule } from './app.module'

async function bootstrap() {
  const logger = createLogger({ service: 'lvn-api', env: config.APP_ENV, level: config.LOG_LEVEL })
  // rawBody: GitHub App deliveries are checked by their signature over the exact bytes sent (ADR-0078).
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(config), { logger: new PinoNestLogger(logger), rawBody: true })
  configureHttp(app, config, logger)
  // Local RustFS starts empty; sandbox and production buckets come from Terraform.
  if (config.APP_ENV === 'development') await app.get(Storage).ensureBuckets([config.S3_BUCKET, config.S3_RESTRICTED_BUCKET])
  stopOnSignals(app, telemetry)
  await app.listen(config.API_PORT, config.API_HOST)
  logger.info({ telemetry: telemetry.enabled }, `listening on ${config.API_HOST}:${config.API_PORT}`)
}

bootstrap().catch((err: unknown) => {
  reportError(err)
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
