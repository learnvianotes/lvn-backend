import { Errors } from '@lvn-backend/errors'
import { emailSchema } from './rules'

/**
 * The parent address an admitted sign-up under 18 must give (ADR-0110). Stored on the guardian consent, never as
 * the child's own contact. The child's login email is rejected. Call this only once the age is allowed to register;
 * a sign-up below the floor is refused before this, and keeps no parent address.
 */
export function requireParentEmail(childEmail: string, raw: string | null | undefined): string {
  if (raw == null || raw.trim() === '') throw Errors.validation('Enter a parent or guardian email address.', ['input', 'parentEmail'])
  const parsed = emailSchema.safeParse(raw)
  if (!parsed.success) throw Errors.validation(parsed.error.issues[0]?.message ?? 'Enter a valid email address.', ['input', 'parentEmail'])
  if (parsed.data === childEmail.trim().toLowerCase()) throw Errors.validation('Use a parent or guardian email, not the account email.', ['input', 'parentEmail'])
  return parsed.data
}
