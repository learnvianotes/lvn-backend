import { Button, Heading, Text } from '@react-email/components'
import type { MailTemplates } from '@lvn-backend/facades'
import { Layout, button, muted, paragraph } from './Layout'

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
