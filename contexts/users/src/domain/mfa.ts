/**
 * Who must pass a second factor, and which factors exist.
 * Email OTP is the only factor that can be started. TOTP and WebAuthn are reserved so a later factor
 * does not change the guard or the session claims.
 */

export const MFA_MAX_AGE_SECONDS = 12 * 60 * 60
export const MFA_CODE_TTL_MINUTES = 10
export const MFA_MAX_ATTEMPTS = 5
export const MFA_PURPOSE_SIGN_IN = 'sign_in'

export const MfaFactorType = { EMAIL_OTP: 'EMAIL_OTP', TOTP: 'TOTP', WEBAUTHN: 'WEBAUTHN' } as const
export type MfaFactorType = (typeof MfaFactorType)[keyof typeof MfaFactorType]

/** Factors a client may pass to startMfaChallenge. Only email OTP runs today. */
export const IMPLEMENTED_FACTORS: readonly MfaFactorType[] = [MfaFactorType.EMAIL_OTP]

export interface MfaSubject {
  globalRole: string
  mfaOptIn: boolean
  mfaExemptUntil: Date | null
}

export interface MfaPolicyConfig {
  /** ADMIN_MFA_REQUIRED. Opt-in still applies when this is false. */
  enforced: boolean
  /** Global roles, for example PLATFORM_ADMIN and MANAGER. */
  roles: readonly string[]
}

/** True when this account must finish MFA before protected operations. */
export function mfaRequiredFor(user: MfaSubject, policy: MfaPolicyConfig, now = new Date()): boolean {
  if (user.mfaExemptUntil && user.mfaExemptUntil.getTime() > now.getTime()) return false
  // TODO: the account screen does not offer this switch yet. The API stores it so a later UI can.
  if (user.mfaOptIn) return true
  if (!policy.enforced) return false
  return policy.roles.includes(user.globalRole)
}

/** True when a verification timestamp is still inside the window (12 hours for admin operations). */
export function mfaFresh(verifiedAt: Date | null | undefined, maxAgeSeconds: number, now = new Date()): boolean {
  if (!verifiedAt) return false
  return now.getTime() - verifiedAt.getTime() <= maxAgeSeconds * 1000
}

/**
 * Factors the sign-in response offers. Email is always available for an account that needs MFA,
 * because the code goes to the account's own address. A future TOTP row would be added here.
 */
export function allowedFactors(required: boolean): MfaFactorType[] {
  return required ? [MfaFactorType.EMAIL_OTP] : []
}

export function isImplementedFactor(factor: string): factor is MfaFactorType {
  return (IMPLEMENTED_FACTORS as readonly string[]).includes(factor)
}
