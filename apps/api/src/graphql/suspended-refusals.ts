import { Inject, Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common'
import { GqlExecutionContext } from '@nestjs/graphql'
import { catchError, from, mergeMap, type Observable, throwError } from 'rxjs'
import type { RequestContext } from '@lvn-backend/auth-guard'
import { AppError, ErrorCode, Errors } from '@lvn-backend/errors'
import { POLICY, type Policy } from '@lvn-backend/facades'

const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

/**
 * Why a suspended person's change was refused (ADR-0053). Every context refuses through `can()` with its own words,
 * most of them about verification; for a suspended account the real reason is the suspension, so a refused mutation
 * says so, with the date it ends. Queries and everyone else's refusals pass through unchanged.
 */
@Injectable()
export class SuspendedRefusals implements NestInterceptor {
  constructor(@Inject(POLICY) private readonly policy: Policy) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (ctx.getType<string>() !== 'graphql') return next.handle()
    const gql = GqlExecutionContext.create(ctx)
    const viewer = gql.getContext<RequestContext>().viewer
    if (!viewer || gql.getInfo<{ operation: { operation: string } }>().operation.operation !== 'mutation') return next.handle()
    return next.handle().pipe(
      catchError((e: unknown) => {
        if (!(e instanceof AppError) || e.code !== ErrorCode.FORBIDDEN) return throwError(() => e)
        return from(this.policy.suspension(viewer.userId)).pipe(
          mergeMap((s) => throwError(() => (s ? Errors.forbidden(`Your account is suspended until ${day.format(s.until)}, so nothing you do reaches other people until then.`) : e))),
        )
      }),
    )
  }
}
