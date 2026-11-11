import type { MailTemplate, MailTemplates } from '@lvn-backend/facades'
import type { ReactElement } from 'react'
import { AccountDeletion, ClassroomPost, DataExportReady, GuardianConsentConfirmed, GuardianManageLink, GuardianNotice, InstitutionalCode, LinkEmail, PasswordChanged, ResetPassword, VerifyEmail, WeeklyDigest, Welcome } from './emails'

export { MailContact } from './Layout'

type Definition<T extends MailTemplate> = { subject: (data: MailTemplates[T]) => string; element: (data: MailTemplates[T]) => ReactElement }

/** Subject and body of every email (React Email, §2). */
export const TEMPLATES: { [T in MailTemplate]: Definition<T> } = {
  verifyEmail: { subject: () => 'Confirm your email', element: (d) => <VerifyEmail {...d} /> },
  linkEmail: { subject: () => 'Add a password to your account', element: (d) => <LinkEmail {...d} /> },
  resetPassword: { subject: () => 'Reset your password', element: (d) => <ResetPassword {...d} /> },
  passwordChanged: { subject: () => 'Your password was changed', element: (d) => <PasswordChanged {...d} /> },
  institutionalCode: { subject: (d) => `${d.code} is your LearnViaNotes code`, element: (d) => <InstitutionalCode {...d} /> },
  accountDeletion: { subject: (d) => `Your LearnViaNotes account will be deleted on ${d.deleteOn}`, element: (d) => <AccountDeletion {...d} /> },
  dataExportReady: { subject: () => 'Your LearnViaNotes data is ready', element: (d) => <DataExportReady {...d} /> },
  classroomPost: { subject: (d) => `${d.teacherName} posted in ${d.classroomName}`, element: (d) => <ClassroomPost {...d} /> },
  weeklyDigest: { subject: () => 'Your week on LearnViaNotes', element: (d) => <WeeklyDigest {...d} /> },
  welcome: { subject: () => 'Welcome to LearnViaNotes', element: (d) => <Welcome {...d} /> },
  guardianNotice: { subject: () => 'A LearnViaNotes account was created', element: (d) => <GuardianNotice {...d} /> },
  guardianConsentConfirmed: { subject: () => 'You confirmed a LearnViaNotes account', element: (d) => <GuardianConsentConfirmed {...d} /> },
  guardianManageLink: { subject: () => 'Manage a LearnViaNotes account', element: (d) => <GuardianManageLink {...d} /> },
}
