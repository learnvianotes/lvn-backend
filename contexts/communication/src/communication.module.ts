import { Global, Module, type DynamicModule } from '@nestjs/common'
import { MAILER } from '@lvn-backend/facades'
import { MailService } from './mail/mail.service'
import { ResendTransport, SmtpTransport, type MailTransport } from './mail/transport'

export interface CommunicationConfig {
  mailFrom: string
  mailTransport: 'smtp' | 'resend'
  smtpUrl?: string
  resendApiKey?: string
}

/**
 * The `communication` bounded context (spec §6.1) — Postgres schema `comms`.
 * Owns: notifications, preferences, push (FCM), email, digests, WebSocket fan-out for subscriptions.
 * Imported only by the composition roots (apps/api, apps/worker); other contexts reach it through its
 * facade interface in libs/facades (MAILER), never by importing this package (enforced by dependency-cruiser).
 */
@Global()
@Module({})
export class CommunicationModule {
  static forRoot(config: CommunicationConfig): DynamicModule {
    const transport: MailTransport =
      config.mailTransport === 'resend' ? new ResendTransport(config.resendApiKey!) : new SmtpTransport(config.smtpUrl!)
    const mailer = new MailService(transport, config.mailFrom)
    return {
      module: CommunicationModule,
      providers: [{ provide: MAILER, useValue: mailer }],
      exports: [MAILER],
    }
  }
}
