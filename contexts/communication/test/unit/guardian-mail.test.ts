import { render } from '@react-email/render'
import type { MailTemplates } from '@lvn-backend/facades'
import { TEMPLATES } from '../../src/mail/templates'

const MARKETING = ['unsubscribe', 'offer', 'discount', 'sale', 'newsletter']

const notice: MailTemplates['guardianNotice'] = {
  childName: 'Asha Rao',
  noticeVersion: '2026-11-11',
  confirmLink: 'https://app.learnvianotes.in/guardian/confirm?token=confirm-token',
  manageLink: 'https://app.learnvianotes.in/guardian/manage?token=manage-token',
  collects: ['The child’s name, age and email address'],
  why: 'To provide the LearnViaNotes account the child created.',
  processors: ['LearnViaNotes, to run the account', 'Resend, to send this message and other account email'],
  expiresInHours: 72,
  supportEmail: 'support@learnvianotes.in',
}

async function textOf<T extends keyof MailTemplates>(template: T, data: MailTemplates[T]): Promise<{ subject: string; text: string; html: string }> {
  const definition = TEMPLATES[template]
  const element = definition.element(data)
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })])
  return { subject: definition.subject(data), text, html }
}

function expectNoMarketing(text: string, html: string) {
  const blob = `${text}\n${html}`.toLowerCase()
  for (const word of MARKETING) expect(blob).not.toContain(word)
}

describe('guardian emails', () => {
  it('renders the notice without treating it as consent, and without marketing', async () => {
    const mail = await textOf('guardianNotice', notice)
    expect(mail.subject).toBe('A LearnViaNotes account was created')
    expect(mail.text).toContain('does not record your consent')
    expect(mail.text).toContain('Asha Rao')
    expect(mail.text).toContain('2026-11-11')
    expect(mail.text).toContain(notice.confirmLink!)
    expect(mail.text).toContain(notice.manageLink)
    expect(mail.text).toContain('Resend')
    expect(mail.text).toContain('support@learnvianotes.in')
    expectNoMarketing(mail.text, mail.html)
  })

  it('renders the follow-up after a click, saying consent was given and how to withdraw it', async () => {
    const mail = await textOf('guardianConsentConfirmed', {
      childName: 'Asha Rao',
      manageLink: notice.manageLink,
      expiresInHours: 72,
      supportEmail: 'support@learnvianotes.in',
    })
    expect(mail.subject).toBe('You confirmed a LearnViaNotes account')
    expect(mail.text).toContain('Consent was recorded')
    expect(mail.text).toContain('withdraw')
    expect(mail.text).toContain(notice.manageLink)
    expectNoMarketing(mail.text, mail.html)
  })

  it('renders a replacement manage link as a single-use message', async () => {
    const mail = await textOf('guardianManageLink', {
      childName: 'Asha Rao',
      manageLink: notice.manageLink,
      expiresInHours: 72,
      supportEmail: 'support@learnvianotes.in',
    })
    expect(mail.subject).toBe('Manage a LearnViaNotes account')
    expect(mail.text).toContain('works once')
    expect(mail.text).toContain('withdraw consent')
    expectNoMarketing(mail.text, mail.html)
  })
})
