import { applyDecorators, Inject, Injectable, Module, SetMetadata, UseGuards, type CanActivate, type DynamicModule, type ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ErrorCode } from '@lvn/contracts/domain'
import { AppError } from '@lvn-backend/errors'
import { requestContext, type Viewer } from './viewer'

/** Default window for admin operations: 12 hours after the code was accepted. */
export const MFA_MAX_AGE_SECONDS = 12 * 60 * 60

export const REQUIRE_MFA = 'lvn:requireMfa'
export const MFA_POLICY = Symbol('MFA_POLICY')

export interface MfaPolicy {
  /** ADMIN_MFA_REQUIRED. When false, only an opted-in account (mfaReq on the token) is challenged. */
  enforced: boolean
  /** Global roles that must pass MFA while `enforced` is true. */
  roles: readonly string[]
}

export interface RequireMfaOptions {
  /** Seconds since `mfaAt`. Default 12 hours. */
  maxAgeSeconds?: number
  /** ADMIN_MFA_REQUIRED on admin operations. MFA_REQUIRED for any later non-admin use. */
  code?: 'MFA_REQUIRED' | 'ADMIN_MFA_REQUIRED'
}

/** Role policy, or the token says this account opted in. A recovery window skips both. */
export function mfaNeeded(viewer: Viewer, policy: MfaPolicy): boolean {
  if (viewer.mfaExempt) return false
  if (viewer.mfaReq) return true
  return policy.enforced && viewer.roles.some((role) => policy.roles.includes(role))
}

/** The access token carries a fresh `otp` authentication method. */
export function mfaSatisfied(viewer: Viewer, maxAgeSeconds: number, now = Math.floor(Date.now() / 1000)): boolean {
  if (!viewer.mfa || viewer.mfaAt == null || !viewer.amr.includes('otp')) return false
  return now - viewer.mfaAt <= maxAgeSeconds
}

/**
 * True when this resolver method (or its class) was marked with `@RequireMfa()`.
 * Tests use it to prove every admin operation is covered.
 */
export function operationRequiresMfa(method: object, type?: object): boolean {
  return Reflect.getMetadata(REQUIRE_MFA, method) != null || (type != null && Reflect.getMetadata(REQUIRE_MFA, type) != null)
}

/** Rejects an admin or opted-in caller whose session has not finished MFA inside `maxAgeSeconds`. */
export function RequireMfa(options: RequireMfaOptions = {}): MethodDecorator & ClassDecorator {
  const value: Required<RequireMfaOptions> = {
    maxAgeSeconds: options.maxAgeSeconds ?? MFA_MAX_AGE_SECONDS,
    code: options.code ?? 'ADMIN_MFA_REQUIRED',
  }
  return applyDecorators(SetMetadata(REQUIRE_MFA, value), UseGuards(MfaGuard))
}

@Injectable()
export class MfaGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(MFA_POLICY) private readonly policy: MfaPolicy,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<Required<RequireMfaOptions> | undefined>(REQUIRE_MFA, [ctx.getHandler(), ctx.getClass()])
    if (!options) return true
    const viewer = requestContext(ctx).viewer
    if (!viewer) throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sign in to continue.')
    if (!mfaNeeded(viewer, this.policy)) return true
    if (mfaSatisfied(viewer, options.maxAgeSeconds)) return true
    const admin = options.code === 'ADMIN_MFA_REQUIRED'
    throw new AppError(
      admin ? ErrorCode.ADMIN_MFA_REQUIRED : ErrorCode.MFA_REQUIRED,
      admin ? 'Enter the code emailed to you before using admin tools.' : 'Enter your sign-in code to continue.',
    )
  }
}

/** Makes `MfaGuard` available to every subgraph. Resolvers would not see a provider declared only on the API module. */
@Module({})
export class MfaGuardModule {
  static forRoot(policy: MfaPolicy): DynamicModule {
    return {
      module: MfaGuardModule,
      global: true,
      providers: [{ provide: MFA_POLICY, useValue: policy }, MfaGuard],
      exports: [MFA_POLICY, MfaGuard],
    }
  }
}
