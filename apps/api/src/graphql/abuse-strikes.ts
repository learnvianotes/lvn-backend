import { Global, Inject, Injectable, Logger, Module, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common'
import { GqlExecutionContext } from '@nestjs/graphql'
import { catchError, from, mergeMap, type Observable, throwError } from 'rxjs'
import type { RequestContext, Viewer } from '@lvn-backend/auth-guard'
import { AppError, ErrorCode } from '@lvn-backend/errors'
import { AUDIT, POLICY, type Audit, type Policy } from '@lvn-backend/facades'
import { RateLimiter, SessionRevocations } from '@lvn-backend/redis'

/** Refused requests in one hour that put an account on an automatic hold (ADR-0116). */
export const STRIKES_BEFORE_HOLD = 40
export const STRIKE_WINDOW_SECONDS = 60 * 60
/** How long the automatic hold lasts. A moderator can lift it sooner, or make it longer. */
export const HOLD_MINUTES = 60
/** Staff are never held automatically: an admin running a bulk tool must not lock themselves out. */
const EXEMPT_ROLES = new Set(['PLATFORM_ADMIN', 'MANAGER', 'MODERATOR'])
export const HOLD_REASON = 'Automatic hold: too many refused requests in an hour. It ends by itself; write to support if this was a mistake.'

/**
 * Strikes (ADR-0116). Every request a signed-in person makes that a rate limit refuses is a strike. Someone using the
 * app normally almost never hits a limit; a script hammering it hits them hundreds of times. At STRIKES_BEFORE_HOLD
 * strikes in an hour the account is suspended for HOLD_MINUTES (nothing it does reaches other people, ADR-0053), the
 * session that did it is revoked, and the hold is written to the audit log for moderators. Fails open: a Redis or
 * database problem never refuses a request by itself.
 */
@Injectable()
export class AbuseStrikes {
  private readonly log = new Logger('AbuseStrikes')

  constructor(
    private readonly limiter: RateLimiter,
    private readonly revocations: SessionRevocations,
    @Inject(POLICY) private readonly policy: Policy,
    @Inject(AUDIT) private readonly audit: Audit,
  ) {}

  async strike(viewer: Viewer, reason: string, ip?: string): Promise<void> {
    if (viewer.roles.some((r) => EXEMPT_ROLES.has(r))) return
    try {
      const hit = await this.limiter.hit(`strike:${viewer.userId}`, { max: STRIKES_BEFORE_HOLD, windowSeconds: STRIKE_WINDOW_SECONDS })
      if (hit.allowed) return
      if (await this.policy.suspension(viewer.userId)) return
      const until = new Date(Date.now() + HOLD_MINUTES * 60_000)
      await this.policy.suspend(viewer.userId, until, HOLD_REASON)
      await this.revocations.revoke(viewer.sessionId, 15 * 60)
      await this.audit.record({ actorId: null, action: 'abuse.auto_hold', targetType: 'User', targetId: viewer.userId, metadata: { reason, strikes: STRIKES_BEFORE_HOLD, until: until.toISOString() }, ip: ip ?? null })
      this.log.warn(`automatic hold on ${viewer.userId} until ${until.toISOString()} (${reason})`)
    } catch (e) {
      this.log.error(`strike not recorded: ${(e as Error).message}`)
    }
  }
}

/** Counts a strike for each RATE_LIMITED refusal a signed-in person gets from any resolver. */
@Injectable()
export class AbuseStrikeInterceptor implements NestInterceptor {
  constructor(private readonly strikes: AbuseStrikes) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (ctx.getType<string>() !== 'graphql') return next.handle()
    const request = GqlExecutionContext.create(ctx).getContext<RequestContext>()
    const viewer = request.viewer
    if (!viewer) return next.handle()
    return next.handle().pipe(
      catchError((e: unknown) => {
        if (!(e instanceof AppError) || e.code !== ErrorCode.RATE_LIMITED) return throwError(() => e)
        return from(this.strikes.strike(viewer, 'rate-limited', request.req.ip)).pipe(mergeMap(() => throwError(() => e)))
      }),
    )
  }
}

/** Global so the GraphQL module's request-limit factory can inject AbuseStrikes. */
@Global()
@Module({ providers: [AbuseStrikes], exports: [AbuseStrikes] })
export class AbuseModule {}
