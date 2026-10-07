import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/client'

export const DATABASE_URL = Symbol('DATABASE_URL')

/**
 * The one Prisma client of a process (Prisma 7, node-postgres driver). Each context's repositories use only the
 * models of its own schema (§6.1); the boundary is kept by review and by `scripts/check-cross-schema.mjs`.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(DATABASE_URL) url: string) {
    super({ adapter: new PrismaPg({ connectionString: url }) })
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect()
  }
}
