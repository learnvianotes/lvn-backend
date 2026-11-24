/**
 * Mail facade (§6.1: `communication` owns email). Other contexts inject MAILER and send a named template with its
 * data; they never build HTML or talk to a mail provider. The communication context binds the implementation.
 */
export const MAILER = Symbol('MAILER')

/** Every transactional email and the data it needs. Links are complete URLs built from WEB_URL (ADR-0022). */
export interface MailTemplates {
  /** Confirm the sign-in email of a password account */
  verifyEmail: { displayName: string; link: string }
  /** Confirm adding a password to an account that already signs in another way (ADR-0100) */
  linkEmail: { displayName: string; link: string }
  resetPassword: { displayName: string; link: string; expiresInMinutes: number }
  /** Sent after a password change or reset, so an unexpected change is noticed */
  passwordChanged: { displayName: string }
  /** 6-digit code for a college or organisation email (ADR-0017) */
  institutionalCode: { displayName: string; code: string; expiresInMinutes: number }
  /** 6-digit sign-in code. `admin` chooses the subject used for platform admins and staff. */
  mfaCode: { displayName: string; code: string; expiresInMinutes: number; ip: string; requestedAt: string; admin: boolean }
  /** ADR-0088: the account will be deleted on deleteOn unless the person signs in and cancels */
  accountDeletion: { displayName: string; deleteOn: string; link: string }
  /** ADR-0018: the data export is ready to download, until expiresOn */
  dataExportReady: { displayName: string; link: string; expiresOn: string }
  /** ADR-0050: a class announcement, to each member who keeps these emails on */
  classroomPost: { displayName: string; teacherName: string; classroomName: string; text: string; link: string; unsubscribeLink: string }
  /** ADR-0050: the week's unread notifications, counted by kind */
  weeklyDigest: { displayName: string; lines: string[]; link: string; unsubscribeLink: string }
  /**
   * Once, when a person first gives their name and age. `lines` is what that account can do (a restricted minor
   * is not offered public sharing). Links are absolute, from WEB_URL.
   */
  welcome: { displayName: string; appLink: string; guideLink: string; lines: string[] }
  /**
   * Direct notice to a parent when a minor account is created (ADR-0110). Transactional. `confirmLink` is null when
   * email confirmation is turned off. Sending this does not record consent.
   */
  guardianNotice: {
    childName: string
    noticeVersion: string
    confirmLink: string | null
    manageLink: string
    collects: string[]
    why: string
    processors: string[]
    expiresInHours: number
    supportEmail: string
  }
  /** The second email of email plus: sent only after the parent clicks the confirm link. */
  guardianConsentConfirmed: { childName: string; manageLink: string; expiresInHours: number; supportEmail: string }
  /** A new manage link, when the child or parent asks for another. Single use. */
  guardianManageLink: { childName: string; manageLink: string; expiresInHours: number; supportEmail: string }
}

export type MailTemplate = keyof MailTemplates

export interface MailOptions {
  /** One-click unsubscribe (RFC 8058): sets List-Unsubscribe and List-Unsubscribe-Post to this address */
  unsubscribeUrl?: string
}

export interface Mailer {
  send<T extends MailTemplate>(to: string, template: T, data: MailTemplates[T], options?: MailOptions): Promise<void>
}
