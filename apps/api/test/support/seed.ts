import { AccessTokenSigner } from '@lvn-backend/auth-guard'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import type { ApiConfig } from '@lvn/contracts/config'
import type { INestApplication } from '@nestjs/common'
import { TOKEN_AUDIENCE } from '../../src/app.module'

/** Inserts a user straight into the database (tests that are not about registration). */
export async function seedUser(app: INestApplication, overrides: Partial<{ email: string; handle: string; displayName: string; globalRole: 'STUDENT' | 'TEACHER' | 'MANAGER' | 'PLATFORM_ADMIN'; verified: boolean }> = {}) {
  const db = app.get(PrismaService)
  const id = newId()
  return db.user.create({
    data: {
      id,
      email: overrides.email ?? `user-${id.slice(-12)}@example.com`,
      handle: overrides.handle ?? `user${id.slice(-12)}`,
      displayName: overrides.displayName ?? 'Test User',
      globalRole: overrides.globalRole ?? 'STUDENT',
      dateOfBirth: new Date('2004-05-01'),
      registrationCompletedAt: new Date(),
      ...(overrides.verified ? { verifiedAt: new Date(), verificationMethod: 'INSTITUTIONAL_EMAIL' as const } : {}),
    },
  })
}

/** An access token for `userId` signed with the test key, as the auth flow would issue it. */
export function tokenFor(config: ApiConfig, userId: string, sessionId = newId(), roles: ('STUDENT' | 'TEACHER' | 'MANAGER' | 'PLATFORM_ADMIN')[] = ['STUDENT']): string {
  return new AccessTokenSigner(config.JWT_PRIVATE_KEY, config.JWT_ISSUER, TOKEN_AUDIENCE).sign({ userId, sessionId, roles }).token
}
