import { Inject, Injectable } from '@nestjs/common'
import { Errors } from '@lvn-backend/errors'
import { PEOPLE, type People } from '@lvn-backend/facades'
import { PrismaService } from '@lvn-backend/prisma-base'

const STALE_DAYS = 60

/** Phones' push tokens (ADR-0050): a token belongs to whoever registered it last; stale ones are pruned. */
@Injectable()
export class DevicesService {
  constructor(
    private readonly db: PrismaService,
    @Inject(PEOPLE) private readonly people: People,
  ) {}

  async register(userId: string, token: string, platform: 'ANDROID' | 'IOS'): Promise<void> {
    await this.people.assertDevicesOpen(userId)
    const t = token.trim()
    if (t.length < 20 || t.length > 4096) throw Errors.validation('That is not a push token.', ['input', 'token'])
    const now = new Date()
    await this.db.deviceToken.upsert({ where: { token: t }, create: { token: t, userId, platform }, update: { userId, platform, lastSeenAt: now } })
  }

  /** Signing out: only the person's own token goes. */
  async unregister(userId: string, token: string): Promise<void> {
    await this.db.deviceToken.deleteMany({ where: { token, userId } })
  }

  async tokensOf(userId: string): Promise<string[]> {
    return (await this.db.deviceToken.findMany({ where: { userId }, select: { token: true } })).map((d) => d.token)
  }

  async count(userId: string): Promise<number> {
    return this.db.deviceToken.count({ where: { userId } })
  }

  async forget(token: string): Promise<void> {
    await this.db.deviceToken.deleteMany({ where: { token } })
  }

  /** Nightly: phones not seen for 60 days. */
  async pruneStale(now = new Date()): Promise<number> {
    return (await this.db.deviceToken.deleteMany({ where: { lastSeenAt: { lt: new Date(now.getTime() - STALE_DAYS * 86_400_000) } } })).count
  }
}
