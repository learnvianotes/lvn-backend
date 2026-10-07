import { parseEvent } from './index'

const base = { id: '0199c0de-0000-7000-8000-000000000001', occurredAt: '2026-10-08T10:00:00.000Z' }
const uuid = (n: number) => `0199c0de-0000-7000-8000-${String(n).padStart(12, '0')}`

describe('events', () => {
  it('accepts a well-formed event', () => {
    const e = parseEvent('NotePublished', { ...base, type: 'NotePublished', version: 1, payload: { noteId: uuid(2), versionId: uuid(3), ownerId: uuid(4), visibility: 'PUBLIC' } })
    expect(e.payload.visibility).toBe('PUBLIC')
  })

  it('carries the scope of a reviewed join request', () => {
    const e = parseEvent('JoinRequestReviewed', {
      ...base, type: 'JoinRequestReviewed', version: 1,
      payload: { requestId: uuid(2), scope: { kind: 'CLASSROOM', classroomId: uuid(3) }, userId: uuid(4), reviewerId: uuid(5), decision: 'APPROVED' },
    })
    expect(e.payload.scope.kind).toBe('CLASSROOM')
    expect(() => parseEvent('JoinRequestReviewed', { ...e, payload: { ...e.payload, decision: 'MAYBE' } })).toThrow()
  })

  it('rejects a wrong version or payload', () => {
    expect(() => parseEvent('UserDeleted', { ...base, type: 'UserDeleted', version: 2, payload: { userId: uuid(2) } })).toThrow()
    expect(() => parseEvent('UserDeleted', { ...base, type: 'UserDeleted', version: 1, payload: {} })).toThrow()
  })
})
