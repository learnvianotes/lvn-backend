import { Module, type DynamicModule } from '@nestjs/common'
import type { WorkerConfig } from '@lvn-backend/config'
import { EventBusModule } from '@lvn-backend/event-bus'
import { PrismaModule } from '@lvn-backend/prisma-base'
import { QueueModule } from '@lvn-backend/queue'
import { RedisModule } from '@lvn-backend/redis'
import { StorageModule } from '@lvn-backend/storage'
import { contextModules, facades } from './contexts'
import { MaintenanceJobs } from './maintenance.jobs'
import { SearchJobs } from './search.jobs'
import { ExportJobs } from './export.jobs'

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
      providers: options.jobs === false ? [] : [MaintenanceJobs, SearchJobs, ExportJobs],
    }
  }
}
