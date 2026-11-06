import type { SendEmailCommand } from '@aws-sdk/client-sesv2'
import { SesTransport } from '../../src/mail/transport'

describe('SesTransport', () => {
  it('sends one simple UTF-8 email with HTML and text through the SES API', async () => {
    const sent: SendEmailCommand[] = []
    const transport = new SesTransport('ap-south-1', { send: async (command: SendEmailCommand) => void sent.push(command) } as never)
    await transport.send({ from: 'LearnViaNotes <no-reply@learnvianotes.in>', replyTo: 'support@learnvianotes.in', to: 'asha@college.edu', subject: 'Your code — 123456', html: '<p>Code</p>', text: 'Code' })
    expect(sent).toHaveLength(1)
    expect(sent[0]!.input).toEqual({
      FromEmailAddress: 'LearnViaNotes <no-reply@learnvianotes.in>',
      ReplyToAddresses: ['support@learnvianotes.in'],
      Destination: { ToAddresses: ['asha@college.edu'] },
      Content: {
        Simple: {
          Subject: { Data: 'Your code — 123456', Charset: 'UTF-8' },
          Body: { Html: { Data: '<p>Code</p>', Charset: 'UTF-8' }, Text: { Data: 'Code', Charset: 'UTF-8' } },
        },
      },
    })
  })

  it('lets an SES refusal reach the caller (the job retries it)', async () => {
    const transport = new SesTransport('ap-south-1', { send: async () => Promise.reject(new Error('Email address is not verified.')) } as never)
    await expect(transport.send({ from: 'a@example.com', to: 'b@example.com', subject: 's', html: 'h', text: 't' })).rejects.toThrow('not verified')
  })
})
