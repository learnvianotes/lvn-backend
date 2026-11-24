import { createParamDecorator, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common'
import { GqlExecutionContext } from '@nestjs/graphql'
import type { GlobalRole } from '@lvn/contracts/domain'
import { Errors } from '@lvn-backend/errors'

/** The signed-in caller of a request, from a valid access token whose session is not revoked. */
export interface Viewer {
  userId: string
  sessionId: string
  roles: GlobalRole[]
  /** Authentication methods on the access token. Empty when the token predates MFA claims. */
  amr: string[]
  /** The token was issued after a second factor that was still fresh. */
  mfa: boolean
  /** Unix seconds of that verification. Null when `mfa` is false. */
  mfaAt: number | null
  /** Role policy or an opt-in said this account must pass MFA. */
  mfaReq: boolean
  /** Recovery window: do not challenge this token even though the role would require MFA. */
  mfaExempt: boolean
}

/** The GraphQL context every resolver receives (built by apps/api for the gateway). */
export interface RequestContext {
  req: { headers: Record<string, string | string[] | undefined>; cookies?: Record<string, string>; ip?: string }
  res: { cookie(name: string, value: string, options: object): void; clearCookie(name: string, options: object): void }
  requestId: string
  viewer: Viewer | null
}

export const requestContext = (ctx: ExecutionContext): RequestContext => GqlExecutionContext.create(ctx).getContext<RequestContext>()

/** `@CurrentViewer() viewer: Viewer | null` in a resolver. */
export const CurrentViewer = createParamDecorator((_: unknown, ctx: ExecutionContext): Viewer | null => requestContext(ctx).viewer)

/** Rejects anonymous callers with UNAUTHENTICATED. */
@Injectable()
export class SignedInGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    if (!requestContext(ctx).viewer) throw Errors.unauthenticated()
    return true
  }
}

/** The viewer of a guarded resolver; throws if a resolver forgot the guard. */
export function requireViewer(viewer: Viewer | null): Viewer {
  if (!viewer) throw Errors.unauthenticated()
  return viewer
}
