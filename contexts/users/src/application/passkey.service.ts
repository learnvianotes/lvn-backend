import { randomUUID } from 'node:crypto'
import { Inject, Injectable } from '@nestjs/common'
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server'
import { Errors } from '@lvn-backend/errors'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { RateLimiter, REDIS } from '@lvn-backend/redis'
import { clientNetwork } from '../domain/network'
import { LIMITS } from '../domain/rules'
import { USERS_CONFIG, type UsersConfig } from '../users.config'
import { SessionService, type DeviceInfo, type IssuedSession } from './session.service'

/** The two Redis calls the challenges need (the client is ioredis, provided by @lvn-backend/redis). */
interface ChallengeStore {
  set(key: string, value: string, mode: 'EX', seconds: number): Promise<unknown>
  getdel(key: string): Promise<string | null>
}

/** A challenge is good for five minutes and one use. */
const CHALLENGE_SECONDS = 300
/** A person may keep this many passkeys (one per phone, laptop, security key...). */
export const MAX_PASSKEYS = 10
const NOT_RECOGNISED = 'That passkey was not recognised. Try again, or sign in another way.'

export interface PasskeyRow {
  id: string
  name: string
  createdAt: Date
  lastUsedAt: Date | null
  backedUp: boolean
}

/**
 * Passkeys (WebAuthn, ADR-0115): sign in with the phone's or laptop's screen lock instead of a password. Only the
 * public key is stored; the private key never leaves the device, so a database leak gives nothing to sign in with.
 * Registration needs a signed-in session; sign-in is discoverable (the browser offers the passkeys it has for this
 * site), so no email is typed. Challenges live in Redis for five minutes and are deleted on first use. A counter that
 * goes backwards means a cloned authenticator and is refused.
 */
@Injectable()
export class PasskeyService {
  constructor(
    private readonly db: PrismaService,
    private readonly limiter: RateLimiter,
    private readonly sessions: SessionService,
    @Inject(REDIS) private readonly redis: ChallengeStore,
    @Inject(USERS_CONFIG) private readonly config: UsersConfig,
  ) {}

  /** The site the passkeys belong to: the web app's host name, and the origins allowed to use them. */
  private site(): { rpID: string; origins: string[] } {
    const web = new URL(this.config.webUrl)
    return { rpID: web.hostname, origins: [web.origin, ...(this.config.passkeyOrigins ?? [])] }
  }

  async list(userId: string): Promise<PasskeyRow[]> {
    return this.db.passkeyCredential.findMany({ where: { userId }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true, createdAt: true, lastUsedAt: true, backedUp: true } })
  }

  /** Options for `navigator.credentials.create`, as JSON. The browser must answer within five minutes. */
  async startRegistration(userId: string): Promise<string> {
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, displayName: true, deletedAt: true, passkeys: { select: { credentialId: true, transports: true } } } })
    if (!user || user.deletedAt) throw Errors.unauthenticated('Sign in again.')
    if (user.passkeys.length >= MAX_PASSKEYS) throw Errors.validation(`You can keep up to ${MAX_PASSKEYS} passkeys. Remove one first.`)
    const { rpID } = this.site()
    const options = await generateRegistrationOptions({
      rpName: 'LearnViaNotes',
      rpID,
      userName: user.email,
      userDisplayName: user.displayName,
      userID: new TextEncoder().encode(user.id),
      attestationType: 'none',
      excludeCredentials: user.passkeys.map((p) => ({ id: Buffer.from(p.credentialId).toString('base64url'), transports: p.transports as AuthenticatorTransportFuture[] })),
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    })
    await this.redis.set(`passkey:reg:${userId}`, options.challenge, 'EX', CHALLENGE_SECONDS)
    return JSON.stringify(options)
  }

  /** Checks the browser's answer and keeps the public key. `name` is what the person calls this device. */
  async finishRegistration(userId: string, responseJson: string, name: string): Promise<PasskeyRow> {
    const expectedChallenge = await this.redis.getdel(`passkey:reg:${userId}`)
    if (!expectedChallenge) throw Errors.validation('This passkey request expired. Start again.')
    const response = parseJson<RegistrationResponseJSON>(responseJson)
    const { rpID, origins } = this.site()
    const verified = await verifyRegistrationResponse({ response, expectedChallenge, expectedOrigin: origins, expectedRPID: rpID, requireUserVerification: true }).catch(() => null)
    if (!verified?.verified) throw Errors.validation('The passkey could not be saved. Try again.')
    const { credential, credentialBackedUp } = verified.registrationInfo
    const row = await this.db.passkeyCredential
      .create({
        data: {
          id: newId(),
          userId,
          credentialId: Buffer.from(credential.id, 'base64url'),
          publicKey: Buffer.from(credential.publicKey),
          counter: BigInt(credential.counter),
          transports: credential.transports ?? [],
          name: cleanName(name),
          backedUp: credentialBackedUp,
        },
        select: { id: true, name: true, createdAt: true, lastUsedAt: true, backedUp: true },
      })
      .catch(() => {
        throw Errors.conflict('This passkey is already saved.')
      })
    return row
  }

  /** Options for `navigator.credentials.get`, and the id that names this attempt. No email: the browser offers its passkeys. */
  async startSignIn(ip?: string): Promise<{ attemptId: string; optionsJson: string }> {
    const network = clientNetwork(ip)
    if (network) {
      const hit = await this.limiter.hit(`passkey-start:${network}`, LIMITS.passkeyStartPerNetwork)
      if (!hit.allowed) throw Errors.rateLimited(hit.retryAfter, 'Too many sign-in attempts from your network. Try again in a few minutes.')
    }
    const { rpID } = this.site()
    const options = await generateAuthenticationOptions({ rpID, userVerification: 'required' })
    const attemptId = randomUUID()
    await this.redis.set(`passkey:auth:${attemptId}`, options.challenge, 'EX', CHALLENGE_SECONDS)
    return { attemptId, optionsJson: JSON.stringify(options) }
  }

  async finishSignIn(attemptId: string, responseJson: string, device: DeviceInfo, ip?: string): Promise<IssuedSession> {
    const network = clientNetwork(ip)
    const fail = async (): Promise<never> => {
      if (network) await this.limiter.hit(`signin-fail:${network}`, LIMITS.signInFailuresPerNetwork)
      throw Errors.validation(NOT_RECOGNISED)
    }
    if (network) {
      const fromNetwork = await this.limiter.peek(`signin-fail:${network}`, LIMITS.signInFailuresPerNetwork)
      if (!fromNetwork.allowed) throw Errors.rateLimited(fromNetwork.retryAfter, 'Too many failed sign-ins from your network. Try again in a few minutes.')
    }
    const expectedChallenge = /^[0-9a-f-]{36}$/.test(attemptId) ? await this.redis.getdel(`passkey:auth:${attemptId}`) : null
    if (!expectedChallenge) throw Errors.validation('This sign-in expired. Try again.')
    const response = parseJson<AuthenticationResponseJSON>(responseJson)
    const stored = await this.db.passkeyCredential.findUnique({ where: { credentialId: Buffer.from(response.id ?? '', 'base64url') }, include: { user: { select: { id: true, deletedAt: true } } } })
    if (!stored || stored.user.deletedAt) return fail()
    const { rpID, origins } = this.site()
    const verified = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origins,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: { id: response.id, publicKey: new Uint8Array(stored.publicKey), counter: Number(stored.counter), transports: stored.transports as AuthenticatorTransportFuture[] },
    }).catch(() => null)
    if (!verified?.verified) return fail()
    const next = BigInt(verified.authenticationInfo.newCounter)
    // Counters that move must move forward; a step back means a copied authenticator.
    if (next !== 0n && next <= stored.counter) return fail()
    await this.db.passkeyCredential.update({ where: { id: stored.id }, data: { counter: next, lastUsedAt: new Date(), backedUp: verified.authenticationInfo.credentialBackedUp } })
    return this.sessions.start(stored.userId, device)
  }

  async rename(userId: string, id: string, name: string): Promise<PasskeyRow> {
    const { count } = await this.db.passkeyCredential.updateMany({ where: { id, userId }, data: { name: cleanName(name) } })
    if (!count) throw Errors.notFound('Passkey not found.')
    return (await this.list(userId)).find((p) => p.id === id)!
  }

  async remove(userId: string, id: string): Promise<void> {
    const { count } = await this.db.passkeyCredential.deleteMany({ where: { id, userId } })
    if (!count) throw Errors.notFound('Passkey not found.')
  }
}

function parseJson<T>(raw: string): T {
  if (raw.length > 64_000) throw Errors.validation('That answer is too large.')
  try {
    return JSON.parse(raw) as T
  } catch {
    throw Errors.validation('That answer could not be read.')
  }
}

/** A short plain name: control characters gone, at most 60 characters, "Passkey" when empty. */
export function cleanName(raw: string): string {
  const name = raw.replace(/[\p{Cc}\p{Cf}]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 60)
  return name || 'Passkey'
}
