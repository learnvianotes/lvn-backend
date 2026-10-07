import { Global, Module, type DynamicModule } from '@nestjs/common'
import { DATABASE_URL, PrismaService } from './prisma.service'

/** Registered once by each composition root (apps/api, apps/worker) with the validated DATABASE_URL. */
@Global()
@Module({})
export class PrismaModule {
  static forRoot(databaseUrl: string): DynamicModule {
    return {
      module: PrismaModule,
      providers: [{ provide: DATABASE_URL, useValue: databaseUrl }, PrismaService],
      exports: [PrismaService],
    }
  }
}
