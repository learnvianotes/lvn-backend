import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '@lvn-backend/prisma-base'
import { STUDY_PUBLISHER_EMAIL } from '../domain/study-publisher'
import { USERS_CONFIG, type UsersConfig } from '../users.config'

/** A new platform admin shows up on the next refusal within this window. */
const CACHE_MS = 60_000

/**
 * The single address on `AGE_RESTRICTED` and on a blocked sign-in.
 * The earliest non-deleted `PLATFORM_ADMIN` by `createdAt` (then id). `SUPPORT_EMAIL` when none exists.
 * The study publisher cannot receive mail, so it is never the contact.
 */
@Injectable()
export class SupportContact {
  private cached: { at: number; email: string } | null = null

  constructor(
    private readonly db: PrismaService,
    @Inject(USERS_CONFIG) private readonly config: UsersConfig,
  ) {}

  async email(): Promise<string> {
    const hit = this.cached
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.email
    const admin = await this.db.user.findFirst({
      where: { globalRole: 'PLATFORM_ADMIN', deletedAt: null, email: { not: STUDY_PUBLISHER_EMAIL } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { email: true },
    })
    const email = admin?.email ?? this.config.supportEmail
    this.cached = { at: Date.now(), email }
    return email
  }
}
