import type { MailTemplate, MailTemplates } from '@lvn-backend/facades'
import type { ReactElement } from 'react'
import { DataExportReady, InstitutionalCode, PasswordChanged, ResetPassword, VerifyEmail } from './emails'

type Definition<T extends MailTemplate> = { subject: (data: MailTemplates[T]) => string; element: (data: MailTemplates[T]) => ReactElement }

/** Subject and body of every email (React Email, §2). */
export const TEMPLATES: { [T in MailTemplate]: Definition<T> } = {
  verifyEmail: { subject: () => 'Confirm your email', element: (d) => <VerifyEmail {...d} /> },
  resetPassword: { subject: () => 'Reset your password', element: (d) => <ResetPassword {...d} /> },
  passwordChanged: { subject: () => 'Your password was changed', element: (d) => <PasswordChanged {...d} /> },
  institutionalCode: { subject: (d) => `${d.code} is your LearnViaNotes code`, element: (d) => <InstitutionalCode {...d} /> },
  dataExportReady: { subject: () => 'Your LearnViaNotes data is ready', element: (d) => <DataExportReady {...d} /> },
}
