import { Module, type DynamicModule } from '@nestjs/common'
import type { ApiConfig } from '@lvn/contracts/config'
import { MailService } from './mail/mail.service'
import { ResendTransport, SesTransport, SmtpTransport, type MailTransport } from './mail/transport'

export interface CommunicationConfig {
  mailFrom: string
  mailTransport: 'smtp' | 'resend' | 'ses'
  smtpUrl?: string
  resendApiKey?: string
  sesRegion?: string
}

export const communicationConfigFrom = (c: ApiConfig): CommunicationConfig => ({
  mailFrom: c.MAIL_FROM,
  mailTransport: c.MAIL_TRANSPORT,
  smtpUrl: c.SMTP_URL,
  resendApiKey: c.RESEND_API_KEY,
  sesRegion: c.SES_REGION,
})

/**
 * The `communication` bounded context (spec §6.1) — Postgres schema `comms`.
 * Owns: notifications, preferences, push (FCM), email, digests, WebSocket fan-out for subscriptions.
 * Imported only by the composition roots (apps/api, apps/worker); other contexts reach it through its
 * facade interface in libs/facades (MAILER), never by importing this package (enforced by dependency-cruiser).
 * Never global: GraphQL subgraphs follow module imports, so a global context would leak its resolvers.
 */
@Module({})
export class CommunicationModule {
  static forRoot(config: CommunicationConfig): DynamicModule {
    const transport: MailTransport =
      config.mailTransport === 'ses'
        ? new SesTransport(config.sesRegion!)
        : config.mailTransport === 'resend'
          ? new ResendTransport(config.resendApiKey!)
          : new SmtpTransport(config.smtpUrl!)
    return {
      module: CommunicationModule,
      providers: [{ provide: MailService, useValue: new MailService(transport, config.mailFrom) }],
      exports: [MailService],
    }
  }
}
