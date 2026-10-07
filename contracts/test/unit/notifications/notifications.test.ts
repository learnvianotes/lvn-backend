import { pushMessage } from '../../../src/notifications'

const ok = {
  title: 'Priya commented on your note',
  body: 'Tap to read it',
  data: { notificationId: '0199c0de-0000-7000-8000-000000000001', category: 'COMMENT', path: '/n/os-notes-0199c0de#comments' },
}

describe('pushMessage', () => {
  it('accepts ids, a category and an in-app path', () => {
    expect(pushMessage.parse(ok).data.path).toBe('/n/os-notes-0199c0de#comments')
  })

  it('refuses content in the data block, foreign links and long text', () => {
    expect(() => pushMessage.parse({ ...ok, data: { ...ok.data, commentText: 'secret' } })).toThrow()
    for (const path of ['https://evil.example/x', '//evil.example/x', 'learnvianotes://n/x', 'n/x', '/n/<script>']) {
      expect(() => pushMessage.parse({ ...ok, data: { ...ok.data, path } })).toThrow()
    }
    expect(() => pushMessage.parse({ ...ok, body: 'x'.repeat(121) })).toThrow()
    expect(() => pushMessage.parse({ ...ok, extra: true })).toThrow()
  })
})
