import { ErrorCode } from '@lvn/contracts/domain'
import { AppError } from '@lvn-backend/errors'
import { ageRestrictedMessage } from './rules'

export const AccountStatus = { ACTIVE: 'ACTIVE', AGE_BLOCKED: 'AGE_BLOCKED', BLOCKED: 'BLOCKED', SUSPENDED: 'SUSPENDED' } as const
export type AccountStatus = (typeof AccountStatus)[keyof typeof AccountStatus]

/** Age-blocked and blocked accounts are not listed, searched, or shown on a public profile. */
export function isPublicAccount(status: AccountStatus): boolean {
  return status === 'ACTIVE' || status === 'SUSPENDED'
}

export function ageRestrictedError(supportEmail: string, field?: string[]): AppError {
  return new AppError(ErrorCode.AGE_RESTRICTED, ageRestrictedMessage(supportEmail), field, undefined, supportEmail)
}

export function blockedSignInError(supportEmail: string): AppError {
  return new AppError(ErrorCode.VALIDATION, `This account is blocked. Contact an admin at ${supportEmail}.`, undefined, undefined, supportEmail)
}

/** What a sign-in or a new session must refuse. Null means the account may sign in. */
export function signInRefusal(status: AccountStatus): 'age' | 'blocked' | null {
  if (status === 'AGE_BLOCKED') return 'age'
  if (status === 'BLOCKED' || status === 'SUSPENDED') return 'blocked'
  return null
}

export function refusalError(status: AccountStatus, supportEmail: string, field?: string[]): AppError | null {
  const kind = signInRefusal(status)
  if (kind === 'age') return ageRestrictedError(supportEmail, field)
  if (kind === 'blocked') return blockedSignInError(supportEmail)
  return null
}
