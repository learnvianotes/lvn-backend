import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { loadApiConfig } from '@lvn-backend/config'
import { configureHttp } from './http'
import { AppModule } from './app.module'

async function bootstrap() {
  const config = loadApiConfig()
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(config), { bufferLogs: false })
  configureHttp(app, config)
  app.enableShutdownHooks()
  await app.listen(config.API_PORT, config.API_HOST)
}

bootstrap().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
