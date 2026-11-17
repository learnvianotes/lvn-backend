import { Inject, Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common'
import { GqlExecutionContext } from '@nestjs/graphql'
import { Reflector } from '@nestjs/core'
import { from, mergeMap, type Observable } from 'rxjs'
import { REQUIRE_MFA, type RequestContext } from '@lvn-backend/auth-guard'
import { AUDIT, type Audit } from '@lvn-backend/facades'
import { isUuid } from '@lvn-backend/prisma-base'

/**
 * Every admin mutation marked `@RequireMfa()` writes one audit row, including when the mutation returns userErrors.
 * Services may write a second, more specific row. Neither path updates or deletes the log.
 */
@Injectable()
export class AdminAuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    @Inject(AUDIT) private readonly audit: Audit,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (ctx.getType<string>() !== 'graphql') return next.handle()
    const marked = this.reflector.getAllAndOverride(REQUIRE_MFA, [ctx.getHandler(), ctx.getClass()])
    if (!marked) return next.handle()
    const gql = GqlExecutionContext.create(ctx)
    const info = gql.getInfo<{ fieldName: string; operation: { operation: string } }>()
    if (info.operation.operation !== 'mutation') return next.handle()
    const context = gql.getContext<RequestContext>()
    const viewer = context.viewer
    if (!viewer) return next.handle()
    const args = gql.getArgs<Record<string, unknown>>()
    return next.handle().pipe(
      mergeMap((result) => from(this.record(viewer.userId, info.fieldName, args, result, context).then(() => result))),
    )
  }

  private async record(actorId: string, field: string, args: Record<string, unknown>, result: unknown, ctx: RequestContext): Promise<void> {
    const errors = result && typeof result === 'object' && 'userErrors' in result ? (result as { userErrors?: unknown[] }).userErrors : undefined
    const failed = Array.isArray(errors) && errors.length > 0
    await this.audit.record({
      actorId,
      action: `admin.mutation.${field}`,
      targetType: 'AdminMutation',
      targetId: findId(args),
      metadata: { field, ok: !failed, args: args as never },
      ip: clientIp(ctx),
      userAgent: header(ctx, 'user-agent'),
    })
  }
}

function clientIp(ctx: RequestContext): string {
  const raw = ctx.req.ip ?? ''
  const ip = raw.startsWith('::ffff:') ? raw.slice('::ffff:'.length) : raw
  return ip || 'unknown'
}

function header(ctx: RequestContext, name: string): string | null {
  const value = ctx.req.headers[name]
  const text = Array.isArray(value) ? value[0] : value
  return text?.slice(0, 200) ?? null
}

function findId(value: unknown, depth = 0): string | null {
  if (!value || typeof value !== 'object' || depth > 4) return null
  if (Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  for (const key of ['id', 'userId', 'requestId', 'targetId']) {
    const found = record[key]
    if (typeof found === 'string' && isUuid(found)) return found
  }
  return findId(record.input, depth + 1)
}
