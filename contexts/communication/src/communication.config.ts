import type { ApiConfig } from '@lvn/contracts/config'

export const COMMUNICATION_CONFIG = Symbol('COMMUNICATION_CONFIG')

export interface CommunicationConfig {
  mailFrom: string
  mailTransport: 'smtp' | 'resend' | 'ses'
  smtpUrl?: string
  resendApiKey?: string
  sesRegion?: string
  /** Live updates check access tokens themselves (ADR-0042) */
  jwtPublicKey: string
  jwtIssuer: string
}

export const communicationConfigFrom = (c: ApiConfig): CommunicationConfig => ({
  mailFrom: c.MAIL_FROM,
  mailTransport: c.MAIL_TRANSPORT,
  smtpUrl: c.SMTP_URL,
  resendApiKey: c.RESEND_API_KEY,
  sesRegion: c.SES_REGION,
  jwtPublicKey: c.JWT_PUBLIC_KEY,
  jwtIssuer: c.JWT_ISSUER,
})
