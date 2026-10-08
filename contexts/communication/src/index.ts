// Public surface of the `communication` context. Nothing else is exported (spec §3).
export { CommunicationModule, type CommunicationConfig } from './communication.module'
/** Implementation of the MAILER facade, bound by the composition roots. */
export { MailService } from './mail/mail.service'
