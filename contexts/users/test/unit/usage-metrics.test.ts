import { ErrorCode, type AppError } from '@lvn-backend/errors'
import {
  activePerBucket,
  activeSummary,
  addActive,
  addDays,
  ADMIN_METRICS_TIME_ZONE,
  bucketOf,
  bucketStarts,
  dayIn,
  funnelCounts,
  isDbFunnelStep,
  median,
  metricsWindow,
  midnightIn,
  mondayOf,
  rollUp,
  roundHours,
  withoutSmallGroups,
  type ActiveDays,
} from '../../src/domain/usage-metrics'

/** ADR-0105: admin usage metrics in whole IST days. */

const refused = (fn: () => unknown): AppError => {
  try {
    fn()
  } catch (e) {
    return e as AppError
  }
  throw new Error('expected a refusal')
}

describe('IST days', () => {
  it('uses Asia/Kolkata and rolls over at midnight IST (18:30 UTC)', () => {
    expect(ADMIN_METRICS_TIME_ZONE).toBe('Asia/Kolkata')
    expect(dayIn(new Date('2026-11-03T18:29:59.999Z'))).toBe('2026-11-03')
    expect(dayIn(new Date('2026-11-03T18:30:00.000Z'))).toBe('2026-11-04')
    expect(midnightIn('2026-11-04')).toEqual(new Date('2026-11-03T18:30:00.000Z'))
    expect(midnightIn('2027-01-01')).toEqual(new Date('2026-12-31T18:30:00.000Z'))
  })

  it('works in a zone with daylight saving too', () => {
    expect(midnightIn('2026-03-08', 'America/New_York')).toEqual(new Date('2026-03-08T05:00:00.000Z'))
    expect(midnightIn('2026-03-09', 'America/New_York')).toEqual(new Date('2026-03-09T04:00:00.000Z'))
    expect(dayIn(new Date('2026-03-09T03:59:00Z'), 'America/New_York')).toBe('2026-03-08')
  })

  it('finds the Monday of a week', () => {
    expect(mondayOf('2026-11-04')).toBe('2026-11-02') // Wednesday
    expect(mondayOf('2026-11-02')).toBe('2026-11-02')
    expect(mondayOf('2026-11-08')).toBe('2026-11-02') // Sunday
  })
})

describe('metricsWindow', () => {
  const now = new Date('2026-11-04T10:00:00Z') // 15:30 IST on 4 November

  it('defaults to the last 30 IST days, today included', () => {
    expect(metricsWindow(null, null, now)).toEqual({
      fromDay: '2026-10-06',
      toDay: '2026-11-04',
      from: new Date('2026-10-05T18:30:00.000Z'),
      to: new Date('2026-11-04T18:30:00.000Z'),
      timeZone: 'Asia/Kolkata',
    })
  })

  it('takes the IST day of each instant, and an ISO string as sent', () => {
    // 20:00 UTC on 31 October is already 1 November in India.
    const w = metricsWindow('2026-10-31T20:00:00Z', new Date('2026-11-02T01:00:00+05:30'), now)
    expect(w).toMatchObject({ fromDay: '2026-11-01', toDay: '2026-11-02' })
    expect(w.to.getTime() - w.from.getTime()).toBe(2 * 86_400_000)
  })

  it('stops at today', () => {
    expect(metricsWindow('2026-11-01T00:00:00Z', '2027-02-01T00:00:00Z', now).toDay).toBe('2026-11-04')
    const error = refused(() => metricsWindow('2026-11-10T00:00:00Z', null, now))
    expect(error.code).toBe(ErrorCode.VALIDATION)
  })

  it('refuses a backwards window, a bad date and more than 366 days', () => {
    expect(refused(() => metricsWindow('2026-11-03T12:00:00Z', '2026-11-01T12:00:00Z', now))).toMatchObject({ code: ErrorCode.VALIDATION, field: ['from'] })
    expect(refused(() => metricsWindow('yesterday', null, now))).toMatchObject({ code: ErrorCode.VALIDATION, field: ['from'] })
    expect(refused(() => metricsWindow(null, 'soon', now))).toMatchObject({ code: ErrorCode.VALIDATION, field: ['to'] })
    // 4 Nov 2025 .. 4 Nov 2026 is 366 days: allowed. One more day is not.
    expect(metricsWindow('2025-11-04T06:00:00Z', null, now).fromDay).toBe('2025-11-04')
    expect(refused(() => metricsWindow('2025-11-03T06:00:00Z', null, now))).toMatchObject({ code: ErrorCode.VALIDATION, message: 'The window can be at most 366 days.' })
  })
})

describe('buckets', () => {
  const window = { fromDay: '2026-10-28', toDay: '2026-11-10' } // Wednesday to Tuesday

  it('lists days, or weeks from Monday with a shorter first week', () => {
    expect(bucketStarts({ fromDay: '2026-11-01', toDay: '2026-11-03' }, 'DAY')).toEqual(['2026-11-01', '2026-11-02', '2026-11-03'])
    expect(bucketStarts(window, 'WEEK')).toEqual(['2026-10-28', '2026-11-02', '2026-11-09'])
    expect(bucketStarts({ fromDay: '2026-11-02', toDay: '2026-11-02' }, 'WEEK')).toEqual(['2026-11-02'])
  })

  it('puts a day in its bucket and nothing outside the window', () => {
    expect(bucketOf('2026-10-30', window, 'WEEK')).toBe('2026-10-28')
    expect(bucketOf('2026-11-08', window, 'WEEK')).toBe('2026-11-02')
    expect(bucketOf('2026-11-10', window, 'WEEK')).toBe('2026-11-09')
    expect(bucketOf('2026-11-10', window, 'DAY')).toBe('2026-11-10')
    expect(bucketOf('2026-10-27', window, 'DAY')).toBeNull()
    expect(bucketOf('2026-11-11', window, 'WEEK')).toBeNull()
    expect(bucketOf('not-a-day', window, 'DAY')).toBeNull()
  })

  it('sums days into buckets with zeros where nothing happened', () => {
    const rows = [
      { day: '2026-10-29', signUps: 2 },
      { day: '2026-11-01', signUps: 1, verifications: 1 },
      { day: '2026-11-03', signUps: 4 },
      { day: '2026-11-20', signUps: 99 }, // outside
    ]
    expect(rollUp(window, 'WEEK', ['signUps', 'verifications'] as const, rows)).toEqual([
      { date: '2026-10-28', signUps: 3, verifications: 1 },
      { date: '2026-11-02', signUps: 4, verifications: 0 },
      { date: '2026-11-09', signUps: 0, verifications: 0 },
    ])
    const daily = rollUp({ fromDay: '2026-11-01', toDay: '2026-11-02' }, 'DAY', ['signUps'] as const, rows)
    expect(daily).toEqual([
      { date: '2026-11-01', signUps: 1 },
      { date: '2026-11-02', signUps: 0 },
    ])
  })
})

describe('active people', () => {
  const days = (): ActiveDays => {
    const d: ActiveDays = new Map()
    // a: every day of the last week; b: two days in one week; c: once, 20 days before; d: 40 days before (outside MAU)
    for (let i = 0; i < 7; i++) addActive(d, addDays('2026-11-04', -i), 'a')
    addActive(d, '2026-11-02', 'b')
    addActive(d, '2026-11-03', 'b')
    addActive(d, '2026-10-15', 'c')
    addActive(d, '2026-09-25', 'd')
    addActive(d, '2026-11-04', 'a') // twice on one day is once
    return d
  }

  it('counts each person once per bucket', () => {
    const perWeek = activePerBucket({ fromDay: '2026-10-26', toDay: '2026-11-04' }, 'WEEK', days())
    expect([...perWeek]).toEqual([
      ['2026-10-26', 1],
      ['2026-11-02', 2],
    ])
    const perDay = activePerBucket({ fromDay: '2026-11-02', toDay: '2026-11-04' }, 'DAY', days())
    expect([...perDay]).toEqual([
      ['2026-11-02', 2],
      ['2026-11-03', 2],
      ['2026-11-04', 1],
    ])
  })

  it('gives DAU, WAU, MAU and stickiness from the last day back', () => {
    // Daily counts over the 30 days to 4 Nov: a on 7 days, b on 2, c on 1 → 10 person-days; MAU 3.
    expect(activeSummary({ toDay: '2026-11-04' }, days())).toEqual({ dau: 1, wau: 2, mau: 3, stickiness: Math.round((10 / 30 / 3) * 1000) / 1000 })
    expect(activeSummary({ toDay: '2026-11-04' }, new Map())).toEqual({ dau: 0, wau: 0, mau: 0, stickiness: 0 })
  })
})

describe('small groups (k-anonymity 5)', () => {
  it('leaves out groups with fewer than 5 distinct people and says how many', () => {
    const rows = [
      { method: 'EMAIL', users: 12 },
      { method: 'GOOGLE', users: 5 },
      { method: 'GITHUB', users: 4 },
      { method: 'LINKEDIN', users: 1 },
    ]
    expect(withoutSmallGroups(rows)).toEqual({ shown: rows.slice(0, 2), hidden: 2 })
    expect(withoutSmallGroups([])).toEqual({ shown: [], hidden: 0 })
  })
})

describe('median and hours', () => {
  it('takes the middle value', () => {
    expect(median([])).toBeNull()
    expect(median([5])).toBe(5)
    expect(median([9, 1, 4])).toBe(4)
    expect(median([1, 2, 3, 10])).toBe(2.5)
    expect(roundHours(1.26)).toBe(1.3)
    expect(roundHours(null)).toBeNull()
    expect(roundHours(Number.NaN)).toBeNull()
  })
})

describe('funnel', () => {
  const t = (iso: string) => new Date(iso)

  it('knows the database steps', () => {
    for (const step of ['signed_up', 'email_verified', 'first_note', 'returned_d7']) expect(isDbFunnelStep(step)).toBe(true)
    expect(isDbFunnelStep('page_view')).toBe(false)
  })

  it('counts a person at a step only when every earlier step came first', () => {
    const signedUp = new Map([
      ['a', t('2026-11-01T00:00:00Z')],
      ['b', t('2026-11-01T00:00:00Z')],
      ['c', t('2026-11-02T00:00:00Z')],
    ])
    const firstNote = new Map([
      ['a', t('2026-11-01T01:00:00Z')],
      ['b', t('2026-11-01T00:00:00Z')], // same moment is in order
      ['c', t('2026-11-01T00:00:00Z')], // before signing up: out of order
      ['x', t('2026-11-01T00:00:00Z')], // never signed up in the window
    ])
    const returned = new Map([
      ['a', t('2026-11-09T00:00:00Z')],
      ['c', t('2026-11-10T00:00:00Z')],
    ])
    expect(funnelCounts(['signed_up', 'first_note', 'returned_d7'], [signedUp, firstNote, returned])).toEqual([3, 2, 1])
    expect(funnelCounts(['signed_up'], [new Map()])).toEqual([0])
  })
})
