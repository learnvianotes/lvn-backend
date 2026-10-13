import { pushMessage } from '@lvn/contracts/notifications'
import { readUnsubscribeToken, unsubscribeToken } from '../../src/email/unsubscribe'
import { inQuietHours, localTime } from '../../src/preferences/preferences.service'
import { pushBody } from '../../src/push/push.service'

describe('quiet hours (ADR-0050)', () => {
  it('reads the time of day in the person’s time zone', () => {
    const at = new Date('2026-10-12T17:00:00Z')
    expect(localTime(at, 'Asia/Kolkata')).toBe('22:30')
    expect(localTime(at, 'UTC')).toBe('17:00')
  })

  it('spans midnight when the start is later than the end, and is off when they are equal', () => {
    expect(inQuietHours('22:30', '22:00', '07:00')).toBe(true)
    expect(inQuietHours('06:59', '22:00', '07:00')).toBe(true)
    expect(inQuietHours('07:00', '22:00', '07:00')).toBe(false)
    expect(inQuietHours('13:00', '12:00', '14:00')).toBe(true)
    expect(inQuietHours('14:00', '12:00', '14:00')).toBe(false)
    expect(inQuietHours('03:00', '00:00', '00:00')).toBe(false)
  })
})

describe('push text (ADR-0021)', () => {
  it('names the actor, never quotes content, and has no names for a restricted minor', () => {
    expect(pushBody('COMMENT', { kind: 'REPLY' }, 'Priya')).toBe('Priya replied to your comment')
    expect(pushBody('SHARE', {}, null)).toBe('Someone shared a note with you')
    expect(pushBody('DOUBT', { kind: 'ANSWERED' }, 'Ms Rao')).toBe('Ms Rao answered your doubt')
    expect(pushBody('QUIZ_PUBLISHED', {}, 'Ms Rao')).toBe('Ms Rao published a quiz to your class')
    // An exam's revision (ADR-0070) says nothing of the exam; a buddy invite (ADR-0072) names who asked.
    expect(pushBody('REVISION_REMINDER', { examName: 'Physics' }, null)).toBe('Today’s revision for your exam is waiting')
    expect(pushBody('RHYTHM_BUDDY', { kind: 'REQUESTED' }, 'Asha')).toBe('Asha asked you to be Rhythm buddies')
    expect(pushBody('RHYTHM_BUDDY', { kind: 'ACCEPTED' }, null)).toBe('Someone is now your Rhythm buddy')
    expect(pushBody('STREAK_AT_RISK', {}, 'Ms Rao')).toBe('You have something new')
  })

  it('fits the strict contract: ids, category and an in-app path only', () => {
    const ok = { title: 'LearnViaNotes', body: pushBody('FOLLOW', {}, 'Priya'), data: { notificationId: '01920000-0000-7000-8000-000000000001', category: 'FOLLOW', path: '/u/priya' } }
    expect(pushMessage.parse(ok)).toEqual(ok)
    expect(() => pushMessage.parse({ ...ok, data: { ...ok.data, text: 'smuggled' } })).toThrow()
    expect(() => pushMessage.parse({ ...ok, data: { ...ok.data, path: 'https://evil.example/x' } })).toThrow()
  })
})

describe('unsubscribe tokens (ADR-0050)', () => {
  const secret = 'x'.repeat(32)
  it('carry the person and the kind, and refuse anything altered', () => {
    const token = unsubscribeToken(secret, '01920000-0000-7000-8000-000000000001', 'DIGEST')
    expect(readUnsubscribeToken(secret, token)).toEqual({ userId: '01920000-0000-7000-8000-000000000001', kind: 'DIGEST' })
    expect(readUnsubscribeToken('y'.repeat(32), token)).toBeNull()
    const [, sig] = token.split('.')
    const forged = `${Buffer.from('01920000-0000-7000-8000-000000000002.DIGEST').toString('base64url')}.${sig}`
    expect(readUnsubscribeToken(secret, forged)).toBeNull()
    expect(readUnsubscribeToken(secret, 'nonsense')).toBeNull()
  })
})
