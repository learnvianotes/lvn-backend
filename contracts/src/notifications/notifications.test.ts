import { pushMessage } from './index'

const ok = {
  title: 'Priya commented on your note',
  body: 'Tap to read it',
  data: { notificationId: '0199c0de-0000-7000-8000-000000000001', category: 'COMMENT', deepLink: 'learnvianotes://n/os-notes-0199c0de' },
}

describe('pushMessage', () => {
  it('accepts ids, a category and an app link', () => {
    expect(pushMessage.parse(ok).data.category).toBe('COMMENT')
    expect(pushMessage.parse({ ...ok, data: { ...ok.data, deepLink: 'https://learnvianotes.com/n/x' } })).toBeTruthy()
  })

  it('refuses content in the data block, foreign links and long text', () => {
    expect(() => pushMessage.parse({ ...ok, data: { ...ok.data, commentText: 'secret' } })).toThrow()
    expect(() => pushMessage.parse({ ...ok, data: { ...ok.data, deepLink: 'https://evil.example/x' } })).toThrow()
    expect(() => pushMessage.parse({ ...ok, body: 'x'.repeat(121) })).toThrow()
    expect(() => pushMessage.parse({ ...ok, extra: true })).toThrow()
  })
})
