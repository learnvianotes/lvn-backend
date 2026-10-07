import { Mailbox, startMailpit } from '@lvn-backend/testing'
import { MailService } from '../../src/mail/mail.service'
import { SmtpTransport } from '../../src/mail/transport'

describe('MailService over SMTP', () => {
  let mailbox: Mailbox
  let stop: () => Promise<unknown>
  let mailer: MailService

  beforeAll(async () => {
    const mailpit = await startMailpit()
    mailbox = new Mailbox(mailpit.apiUrl)
    stop = () => mailpit.container.stop()
    mailer = new MailService(new SmtpTransport(mailpit.smtpUrl), 'LearnViaNotes <no-reply@learnvianotes.in>')
  })

  afterAll(() => stop())

  it('delivers a rendered template with HTML and plain text', async () => {
    await mailer.send('asha@college.edu', 'resetPassword', { displayName: 'Asha', link: 'http://localhost:3000/reset?token=xyz', expiresInMinutes: 60 })
    const mail = await mailbox.latestTo('asha@college.edu')
    expect(mail.subject).toBe('Reset your password')
    expect(mail.html).toContain('http://localhost:3000/reset?token=xyz')
    expect(mail.text).toContain('Choose a new password')
  })
})
