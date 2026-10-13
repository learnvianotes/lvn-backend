// Public surface of the `communication` context. Nothing else is exported (spec §3).
import { communicationTypeDefs } from './graphql/schema'
import { CommunicationModule } from './communication.module'

export { CommunicationModule }
export { communicationConfigFrom, type CommunicationConfig } from './communication.config'
/** Implementation of the MAILER facade, bound by the composition roots. */
export { MailService } from './mail/mail.service'
/** In-app notifications (ADR-0042); apps/worker prunes them nightly. */
export { NotificationService, KEEP_READ_DAYS, KEEP_UNREAD_DAYS } from './notifications/notification.service'
/** Push and email beyond transactional mail (ADR-0050), run by apps/worker from these queues. */
export { COMMS_PUSH_QUEUE, PushService, pushBody } from './push/push.service'
export { DevicesService } from './push/devices.service'
export { COMMS_EMAIL_QUEUE, EmailNotificationsService } from './email/email-notifications.service'
export { unsubscribeToken, readUnsubscribeToken } from './email/unsubscribe'
export { inQuietHours, localTime } from './preferences/preferences.service'
/** Live updates (ADR-0042): the endpoint's path, its schema and the close code for a refused token. */
export { LIVE_PATH, LIVE_SDL, LIVE_FORBIDDEN } from './live/live-server'
/** The LIVE facade (ADR-0060), bound by the composition roots. */
export { LiveNotifier } from './live/live-notifier'

/** This context's federation subgraph, composed by apps/api's gateway (ADR-0033). */
export const communicationSubgraph = { name: 'communication', typeDefs: communicationTypeDefs, modules: [CommunicationModule] }
