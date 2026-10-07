import { Injectable, Logger } from '@nestjs/common'
import { render } from '@react-email/render'
import type { Mailer, MailTemplate, MailTemplates } from '@lvn-backend/facades'
import { TEMPLATES } from './templates'
import type { MailTransport } from './transport'

/** Renders a template and hands it to the configured transport. Logs never contain the body (§7.2). */
@Injectable()
export class MailService implements Mailer {
  private readonly log = new Logger('Mail')

  constructor(private readonly transport: MailTransport, private readonly from: string) {}

  async send<T extends MailTemplate>(to: string, template: T, data: MailTemplates[T]): Promise<void> {
    const def = TEMPLATES[template]
    const element = def.element(data)
    const [html, text] = await Promise.all([render(element), render(element, { plainText: true })])
    await this.transport.send({ from: this.from, to, subject: def.subject(data), html, text })
    this.log.log(`sent ${template}`)
  }
}
