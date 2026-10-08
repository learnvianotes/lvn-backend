import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2'
import nodemailer from 'nodemailer'
import { Resend } from 'resend'

export interface OutgoingMail {
  from: string
  to: string
  subject: string
  html: string
  text: string
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
    await this.transporter.sendMail(mail)
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
        Destination: { ToAddresses: [mail.to] },
        Content: { Simple: { Subject: utf8(mail.subject), Body: { Html: utf8(mail.html), Text: utf8(mail.text) } } },
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
    const { error } = await this.client.emails.send(mail)
    if (error) throw new Error(`Resend refused the email: ${error.name}`)
  }
}
