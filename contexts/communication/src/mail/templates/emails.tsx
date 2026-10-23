import { Button, Heading, Text } from '@react-email/components'
import type { MailTemplates } from '@lvn-backend/facades'
import { Layout, brand, button, muted, paragraph } from './Layout'

const heading = { fontSize: 20, fontWeight: 700, margin: '0 0 12px' }

export function VerifyEmail({ displayName, link }: MailTemplates['verifyEmail']) {
  return (
    <Layout preview="Confirm your email for LearnViaNotes">
      <Heading as="h1" style={heading}>Confirm your email</Heading>
      <Text style={paragraph}>Hi {displayName}, tap the button to confirm this is your email address.</Text>
      <Button href={link} style={button}>Confirm email</Button>
      <Text style={muted}>The link works once and expires in 24 hours.</Text>
    </Layout>
  )
}

export function LinkEmail({ displayName, link }: MailTemplates['linkEmail']) {
  return (
    <Layout preview="Add a password to your LearnViaNotes account">
      <Heading as="h1" style={heading}>Add a password</Heading>
      <Text style={paragraph}>Hi {displayName}, someone asked to sign in with a password on the account that already uses this email. If it was you, confirm and the password will be added. Your other sign-in methods stay as they are.</Text>
      <Button href={link} style={button}>Add password</Button>
      <Text style={muted}>The link works once and expires in 24 hours. If you did not ask for this, ignore this email. Nothing changes.</Text>
    </Layout>
  )
}

export function ResetPassword({ displayName, link, expiresInMinutes }: MailTemplates['resetPassword']) {
  return (
    <Layout preview="Reset your LearnViaNotes password">
      <Heading as="h1" style={heading}>Reset your password</Heading>
      <Text style={paragraph}>Hi {displayName}, someone asked to reset the password of your account. If it was you, choose a new one:</Text>
      <Button href={link} style={button}>Choose a new password</Button>
      <Text style={muted}>The link works once and expires in {expiresInMinutes} minutes. If you did not ask for this, your password is unchanged.</Text>
    </Layout>
  )
}

export function PasswordChanged({ displayName }: MailTemplates['passwordChanged']) {
  return (
    <Layout preview="Your LearnViaNotes password was changed">
      <Heading as="h1" style={heading}>Your password was changed</Heading>
      <Text style={paragraph}>Hi {displayName}, the password of your account was just changed and every device was signed out.</Text>
      <Text style={muted}>If this was not you, reset your password straight away from the sign-in page.</Text>
    </Layout>
  )
}

export function AccountDeletion({ displayName, deleteOn, link }: MailTemplates['accountDeletion']) {
  return (
    <Layout preview="Your LearnViaNotes account will be deleted">
      <Heading as="h1" style={heading}>Your account will be deleted</Heading>
      <Text style={paragraph}>Hi {displayName}, you asked to delete your LearnViaNotes account. On {deleteOn} your account, your private notes and your learning history will be deleted for good. Notes you made public stay, by "Deleted user".</Text>
      <Text style={paragraph}>Changed your mind? Sign in before then and cancel:</Text>
      <Button href={link} style={button}>Keep my account</Button>
      <Text style={muted}>If this was not you, sign in, cancel, and change your password straight away. Every other device was signed out.</Text>
    </Layout>
  )
}

export function DataExportReady({ displayName, link, expiresOn }: MailTemplates['dataExportReady']) {
  return (
    <Layout preview="Your LearnViaNotes data is ready to download">
      <Heading as="h1" style={heading}>Your data is ready</Heading>
      <Text style={paragraph}>Hi {displayName}, the archive of your notes and account data you asked for is ready. Download it from your account page:</Text>
      <Button href={link} style={button}>Download your data</Button>
      <Text style={muted}>The download is available until {expiresOn}. Keep the file somewhere safe: it holds your personal data.</Text>
    </Layout>
  )
}

export function InstitutionalCode({ displayName, code, expiresInMinutes }: MailTemplates['institutionalCode']) {
  return (
    <Layout preview={`Your LearnViaNotes code is ${code}`}>
      <Heading as="h1" style={heading}>Confirm your college email</Heading>
      <Text style={paragraph}>Hi {displayName}, enter this code in the app to verify your account:</Text>
      <Text style={{ fontSize: 32, fontWeight: 800, letterSpacing: 8, margin: '8px 0 16px' }}>{code}</Text>
      <Text style={muted}>It expires in {expiresInMinutes} minutes. Only you can see this address on LearnViaNotes.</Text>
    </Layout>
  )
}

export function ClassroomPost({ displayName, teacherName, classroomName, text, link, unsubscribeLink }: MailTemplates['classroomPost']) {
  return (
    <Layout preview={`${teacherName} posted in ${classroomName}`}>
      <Heading as="h1" style={heading}>
        New in {classroomName}
      </Heading>
      <Text style={paragraph}>
        Hi {displayName}, {teacherName} posted an announcement:
      </Text>
      <Text style={{ ...paragraph, whiteSpace: 'pre-line', borderLeft: `3px solid ${brand.primary}`, paddingLeft: 12 }}>{text}</Text>
      <Button href={link} style={button}>
        Open the class
      </Button>
      <Text style={muted}>
        You get these because you are in {classroomName}. <a href={unsubscribeLink}>Stop emails about class announcements</a>.
      </Text>
    </Layout>
  )
}

export function WeeklyDigest({ displayName, lines, link, unsubscribeLink }: MailTemplates['weeklyDigest']) {
  return (
    <Layout preview="Your week on LearnViaNotes">
      <Heading as="h1" style={heading}>
        Your week on LearnViaNotes
      </Heading>
      <Text style={paragraph}>Hi {displayName}, here is what is waiting for you:</Text>
      {lines.map((line) => (
        <Text key={line} style={{ ...paragraph, margin: '0 0 6px' }}>
          • {line}
        </Text>
      ))}
      <Button href={link} style={button}>
        See your notifications
      </Button>
      <Text style={muted}>
        <a href={unsubscribeLink}>Stop the weekly email</a>.
      </Text>
    </Layout>
  )
}
