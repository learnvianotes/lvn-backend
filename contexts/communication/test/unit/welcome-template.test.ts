import type { OutgoingMail } from '../../src/mail/transport'
import { MailService } from '../../src/mail/mail.service'

const LINES = ['Read and find notes', 'Write your own notes and share them', 'Join groups and classrooms']

describe('welcome email', () => {
  it('renders HTML and plain text with the name, the app, the guide and support', async () => {
    const sent: OutgoingMail[] = []
    const mailer = new MailService(
      { send: async (mail) => { sent.push(mail) } },
      'LearnViaNotes <no-reply@learnvianotes.in>',
      'support@learnvianotes.in',
    )
    await mailer.send('asha@college.edu', 'welcome', {
      displayName: 'Asha',
      appLink: 'https://app.learnvianotes.in',
      guideLink: 'https://app.learnvianotes.in/guide',
      lines: LINES,
    })
    expect(sent).toHaveLength(1)
    const mail = sent[0]!
    expect(mail.subject).toBe('Welcome to LearnViaNotes')
    expect(mail.replyTo).toBe('support@learnvianotes.in')
    expect(mail.from).toBe('LearnViaNotes <no-reply@learnvianotes.in>')
    for (const body of [mail.html, mail.text]) {
      expect(body).toContain('Asha')
      expect(body).toContain('https://app.learnvianotes.in')
      expect(body).toContain('https://app.learnvianotes.in/guide')
      expect(body).toContain('support@learnvianotes.in')
      for (const line of LINES) expect(body).toContain(line)
    }
    expect(mail.html).toContain('<html')
    expect(mail.text).not.toContain('<html')
  })
})
