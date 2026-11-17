import type { ApiConfig } from '@lvn/contracts/config'

export const COMMUNICATION_CONFIG = Symbol('COMMUNICATION_CONFIG')

export interface CommunicationConfig {
  mailFrom: string
  mailTransport: 'smtp' | 'resend' | 'ses'
  smtpUrl?: string
  resendApiKey?: string
  /** Product-email audience. Unset leaves audience sync off. */
  audienceId?: string
  sesRegion?: string
  /** Live updates check access tokens themselves (ADR-0042) */
  jwtPublicKey: string
  /** Issuer new tokens are signed with */
  jwtIssuer: string
  /** Previous issuers still accepted while access tokens from before a cutover expire (15 minutes) */
  jwtExtraIssuers: readonly string[]
  /** Browser origins allowed to open /graphql/live. A socket with no Origin header is a native client and is allowed. */
  liveOrigins: readonly string[]
  /** Replies to transactional mail (MAIL_REPLY_TO) */
  mailReplyTo: string
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
  audienceId: c.RESEND_AUDIENCE_ID,
  sesRegion: c.SES_REGION,
  jwtPublicKey: c.JWT_PUBLIC_KEY,
  jwtIssuer: c.JWT_ISSUER,
  jwtExtraIssuers: c.JWT_EXTRA_ISSUERS,
  liveOrigins: c.CORS_ORIGINS,
  mailReplyTo: c.MAIL_REPLY_TO,
  webUrl: c.WEB_URL,
  hmacSecret: c.CODE_HMAC_SECRET,
  push: c.FCM_API_URL && c.GOOGLE_OAUTH_TOKEN_URL && c.FCM_SERVICE_ACCOUNT_JSON ? { apiUrl: c.FCM_API_URL, tokenUrl: c.GOOGLE_OAUTH_TOKEN_URL, serviceAccountJson: c.FCM_SERVICE_ACCOUNT_JSON } : null,
})
