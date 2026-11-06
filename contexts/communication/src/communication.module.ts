import { Module, type DynamicModule } from '@nestjs/common'
import { JsonScalar } from '@lvn-backend/graphql'
import { COMMUNICATION_CONFIG, type CommunicationConfig } from './communication.config'
import { NotificationsResolver } from './graphql/notifications.resolver'
import { SettingsResolver } from './graphql/settings.resolver'
import { EmailNotificationsService } from './email/email-notifications.service'
import { PreferencesService } from './preferences/preferences.service'
import { DevicesService } from './push/devices.service'
import { PushService } from './push/push.service'
import { LiveHub } from './live/live-hub'
import { LiveNotifier } from './live/live-notifier'
import { LiveServer } from './live/live-server'
import { MailService } from './mail/mail.service'
import { ResendTransport, SesTransport, SmtpTransport, type MailTransport } from './mail/transport'
import { CommunicationEvents } from './notifications/communication-events'
import { NotificationService } from './notifications/notification.service'

/**
 * The `communication` bounded context (spec §6.1) — Postgres schema `comms`.
 * Owns: notifications, preferences, push (FCM), email, digests, WebSocket fan-out for subscriptions (ADR-0042).
 * Imported only by the composition roots (apps/api, apps/worker); other contexts reach it through its
 * facade interface in libs/facades (MAILER) or through events, never by importing this package (enforced by
 * dependency-cruiser). Never global: GraphQL subgraphs follow module imports, so a global context would leak its
 * resolvers. `serveLive` is for apps/api, which holds the sockets; the worker only publishes.
 */
@Module({})
export class CommunicationModule {
  static forRoot(config: CommunicationConfig, options: { serveLive?: boolean } = {}): DynamicModule {
    const transport: MailTransport =
      config.mailTransport === 'ses'
        ? new SesTransport(config.sesRegion!)
        : config.mailTransport === 'resend'
          ? new ResendTransport(config.resendApiKey!)
          : new SmtpTransport(config.smtpUrl!)
    return {
      module: CommunicationModule,
      providers: [
        { provide: COMMUNICATION_CONFIG, useValue: config },
        { provide: MailService, useValue: new MailService(transport, config.mailFrom, config.mailReplyTo) },
        LiveHub,
        LiveNotifier,
        NotificationService,
        CommunicationEvents,
        NotificationsResolver,
        PreferencesService,
        DevicesService,
        PushService,
        EmailNotificationsService,
        SettingsResolver,
        JsonScalar,
        ...(options.serveLive ? [LiveServer] : []),
      ],
      exports: [MailService, NotificationService, LiveHub, LiveNotifier, PushService, DevicesService, EmailNotificationsService],
    }
  }
}
