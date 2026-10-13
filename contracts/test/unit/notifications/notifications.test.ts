import { liveEvent, pushMessage } from '../../../src/notifications'

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

describe('liveEvent (ADR-0042)', () => {
  const event = { kind: 'NOTIFICATION', id: '0199c0de-0000-7000-8000-000000000001', at: '2026-10-12T09:00:00.000Z' }

  it('carries a kind, an id and a time', () => {
    expect(liveEvent.parse(event)).toEqual(event)
    // An Ask AI answer with more text (ADR-0060): its id, never its words.
    expect(liveEvent.parse({ ...event, kind: 'AI_ANSWER' })).toEqual({ ...event, kind: 'AI_ANSWER' })
  })

  it('carries nothing else: no text, no unknown kinds', () => {
    expect(() => liveEvent.parse({ ...event, title: 'Priya shared Heaps' })).toThrow()
    expect(() => liveEvent.parse({ ...event, kind: 'MESSAGE' })).toThrow()
    expect(() => liveEvent.parse({ ...event, id: 'note-1' })).toThrow()
  })
})
