import { Module, type DynamicModule } from '@nestjs/common'
import type { WorkerConfig } from '@lvn-backend/config'
import { EventBusModule } from '@lvn-backend/event-bus'
import { PrismaModule } from '@lvn-backend/prisma-base'
import { QueueModule } from '@lvn-backend/queue'
import { RedisModule } from '@lvn-backend/redis'
import { StorageModule } from '@lvn-backend/storage'
import { contextModules, facades } from './contexts'
import { MaintenanceJobs, METRICS_ROLLUP } from './maintenance.jobs'
import { SearchJobs } from './search.jobs'
import { AiJobs } from './ai.jobs'
import { DataJobs } from './data.jobs'
import { PdfJobs } from './pdf.jobs'
import { MediaJobs } from './media.jobs'
import { VerificationJobs } from './verification.jobs'

/** Composition root for background jobs (spec §3 apps/worker): the contexts and their BullMQ processors. */
@Module({})
export class WorkerModule {
  static forRoot(config: WorkerConfig, options: { jobs?: boolean } = {}): DynamicModule {
    return {
      module: WorkerModule,
      imports: [
        PrismaModule.forRoot(config.DATABASE_URL),
        RedisModule.forRoot(config.REDIS_URL),
        StorageModule.forRoot({
          endpoint: config.S3_ENDPOINT,
          region: config.S3_REGION,
          accessKeyId: config.S3_ACCESS_KEY_ID,
          secretAccessKey: config.S3_SECRET_ACCESS_KEY,
          forcePathStyle: config.S3_FORCE_PATH_STYLE,
        }),
        QueueModule.forRoot(config.REDIS_URL),
        EventBusModule,
        facades(),
        ...contextModules(config),
      ],
      providers:
        options.jobs === false
          ? []
          : [{ provide: METRICS_ROLLUP, useValue: { cron: config.METRICS_ROLLUP_CRON, days: config.METRICS_ROLLUP_DAYS } }, MaintenanceJobs, SearchJobs, AiJobs, DataJobs, PdfJobs, MediaJobs, VerificationJobs],
    }
  }
}
