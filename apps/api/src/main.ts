import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { loadApiConfig } from '@lvn-backend/config'
import { createLogger, PinoNestLogger } from '@lvn-backend/observability'
import { Storage } from '@lvn-backend/storage'
import { configureHttp } from './http'
import { AppModule } from './app.module'

async function bootstrap() {
  const config = loadApiConfig()
  const logger = createLogger({ service: 'lvn-api', env: config.APP_ENV, level: config.LOG_LEVEL })
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(config), { logger: new PinoNestLogger(logger) })
  configureHttp(app, config, logger)
  // Local RustFS starts empty; sandbox and production buckets come from Terraform.
  if (config.APP_ENV === 'development') await app.get(Storage).ensureBuckets([config.S3_BUCKET, config.S3_RESTRICTED_BUCKET])
  app.enableShutdownHooks()
  await app.listen(config.API_PORT, config.API_HOST)
}

bootstrap().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
