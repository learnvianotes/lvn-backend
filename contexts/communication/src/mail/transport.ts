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

/** Resend — sandbox and production (§2). */
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
