import { Inject, Injectable } from '@nestjs/common'
import { Errors } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { MAILER, type Mailer } from '@lvn-backend/facades'
import { newId, Prisma, PrismaService } from '@lvn-backend/prisma-base'
import { RateLimiter } from '@lvn-backend/redis'
import { domainAndParents, domainOf, isAcademic, isPersonalOrDisposable } from '../domain/email-domains'
import { emailSchema } from '../domain/rules'
import { USERS_CONFIG, type UsersConfig } from '../users.config'
import { MX_LOOKUP, type MxLookup } from './providers'
import { hmac, sameBytes, sixDigitCode } from './secrets'

export const CODE_TTL_MINUTES = 15
export const MAX_CODE_ATTEMPTS = 5
const SENDS_PER_HOUR = { max: 3, windowSeconds: 3600 }

export type InstitutionalStatus = 'NONE' | 'CODE_SENT' | 'CONFIRMED' | 'PENDING_REVIEW'

/**
 * College and organisation emails (ADR-0017): a 6-digit code to the address proves the person studies or works
 * there. Personal and disposable domains are refused and the domain must accept mail. A domain of a known
 * organisation, or a recognised academic suffix, verifies the account; any other domain is confirmed but waits for
 * a platform admin to approve the domain (ADR-0019 queue).
 */
@Injectable()
export class InstitutionalEmailService {
  constructor(
    private readonly db: PrismaService,
    private readonly limiter: RateLimiter,
    @Inject(MAILER) private readonly mailer: Mailer,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(MX_LOOKUP) private readonly mx: MxLookup,
    @Inject(USERS_CONFIG) private readonly config: UsersConfig,
  ) {}

  /** Checks an address before anything is stored, so sign-up can refuse it as a field error. */
  async check(raw: string, field: string[]): Promise<{ email: string; domain: string }> {
    const parsed = emailSchema.safeParse(raw)
    if (!parsed.success) throw Errors.validation('Enter a valid email address.', field)
    const email = parsed.data
    const domain = domainOf(email)
    if (isPersonalOrDisposable(domain)) throw Errors.validation('Use your college or organisation email, not a personal one.', field)
    if (!(await this.mx.acceptsMail(domain))) throw Errors.validation('This domain does not receive email. Check the address.', field)
    const taken = await this.db.institutionalEmail.findFirst({ where: { email, verifiedAt: { not: null }, replacedAt: null }, select: { userId: true } })
    if (taken) throw Errors.conflict('This address already verifies another account.', field)
    return { email, domain }
  }

  /** Stores the address as pending and sends it a code. A previous pending address is replaced. */
  async start(userId: string, raw: string, field = ['input', 'institutionalEmail']): Promise<void> {
    const { email, domain } = await this.check(raw, field)
    const current = await this.db.institutionalEmail.findFirst({ where: { userId, verifiedAt: { not: null }, replacedAt: null }, select: { email: true } })
    if (current?.email === email) throw Errors.conflict('This address is already confirmed on your account.', field)
    await this.limitSends(userId)

    const organizationId = await this.organizationFor(domain)
    const id = newId()
    const code = sixDigitCode()
    await this.db.$transaction([
      this.db.institutionalEmail.deleteMany({ where: { userId, verifiedAt: null, replacedAt: null } }),
      this.db.institutionalEmail.create({
        data: { id, userId, email, domain, organizationId, codeHash: hmac(this.config.codeHmacSecret, `${id}:${code}`), codeExpiresAt: this.expiry() },
      }),
    ])
    if (!organizationId) await this.recordDomain(domain)
    await this.send(userId, email, code)
  }

  /** A new code for the pending address. */
  async resend(userId: string): Promise<void> {
    const pending = await this.pending(userId)
    await this.limitSends(userId)
    const code = sixDigitCode()
    await this.db.institutionalEmail.update({
      where: { id: pending.id },
      data: { codeHash: hmac(this.config.codeHmacSecret, `${pending.id}:${code}`), codeExpiresAt: this.expiry(), attempts: 0 },
    })
    await this.send(userId, pending.email, code)
  }

  /** Confirms the pending address with its code; returns whether the account is now verified. */
  async verify(userId: string, rawCode: string): Promise<{ verified: boolean; pendingReview: boolean }> {
    const field = ['input', 'code']
    const pending = await this.pending(userId)
    if (!pending.codeHash || !pending.codeExpiresAt || pending.codeExpiresAt <= new Date()) throw Errors.validation('This code has expired. Ask for a new one.', field)
    if (pending.attempts >= MAX_CODE_ATTEMPTS) throw Errors.validation('Too many wrong codes. Ask for a new one.', field)
    const code = rawCode.trim()
    if (!/^\d{6}$/.test(code) || !sameBytes(hmac(this.config.codeHmacSecret, `${pending.id}:${code}`), pending.codeHash)) {
      const { attempts } = await this.db.institutionalEmail.update({ where: { id: pending.id }, data: { attempts: { increment: 1 } }, select: { attempts: true } })
      const left = MAX_CODE_ATTEMPTS - attempts
      throw Errors.validation(left > 0 ? `That code is not right. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Too many wrong codes. Ask for a new one.', field)
    }

    const eligible = !!pending.organizationId || isAcademic(pending.domain) || (await this.domainApproved(pending.domain))
    let newlyVerified = false
    try {
      await this.db.$transaction(async (tx) => {
        const now = new Date()
        await tx.institutionalEmail.updateMany({ where: { userId, verifiedAt: { not: null }, replacedAt: null }, data: { replacedAt: now } })
        await tx.institutionalEmail.update({ where: { id: pending.id }, data: { verifiedAt: now, codeHash: null, codeExpiresAt: null } })
        if (!eligible) return
        const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { verifiedAt: true } })
        if (!user.verifiedAt) {
          await tx.user.update({ where: { id: userId }, data: { verifiedAt: now, verificationMethod: 'INSTITUTIONAL_EMAIL' } })
          newlyVerified = true
        }
        // A faculty address is evidence, not a role: membership starts as STUDENT; TEACHER comes from review (§5).
        if (pending.organizationId) {
          await tx.membership.upsert({
            where: { userId_organizationId: { userId, organizationId: pending.organizationId } },
            create: { userId, organizationId: pending.organizationId, role: 'STUDENT' },
            update: {},
          })
        }
      })
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw Errors.conflict('This address already verifies another account.', field)
      throw e
    }
    if (newlyVerified) {
      await this.events.publish('InstitutionVerified', {
        userId,
        method: 'INSTITUTIONAL_EMAIL',
        ...(pending.organizationId ? { organizationId: pending.organizationId } : {}),
      })
    }
    return { verified: eligible, pendingReview: !eligible }
  }

  /** What the viewer sees about their institutional email. */
  async statusOf(userId: string): Promise<{ email: string | null; status: InstitutionalStatus; institution: { name: string; verified: boolean } | null }> {
    const rows = await this.db.institutionalEmail.findMany({
      where: { userId, replacedAt: null },
      include: { organization: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    })
    const pending = rows.find((r) => !r.verifiedAt)
    const confirmed = rows.find((r) => r.verifiedAt)
    const institution = confirmed?.organization ? { name: confirmed.organization.name, verified: true } : null
    if (pending) return { email: pending.email, status: 'CODE_SENT', institution }
    if (!confirmed) return { email: null, status: 'NONE', institution: null }
    const eligible = !!confirmed.organizationId || isAcademic(confirmed.domain) || (await this.domainApproved(confirmed.domain))
    return { email: confirmed.email, status: eligible ? 'CONFIRMED' : 'PENDING_REVIEW', institution }
  }

  private async pending(userId: string) {
    const row = await this.db.institutionalEmail.findFirst({ where: { userId, verifiedAt: null, replacedAt: null } })
    if (!row) throw Errors.notFound('There is no address waiting for a code. Add your college email first.')
    return row
  }

  private async limitSends(userId: string): Promise<void> {
    const limit = await this.limiter.hit(`instcode:${userId}`, SENDS_PER_HOUR)
    if (!limit.allowed) throw Errors.rateLimited(limit.retryAfter, 'You can ask for 3 codes an hour. Try again later.')
  }

  private async send(userId: string, email: string, code: string): Promise<void> {
    const { displayName } = await this.db.user.findUniqueOrThrow({ where: { id: userId }, select: { displayName: true } })
    await this.mailer.send(email, 'institutionalCode', { displayName, code, expiresInMinutes: CODE_TTL_MINUTES })
  }

  /** The organisation that owns this domain or one of its parents (cse.iitb.ac.in → iitb.ac.in). */
  private async organizationFor(domain: string): Promise<string | null> {
    const org = await this.db.organization.findFirst({ where: { emailDomains: { hasSome: domainAndParents(domain) } }, select: { id: true } })
    return org?.id ?? null
  }

  private async recordDomain(domain: string): Promise<void> {
    await this.db.domainReview.upsert({
      where: { domain },
      create: { domain, status: isAcademic(domain) ? 'ACADEMIC_QUEUED' : 'NEEDS_REVIEW' },
      update: { requests: { increment: 1 } },
    })
  }

  private async domainApproved(domain: string): Promise<boolean> {
    const reviews = await this.db.domainReview.findMany({ where: { domain: { in: domainAndParents(domain) } }, select: { status: true } })
    return reviews.some((r) => r.status === 'APPROVED')
  }

  private expiry(): Date {
    return new Date(Date.now() + CODE_TTL_MINUTES * 60_000)
  }
}
