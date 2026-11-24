import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2'
import nodemailer from 'nodemailer'
import { Resend } from 'resend'

export interface OutgoingMail {
  from: string
  /** Where a person's reply goes (MAIL_REPLY_TO). Omitted only when unset. */
  replyTo?: string
  to: string
  subject: string
  html: string
  text: string
  /** Extra headers, e.g. List-Unsubscribe (ADR-0050) */
  headers?: Record<string, string>
}

export interface MailTransport {
  send(mail: OutgoingMail): Promise<void>
}

/** SMTP — Mailpit locally (§2). */
export class SmtpTransport implements MailTransport {
  private readonly transporter: ReturnType<typeof nodemailer.createTransport>
  constructor(url: string) {
    this.transporter = nodemailer.createTransport(url)
  }
  async send(mail: OutgoingMail): Promise<void> {
    await this.transporter.sendMail({ from: mail.from, to: mail.to, replyTo: mail.replyTo, subject: mail.subject, html: mail.html, text: mail.text, headers: mail.headers })
  }
}

/**
 * Amazon SES through its API, signed with the credentials of the running task (the ECS task role on AWS): no SMTP
 * password or API key exists to leak or rotate. The sender must be an identity verified in SES.
 */
export class SesTransport implements MailTransport {
  constructor(
    region: string,
    private readonly client: Pick<SESv2Client, 'send'> = new SESv2Client({ region }),
  ) {}

  async send(mail: OutgoingMail): Promise<void> {
    const utf8 = (Data: string) => ({ Data, Charset: 'UTF-8' })
    await this.client.send(
      new SendEmailCommand({
        FromEmailAddress: mail.from,
        ...(mail.replyTo ? { ReplyToAddresses: [mail.replyTo] } : {}),
        Destination: { ToAddresses: [mail.to] },
        Content: { Simple: { Subject: utf8(mail.subject), Body: { Html: utf8(mail.html), Text: utf8(mail.text) }, ...(mail.headers ? { Headers: Object.entries(mail.headers).map(([Name, Value]) => ({ Name, Value })) } : {}) } },
      }),
    )
  }
}

/** Resend — a hosted alternative to SES (§2). */
export class ResendTransport implements MailTransport {
  private readonly client: Resend
  constructor(apiKey: string) {
    this.client = new Resend(apiKey)
  }
  async send(mail: OutgoingMail): Promise<void> {
    const { error } = await this.client.emails.send({ from: mail.from, to: mail.to, replyTo: mail.replyTo, subject: mail.subject, html: mail.html, text: mail.text, headers: mail.headers })
    if (error) throw new Error(`Resend refused the email: ${error.name}`)
  }
}
