import { render } from '@react-email/render'
import { TEMPLATES } from '../../src/mail/templates'

describe('email templates', () => {
  it('put the link in the verify and reset emails', async () => {
    const verify = await render(TEMPLATES.verifyEmail.element({ displayName: 'Asha', link: 'http://localhost:3000/verify?token=abc' }))
    expect(verify).toContain('href="http://localhost:3000/verify?token=abc"')
    expect(verify).toContain('Hi <!-- -->Asha')
    expect(verify).toContain('mailto:support@learnvianotes.in')
    const reset = await render(TEMPLATES.resetPassword.element({ displayName: 'Asha', link: 'http://x/reset?token=t', expiresInMinutes: 60 }), { plainText: true })
    expect(reset).toContain('expires in 60 minutes')
  })

  it('show the institutional code in the subject and body', async () => {
    const data = { displayName: 'Ravi', code: '482913', expiresInMinutes: 15 }
    expect(TEMPLATES.institutionalCode.subject(data)).toBe('482913 is your LearnViaNotes code')
    expect(await render(TEMPLATES.institutionalCode.element(data), { plainText: true })).toContain('482913')
  })

  it('escape user-provided names', async () => {
    const html = await render(TEMPLATES.passwordChanged.element({ displayName: '<script>alert(1)</script>' }))
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })
})
