import { Injectable, Logger } from '@nestjs/common'
import { render } from '@react-email/render'
import { createElement } from 'react'
import type { Mailer, MailOptions, MailTemplate, MailTemplates } from '@lvn-backend/facades'
import { MailContact, TEMPLATES } from './templates'
import type { MailTransport } from './transport'

/** Renders a template and hands it to the configured transport. Logs never contain the body (§7.2). */
@Injectable()
export class MailService implements Mailer {
  private readonly log = new Logger('Mail')

  constructor(
    private readonly transport: MailTransport,
    private readonly from: string,
    private readonly replyTo: string,
  ) {}

  async send<T extends MailTemplate>(to: string, template: T, data: MailTemplates[T], options: MailOptions = {}): Promise<void> {
    const def = TEMPLATES[template]
    const element = createElement(MailContact.Provider, { value: this.replyTo }, def.element(data))
    const [html, text] = await Promise.all([render(element), render(element, { plainText: true })])
    // One-click unsubscribe (RFC 8058): mail clients POST "List-Unsubscribe=One-Click" to the address.
    const headers = options.unsubscribeUrl ? { 'List-Unsubscribe': `<${options.unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } : undefined
    await this.transport.send({ from: this.from, replyTo: this.replyTo, to, subject: def.subject(data), html, text, headers })
    this.log.log(`sent ${template}`)
  }
}
