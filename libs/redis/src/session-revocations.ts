import { Inject, Injectable } from '@nestjs/common'
import type Redis from 'ioredis'
import { REDIS } from './tokens'

/**
 * Access tokens are stateless for 15 minutes (§7.1). When a session family is revoked (sign-out, refresh-token
 * reuse, password reset, account deletion) its id is marked here for that long, so its outstanding access tokens
 * stop working at once.
 */
@Injectable()
export class SessionRevocations {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async revoke(sessionFamilyId: string, ttlSeconds: number): Promise<void> {
    await this.redis.set(`revoked:sid:${sessionFamilyId}`, '1', 'EX', ttlSeconds)
  }

  async isRevoked(sessionFamilyId: string): Promise<boolean> {
    return (await this.redis.exists(`revoked:sid:${sessionFamilyId}`)) === 1
  }
}
