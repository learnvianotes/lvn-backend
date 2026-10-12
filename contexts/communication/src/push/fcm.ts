import { createSign } from 'node:crypto'
import type { PushMessage } from '@lvn/contracts/notifications'

/** What FCM said about one send: delivered, the token is gone for good, or a failure worth retrying. */
export type SendResult = 'SENT' | 'GONE' | 'RETRY'

interface ServiceAccount {
  client_email: string
  private_key: string
  project_id: string
}

/**
 * FCM HTTP v1 (ADR-0021, ADR-0050): an OAuth access token from the service account (a signed JWT exchanged at Google's
 * token endpoint, kept until a minute before it expires), then one request per device token.
 */
export class FcmSender {
  private readonly account: ServiceAccount
  private cached: { token: string; until: number } | null = null

  constructor(private readonly config: { apiUrl: string; tokenUrl: string; serviceAccountJson: string }) {
    this.account = JSON.parse(config.serviceAccountJson) as ServiceAccount
  }

  private async accessToken(): Promise<string> {
    if (this.cached && this.cached.until > Date.now()) return this.cached.token
    const now = Math.floor(Date.now() / 1000)
    const encode = (v: object) => Buffer.from(JSON.stringify(v)).toString('base64url')
    const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iss: this.account.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: this.config.tokenUrl, iat: now, exp: now + 3600 })}`
    const signature = createSign('RSA-SHA256').update(unsigned).sign(this.account.private_key, 'base64url')
    const res = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`FCM token endpoint answered HTTP ${res.status}`)
    const body = (await res.json()) as { access_token: string; expires_in: number }
    this.cached = { token: body.access_token, until: Date.now() + (body.expires_in - 60) * 1000 }
    return body.access_token
  }

  async send(deviceToken: string, message: PushMessage): Promise<SendResult> {
    const url = `${this.config.apiUrl.replace(/\/$/, '')}/v1/projects/${this.account.project_id}/messages:send`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${await this.accessToken()}` },
      body: JSON.stringify({ message: { token: deviceToken, notification: { title: message.title, body: message.body }, data: message.data, android: { priority: 'high' } } }),
      signal: AbortSignal.timeout(10_000),
    })
    if (res.ok) return 'SENT'
    const body = (await res.json().catch(() => ({}))) as { error?: { status?: string; message?: string; details?: { errorCode?: string }[] } }
    const code = body.error?.details?.find((d) => d.errorCode)?.errorCode
    // UNREGISTERED: the app was removed or the token expired; an invalid token will never work either.
    if (code === 'UNREGISTERED' || res.status === 404 || (code === 'INVALID_ARGUMENT' && /token/i.test(body.error?.message ?? ''))) return 'GONE'
    if (res.status === 401) this.cached = null
    return 'RETRY'
  }
}
