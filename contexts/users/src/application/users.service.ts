import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '@lvn-backend/prisma-base'
import { isRestrictedMinor } from '../domain/rules'
import type { User } from '../graphql/schema.types'
import { USERS_CONFIG, type UsersConfig } from '../users.config'
import { InstitutionalEmailService } from './institutional-email.service'

@Injectable()
export class UsersService {
  constructor(
    private readonly db: PrismaService,
    private readonly institutional: InstitutionalEmailService,
    @Inject(USERS_CONFIG) private readonly config: UsersConfig,
  ) {}

  /** The viewer's own view of their account, viewer-only fields included; null if it was deleted meanwhile. */
  async viewerProfile(userId: string): Promise<User | null> {
    const u = await this.db.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: { consents: { where: { kind: 'GUARDIAN' }, select: { id: true }, take: 1 } },
    })
    if (!u) return null
    const institutional = await this.institutional.statusOf(userId)
    return {
      id: u.id,
      handle: u.handle,
      displayName: u.displayName,
      email: u.email,
      emailVerified: u.emailVerifiedAt !== null,
      registrationComplete: u.registrationCompletedAt !== null,
      verified: u.verifiedAt !== null,
      verificationMethod: u.verificationMethod,
      globalRole: u.globalRole,
      createdAt: u.createdAt,
      institutionalEmail: institutional.email,
      institutionalEmailStatus: institutional.status,
      institution: institutional.institution,
      restrictedMinor: isRestrictedMinor(u.dateOfBirth, this.config.digitalConsentAge, u.consents.length > 0),
    }
  }
}
