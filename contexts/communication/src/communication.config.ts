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
  /** Links in emails (ADR-0022) */
  webUrl: string
  /** Keys unsubscribe tokens (ADR-0050) */
  hmacSecret: string
  /** FCM HTTP v1 (ADR-0050); null leaves push off */
  push: { apiUrl: string; tokenUrl: string; serviceAccountJson: string } | null
}

export const communicationConfigFrom = (c: ApiConfig): CommunicationConfig => ({
  mailFrom: c.MAIL_FROM,
  mailTransport: c.MAIL_TRANSPORT,
  smtpUrl: c.SMTP_URL,
  resendApiKey: c.RESEND_API_KEY,
  sesRegion: c.SES_REGION,
  jwtPublicKey: c.JWT_PUBLIC_KEY,
  jwtIssuer: c.JWT_ISSUER,
  webUrl: c.WEB_URL,
  hmacSecret: c.CODE_HMAC_SECRET,
  push: c.FCM_API_URL && c.GOOGLE_OAUTH_TOKEN_URL && c.FCM_SERVICE_ACCOUNT_JSON ? { apiUrl: c.FCM_API_URL, tokenUrl: c.GOOGLE_OAUTH_TOKEN_URL, serviceAccountJson: c.FCM_SERVICE_ACCOUNT_JSON } : null,
})
