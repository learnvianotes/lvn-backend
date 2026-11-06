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
    mailer = new MailService(new SmtpTransport(mailpit.smtpUrl), 'LearnViaNotes <no-reply@learnvianotes.in>', 'support@learnvianotes.in')
  })

  afterAll(() => stop())

  it('delivers a rendered template with HTML and plain text', async () => {
    await mailer.send('asha@college.edu', 'resetPassword', { displayName: 'Asha', link: 'http://localhost:3000/reset?token=xyz', expiresInMinutes: 60 })
    const mail = await mailbox.latestTo('asha@college.edu')
    expect(mail.subject).toBe('Reset your password')
    expect(mail.html).toContain('http://localhost:3000/reset?token=xyz')
    expect(mail.text).toContain('Choose a new password')
    expect(mail.text).toContain('support@learnvianotes.in')
    const headers = await mailbox.headers(mail.id)
    expect(headers['Reply-To']).toEqual(['support@learnvianotes.in'])
  })

  it('marks emails people can leave with one-click unsubscribe headers (RFC 8058, ADR-0050)', async () => {
    const unsubscribe = 'http://localhost:3000/unsubscribe?t=abc.def'
    await mailer.send('ravi@college.edu', 'classroomPost', { displayName: 'Ravi', teacherName: 'Ms Rao', classroomName: 'Physics 9A', text: 'Test on Friday', link: 'http://localhost:3000/classes/c1', unsubscribeLink: unsubscribe }, { unsubscribeUrl: unsubscribe })
    const mail = await mailbox.latestTo('ravi@college.edu')
    expect(mail.subject).toBe('Ms Rao posted in Physics 9A')
    expect(mail.text).toContain('Test on Friday')
    expect(mail.html).toContain(unsubscribe)
    const headers = await mailbox.headers(mail.id)
    expect(headers['List-Unsubscribe']).toEqual([`<${unsubscribe}>`])
    expect(headers['List-Unsubscribe-Post']).toEqual(['List-Unsubscribe=One-Click'])
  })
})
