import { contributionOf, dayBounds, learningDay } from '../../src/domain/learning-day'

/**
 * Days in a person's time zone, rolling over at 04:00 (ADR-0030, ADR-0067): India (no daylight saving, +05:30), a
 * negative offset, both daylight-saving changes, and the same instant for two people far apart.
 */
describe('learningDay', () => {
  it('counts the small hours with the day before, in India', () => {
    // 22:30 UTC on 12 Oct is 04:00 on 13 Oct in Kolkata: a new day starts exactly then.
    expect(learningDay(new Date('2026-10-12T22:29:59Z'), 'Asia/Kolkata')).toBe('2026-10-12')
    expect(learningDay(new Date('2026-10-12T22:30:00Z'), 'Asia/Kolkata')).toBe('2026-10-13')
    // 23:59 local and 01:30 local the next night are one learning day.
    expect(learningDay(new Date('2026-10-13T18:29:00Z'), 'Asia/Kolkata')).toBe('2026-10-13')
    expect(learningDay(new Date('2026-10-13T20:00:00Z'), 'Asia/Kolkata')).toBe('2026-10-13')
  })

  it('works with a negative offset and across a month end', () => {
    // New York goes back an hour at 06:00 UTC on 1 Nov 2026: 08:00 UTC is 03:00 EST, still 31 Oct's learning day;
    // 09:00 UTC is 04:00 EST, the start of 1 Nov's.
    expect(learningDay(new Date('2026-11-01T03:59:00Z'), 'America/New_York')).toBe('2026-10-31') // 23:59 EDT
    expect(learningDay(new Date('2026-11-01T08:00:00Z'), 'America/New_York')).toBe('2026-10-31')
    expect(learningDay(new Date('2026-11-01T09:00:00Z'), 'America/New_York')).toBe('2026-11-01')
  })

  it('keeps the 04:00 boundary on the wall clock when the clocks change', () => {
    // Europe/London leaves summer time at 02:00 on 25 Oct 2026: 01:30 happens twice, both before 04:00.
    expect(learningDay(new Date('2026-10-25T00:30:00Z'), 'Europe/London')).toBe('2026-10-24') // 01:30 BST
    expect(learningDay(new Date('2026-10-25T01:30:00Z'), 'Europe/London')).toBe('2026-10-24') // 01:30 GMT
    expect(learningDay(new Date('2026-10-25T03:59:00Z'), 'Europe/London')).toBe('2026-10-24') // 03:59 GMT
    expect(learningDay(new Date('2026-10-25T04:00:00Z'), 'Europe/London')).toBe('2026-10-25') // 04:00 GMT
    // ...and enters it at 01:00 on 29 Mar 2026: 03:59 BST is 02:59 UTC.
    expect(learningDay(new Date('2026-03-29T02:59:00Z'), 'Europe/London')).toBe('2026-03-28')
    expect(learningDay(new Date('2026-03-29T03:00:00Z'), 'Europe/London')).toBe('2026-03-29')
  })

  it('places one instant on different days for people in different zones', () => {
    const at = new Date('2026-10-13T02:00:00Z')
    expect(learningDay(at, 'Pacific/Auckland')).toBe('2026-10-13') // 15:00
    expect(learningDay(at, 'Asia/Kolkata')).toBe('2026-10-13') // 07:30
    expect(learningDay(at, 'UTC')).toBe('2026-10-12') // 02:00
    expect(learningDay(at, 'America/Los_Angeles')).toBe('2026-10-12') // 19:00 the day before
  })
})

describe('contributionOf', () => {
  it('counts only learning actions as learning time; reading is history only', () => {
    expect(contributionOf({ type: 'TIME_SPENT', durationMs: 600_000, metadata: { activity: 'FOCUS' } })).toEqual({ learningSeconds: 600, readingSeconds: 0, reviews: 0, quizAnswers: 0 })
    expect(contributionOf({ type: 'TIME_SPENT', durationMs: 600_000, metadata: { activity: 'READING' } })).toEqual({ learningSeconds: 0, readingSeconds: 600, reviews: 0, quizAnswers: 0 })
    expect(contributionOf({ type: 'TIME_SPENT', durationMs: 90_000, metadata: null }).readingSeconds).toBe(90)
    expect(contributionOf({ type: 'FLASHCARD_REVIEWED', durationMs: 8_000, metadata: null })).toEqual({ learningSeconds: 8, readingSeconds: 0, reviews: 1, quizAnswers: 0 })
    expect(contributionOf({ type: 'QUIZ_COMPLETED', durationMs: 120_000, metadata: { answered: 7 } })).toEqual({ learningSeconds: 120, readingSeconds: 0, reviews: 0, quizAnswers: 7 })
    expect(contributionOf({ type: 'QUIZ_COMPLETED', durationMs: null, metadata: { answered: 'lots' } }).quizAnswers).toBe(0)
    expect(contributionOf({ type: 'NOTE_OPENED', durationMs: 5_000, metadata: null })).toEqual({ learningSeconds: 0, readingSeconds: 0, reviews: 0, quizAnswers: 0 })
  })
})

describe('dayBounds', () => {
  it('runs from 04:00 to 04:00 local, as UTC instants', () => {
    expect(dayBounds('2026-10-13', 'Asia/Kolkata')).toEqual({ from: new Date('2026-10-12T22:30:00Z'), to: new Date('2026-10-13T22:30:00Z') })
    expect(dayBounds('2026-10-13', 'UTC')).toEqual({ from: new Date('2026-10-13T04:00:00Z'), to: new Date('2026-10-14T04:00:00Z') })
  })

  it('is 25 hours long when the clocks go back, and every instant in it belongs to it', () => {
    const { from, to } = dayBounds('2026-10-24', 'Europe/London')
    expect(from).toEqual(new Date('2026-10-24T03:00:00Z')) // 04:00 BST
    expect(to).toEqual(new Date('2026-10-25T04:00:00Z')) // 04:00 GMT
    expect(learningDay(from, 'Europe/London')).toBe('2026-10-24')
    expect(learningDay(new Date(to.getTime() - 1), 'Europe/London')).toBe('2026-10-24')
    expect(learningDay(to, 'Europe/London')).toBe('2026-10-25')
  })
})
