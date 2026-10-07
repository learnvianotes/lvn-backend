import { createHash } from 'node:crypto'
import { Inject, Injectable, Logger } from '@nestjs/common'
import argon2 from 'argon2'
import { Errors } from '@lvn-backend/errors'
import { PASSWORD_MAX, PASSWORD_MIN } from '../domain/rules'
import { USERS_CONFIG, type UsersConfig } from '../users.config'

/** OWASP Argon2id baseline: 19 MiB, 2 iterations, 1 lane. */
const ARGON2 = { type: argon2.argon2id, memoryCost: 19 * 1024, timeCost: 2, parallelism: 1 } as const

/** Hash of a random password, verified against when an account does not exist, so timing does not reveal it. */
const DUMMY_HASH = argon2.hash('dummy-password-for-timing', ARGON2)

@Injectable()
export class PasswordService {
  private readonly log = new Logger('Passwords')

  constructor(@Inject(USERS_CONFIG) private readonly config: UsersConfig) {}

  /** §7.1: length bounds and the breached-password list; throws VALIDATION on input.password. */
  async assertAcceptable(password: string, field = ['input', 'password']): Promise<void> {
    if (password.length < PASSWORD_MIN) throw Errors.validation(`Use at least ${PASSWORD_MIN} characters.`, field)
    if (password.length > PASSWORD_MAX) throw Errors.validation(`Use at most ${PASSWORD_MAX} characters.`, field)
    if (!password.trim()) throw Errors.validation('Choose a password that is not only spaces.', field)
    if (await this.isBreached(password)) {
      throw Errors.validation('This password has appeared in a data breach. Choose a different one.', field)
    }
  }

  hash(password: string): Promise<string> {
    return argon2.hash(password, ARGON2)
  }

  /** Compares in constant time; `hash` null (no account, or a provider-only account) still costs one verification. */
  async verify(hash: string | null, password: string): Promise<boolean> {
    try {
      const ok = await argon2.verify(hash ?? (await DUMMY_HASH), password)
      return hash !== null && ok
    } catch {
      return false
    }
  }

  needsRehash(hash: string): boolean {
    return argon2.needsRehash(hash, ARGON2)
  }

  /**
   * k-anonymity check (Have I Been Pwned range API): only the first five characters of the SHA-1 leave the server.
   * If the service cannot be reached the password is accepted and the outage logged — sign-up must not depend on a
   * third party being up.
   */
  private async isBreached(password: string): Promise<boolean> {
    const base = this.config.passwordBreachApiUrl
    if (!base) return false
    const sha1 = createHash('sha1').update(password).digest('hex').toUpperCase()
    const prefix = sha1.slice(0, 5)
    const suffix = sha1.slice(5)
    try {
      const res = await fetch(`${base.replace(/\/$/, '')}/${prefix}`, { headers: { 'Add-Padding': 'true' }, signal: AbortSignal.timeout(2000) })
      if (!res.ok) throw new Error(`status ${res.status}`)
      const body = await res.text()
      return body.split('\n').some((line) => {
        const [hashSuffix, count] = line.trim().split(':')
        return hashSuffix === suffix && Number(count) > 0
      })
    } catch (err) {
      this.log.warn(`breached-password check unavailable: ${err instanceof Error ? err.message : String(err)}`)
      return false
    }
  }
}
