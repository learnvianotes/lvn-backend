import { Button, Heading, Text } from '@react-email/components'
import type { MailTemplates } from '@lvn-backend/facades'
import { useContext } from 'react'
import { Layout, MailContact, brand, button, muted, paragraph } from './Layout'

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

export function MfaCode({ displayName, code, expiresInMinutes, ip, requestedAt, admin }: MailTemplates['mfaCode']) {
  return (
    <Layout preview={admin ? 'Your LVN admin sign-in code' : 'Your LVN sign-in code'}>
      <Heading as="h1" style={heading}>{admin ? 'Your admin sign-in code' : 'Your sign-in code'}</Heading>
      <Text style={paragraph}>Hi {displayName}, enter this code to finish signing in{admin ? ' to the admin tools' : ''}:</Text>
      <Text style={{ fontSize: 32, fontWeight: 800, letterSpacing: 8, margin: '8px 0 16px' }}>{code}</Text>
      <Text style={muted}>It expires in {expiresInMinutes} minutes and works once. Requested at {requestedAt} from {ip}. If this was not you, you can ignore this email.</Text>
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

export function GuardianNotice({ childName, noticeVersion, confirmLink, manageLink, collects, why, processors, expiresInHours, supportEmail }: MailTemplates['guardianNotice']) {
  return (
    <Layout preview={`${childName} created a LearnViaNotes account`}>
      <Heading as="h1" style={heading}>A LearnViaNotes account was created</Heading>
      <Text style={paragraph}>{childName} created a LearnViaNotes account and gave this address as a parent or guardian. This message says what the account collects and who handles it. Receiving it does not record your consent.</Text>
      <Text style={paragraph}>What LearnViaNotes collects:</Text>
      {collects.map((line) => (
        <Text key={line} style={{ ...paragraph, margin: '0 0 6px' }}>• {line}</Text>
      ))}
      <Text style={paragraph}>Why: {why}</Text>
      <Text style={paragraph}>Who processes it:</Text>
      {processors.map((line) => (
        <Text key={line} style={{ ...paragraph, margin: '0 0 6px' }}>• {line}</Text>
      ))}
      <Text style={paragraph}>Notice version {noticeVersion}.</Text>
      {confirmLink ? (
        <>
          <Text style={paragraph}>To allow the account, confirm with the button. That is the step that records consent. If you do nothing, the account stays limited.</Text>
          <Button href={confirmLink} style={button}>Confirm consent</Button>
        </>
      ) : null}
      <Text style={paragraph}>To see a summary, download the data, withdraw consent or delete the account:</Text>
      <Button href={manageLink} style={button}>Manage the account</Button>
      <Text style={muted}>Each link works once and expires in {expiresInHours} hours. Questions? Write to {supportEmail}.</Text>
    </Layout>
  )
}

export function GuardianConsentConfirmed({ childName, manageLink, expiresInHours, supportEmail }: MailTemplates['guardianConsentConfirmed']) {
  return (
    <Layout preview={`You confirmed ${childName}'s LearnViaNotes account`}>
      <Heading as="h1" style={heading}>You confirmed this account</Heading>
      <Text style={paragraph}>You confirmed that {childName} may use LearnViaNotes. Consent was recorded when you clicked the link in the earlier message.</Text>
      <Text style={paragraph}>You can withdraw that consent, or delete the account, from the manage page. Withdrawing consent returns the account to limited use.</Text>
      <Button href={manageLink} style={button}>Manage the account</Button>
      <Text style={muted}>This link works once and expires in {expiresInHours} hours. Questions? Write to {supportEmail}.</Text>
    </Layout>
  )
}

export function GuardianManageLink({ childName, manageLink, expiresInHours, supportEmail }: MailTemplates['guardianManageLink']) {
  return (
    <Layout preview={`Manage ${childName}'s LearnViaNotes account`}>
      <Heading as="h1" style={heading}>Manage the account</Heading>
      <Text style={paragraph}>Use this link to see a summary of {childName}&apos;s LearnViaNotes account, download the data, withdraw consent or delete the account.</Text>
      <Button href={manageLink} style={button}>Manage the account</Button>
      <Text style={muted}>The link works once and expires in {expiresInHours} hours. Questions? Write to {supportEmail}.</Text>
    </Layout>
  )
}

export function Welcome({ displayName, appLink, guideLink, lines }: MailTemplates['welcome']) {
  const contactEmail = useContext(MailContact)
  return (
    <Layout preview={`Welcome to LearnViaNotes, ${displayName}`}>
      <Heading as="h1" style={heading}>Welcome to LearnViaNotes</Heading>
      <Text style={paragraph}>Hi {displayName}, your account is ready. We’re glad you’re here.</Text>
      <Text style={paragraph}>Here is what you can do:</Text>
      {lines.map((line) => (
        <Text key={line} style={{ ...paragraph, margin: '0 0 6px' }}>
          • {line}
        </Text>
      ))}
      <Button href={appLink} style={{ ...button, marginTop: 16 }}>Open LearnViaNotes</Button>
      <Text style={paragraph}>
        New here? A short guide walks you through it: <a href={guideLink} style={{ color: brand.primary }}>{guideLink}</a>
      </Text>
      <Text style={muted}>
        Questions? Write to <a href={`mailto:${contactEmail}`} style={{ color: brand.muted }}>{contactEmail}</a>.
      </Text>
    </Layout>
  )
}
