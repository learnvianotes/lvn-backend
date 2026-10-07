/**
 * Mail facade (§6.1: `communication` owns email). Other contexts inject MAILER and send a named template with its
 * data; they never build HTML or talk to a mail provider. The communication context binds the implementation.
 */
export const MAILER = Symbol('MAILER')

/** Every transactional email and the data it needs. Links are complete URLs built from WEB_URL (ADR-0022). */
export interface MailTemplates {
  /** Confirm the sign-in email of a password account */
  verifyEmail: { displayName: string; link: string }
  resetPassword: { displayName: string; link: string; expiresInMinutes: number }
  /** Sent after a password change or reset, so an unexpected change is noticed */
  passwordChanged: { displayName: string }
  /** 6-digit code for a college or organisation email (ADR-0017) */
  institutionalCode: { displayName: string; code: string; expiresInMinutes: number }
}

export type MailTemplate = keyof MailTemplates

export interface Mailer {
  send<T extends MailTemplate>(to: string, template: T, data: MailTemplates[T]): Promise<void>
}
