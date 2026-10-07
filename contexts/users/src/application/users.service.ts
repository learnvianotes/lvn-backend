import { Injectable } from '@nestjs/common'
import type { GlobalRole, VerificationMethod } from '@lvn/contracts/domain'
import { PrismaService } from '@lvn-backend/prisma-base'
import type { User } from '../graphql/schema.types'

@Injectable()
export class UsersService {
  constructor(private readonly db: PrismaService) {}

  /** The viewer's own view of their account; null if it was deleted meanwhile. */
  async viewerProfile(userId: string): Promise<User | null> {
    const u = await this.db.user.findFirst({ where: { id: userId, deletedAt: null } })
    if (!u) return null
    return {
      id: u.id,
      handle: u.handle,
      displayName: u.displayName,
      email: u.email,
      emailVerified: u.emailVerifiedAt !== null,
      registrationComplete: u.registrationCompletedAt !== null,
      verified: u.verifiedAt !== null,
      verificationMethod: u.verificationMethod as VerificationMethod | null,
      globalRole: u.globalRole as GlobalRole,
      createdAt: u.createdAt,
    }
  }
}
