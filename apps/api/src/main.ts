import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { loadApiConfig } from '@lvn-backend/config'
import helmet from 'helmet'
import { AppModule } from './app.module'

async function bootstrap() {
  const config = loadApiConfig()
  const app = await NestFactory.create(AppModule, { bufferLogs: false })
  app.use(helmet())
  app.enableCors({ origin: config.CORS_ORIGINS, credentials: true })
  app.enableShutdownHooks()
  await app.listen(config.API_PORT, config.API_HOST)
}

bootstrap().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
