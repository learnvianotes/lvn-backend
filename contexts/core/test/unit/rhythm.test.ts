import { learningDay } from '../../src/domain/learning-day'
import { missedBefore, pauseDaysUsed, termStart, validPlan, weekStart, weekState, weekday } from '../../src/domain/rhythm'

/**
 * Rhythm's rules (ADR-0030, ADR-0069) and Phase 6's time-zone exit tests: a week runs Monday to Sunday by learning
 * day; planned days, misses, rest, pauses and comebacks; the same moments land on different days, and different weeks,
 * for people in India, New York and Auckland, across London's clock change, and for someone who travels mid-week.
 */
const plan = [1, 2, 4, 6] // Monday, Tuesday, Thursday, Saturday
const days = (...d: string[]) => new Set(d)

describe('the week', () => {
  it('runs Monday to Sunday', () => {
    expect(weekStart('2026-10-13')).toBe('2026-10-12') // a Tuesday → its Monday
    expect(weekStart('2026-10-12')).toBe('2026-10-12')
    expect(weekStart('2026-10-18')).toBe('2026-10-12') // Sunday is the week's last day
    expect(weekday('2026-10-18')).toBe(7)
  })

  it('shows counted, missed, rest, today and ahead; a comeback after a miss; met at the target', () => {
    // Today is Friday 16 Oct: Monday and Thursday counted, Tuesday (planned) missed, Wednesday rest. The Saturday
    // before counted, so Monday was no comeback; Thursday, after Tuesday's miss, was.
    const w = weekState({ today: '2026-10-16', plannedDays: plan, counted: days('2026-10-10', '2026-10-12', '2026-10-15'), pauses: [] })
    expect(w.days.map((d) => d.status)).toEqual(['COUNTED', 'MISSED', 'REST', 'COUNTED', 'TODAY', 'AHEAD', 'AHEAD'])
    expect(w).toMatchObject({ target: 4, countedDays: 2, met: false, comebacks: 1, comebackToday: false })
    // A counted rest day counts towards the week too.
    const extra = weekState({ today: '2026-10-18', plannedDays: plan, counted: days('2026-10-12', '2026-10-14', '2026-10-15', '2026-10-17'), pauses: [] })
    expect(extra).toMatchObject({ countedDays: 4, met: true })
  })

  it('offers a comeback the day after a miss, never twice for one miss', () => {
    const input = { plannedDays: plan, counted: days('2026-10-12'), pauses: [] }
    // Tuesday was planned and missed: Wednesday (rest) and Thursday both follow it until a day counts.
    expect(missedBefore('2026-10-14', input)).toBe(true)
    expect(weekState({ ...input, today: '2026-10-15' }).comebackToday).toBe(true)
    // Thursday counts: back on rhythm, and no longer a comeback to make.
    expect(weekState({ ...input, counted: days('2026-10-10', '2026-10-12', '2026-10-15'), today: '2026-10-15' })).toMatchObject({ comebackToday: false, cameBackToday: true, comebacks: 1 })
    // Once Thursday counts, Friday is not a comeback.
    expect(missedBefore('2026-10-16', { ...input, counted: days('2026-10-12', '2026-10-15') })).toBe(false)
  })

  it('takes paused planned days off the target, never below one, and never calls them missed', () => {
    const w = weekState({ today: '2026-10-18', plannedDays: plan, counted: days('2026-10-12'), pauses: [{ from: '2026-10-13', to: '2026-10-17' }] })
    expect(w.days.map((d) => d.status)).toEqual(['COUNTED', 'PAUSED', 'PAUSED', 'PAUSED', 'PAUSED', 'PAUSED', 'TODAY'])
    expect(w).toMatchObject({ target: 1, met: true, pausedDays: 5 })
    // Looking back from Sunday past the paused days, the last planned day (Monday) counted: no miss to come back from.
    expect(missedBefore('2026-10-18', { plannedDays: plan, counted: days('2026-10-12'), pauses: [{ from: '2026-10-13', to: '2026-10-17' }] })).toBe(false)
  })

  it('takes 3–6 distinct weekdays as a plan', () => {
    expect(validPlan([1, 3, 5])).toBe(true)
    expect(validPlan([1, 2, 3, 4, 5, 6])).toBe(true)
    expect(validPlan([1, 2])).toBe(false)
    expect(validPlan([1, 2, 3, 4, 5, 6, 7])).toBe(false)
    expect(validPlan([1, 1, 2])).toBe(false)
    expect(validPlan([0, 1, 2])).toBe(false)
  })

  it('counts pause days per half-year term, splitting a pause across terms', () => {
    expect(termStart('2026-06-30')).toBe('2026-01-01')
    expect(termStart('2026-07-01')).toBe('2026-07-01')
    const pauses = [{ from: '2026-06-25', to: '2026-07-05' }]
    expect(pauseDaysUsed('2026-01-01', pauses)).toBe(6)
    expect(pauseDaysUsed('2026-07-01', pauses)).toBe(5)
  })
})

describe('time zones (Phase 6 exit)', () => {
  /** The week a person sees, from the moments they studied, in their zone. */
  const weekFor = (zone: string, moments: string[], now: string) => {
    const counted = new Set(moments.map((m) => learningDay(new Date(m), zone)))
    return weekState({ today: learningDay(new Date(now), zone), plannedDays: plan, counted, pauses: [] })
  }

  it('puts one late-night session on the right day in India, New York and Auckland', () => {
    // 20:00 UTC on Monday 12 Oct: 01:30 Tuesday in Kolkata (still Monday's learning day), 16:00 Monday in New York,
    // 09:00 Tuesday in Auckland.
    const moment = '2026-10-12T20:00:00Z'
    const now = '2026-10-14T12:00:00Z'
    expect(weekFor('Asia/Kolkata', [moment], now).days.find((d) => d.counted)!.day).toBe('2026-10-12')
    expect(weekFor('America/New_York', [moment], now).days.find((d) => d.counted)!.day).toBe('2026-10-12')
    expect(weekFor('Pacific/Auckland', [moment], now).days.find((d) => d.counted)!.day).toBe('2026-10-13')
  })

  it('puts a Sunday-night session in the week it was in, on either side of the date line', () => {
    // 11:30 UTC on Sunday 18 Oct: 23:30 Sunday in Auckland? No: 00:30 Monday 19 Oct (NZDT, +13), before 04:00, so
    // Sunday's learning day, the last of the week of 12 Oct. In Los Angeles it is 04:30 Sunday morning, the same week.
    const moment = '2026-10-18T11:30:00Z'
    const auckland = weekFor('Pacific/Auckland', [moment], '2026-10-18T12:00:00Z')
    expect(auckland.weekStart).toBe('2026-10-12')
    expect(auckland.days.at(-1)).toMatchObject({ day: '2026-10-18', counted: true })
    expect(weekFor('America/Los_Angeles', [moment], '2026-10-18T12:00:00Z').days.at(-1)).toMatchObject({ day: '2026-10-18', counted: true })
  })

  it('keeps the 04:00 boundary across London’s clock change', () => {
    // London leaves summer time at 02:00 on Sunday 25 Oct: a session at 01:30 GMT (after the change) is still
    // Saturday's learning day, and one at 04:30 GMT is Sunday's.
    const w = weekFor('Europe/London', ['2026-10-25T01:30:00Z', '2026-10-25T04:30:00Z'], '2026-10-25T12:00:00Z')
    expect(w.days.filter((d) => d.counted).map((d) => d.day)).toEqual(['2026-10-24', '2026-10-25'])
  })

  it('keeps the 04:00 boundary across London’s spring change', () => {
    // London enters summer time at 01:00 GMT on Sunday 29 March: 03:30 BST (02:30 UTC) is still Saturday's learning
    // day, and 04:30 BST (03:30 UTC) is Sunday's.
    const w = weekFor('Europe/London', ['2026-03-29T02:30:00Z', '2026-03-29T03:30:00Z'], '2026-03-29T12:00:00Z')
    expect(w.days.filter((d) => d.counted).map((d) => d.day)).toEqual(['2026-03-28', '2026-03-29'])
  })

  it('counts a day lived twice across the date line once', () => {
    // Monday morning in Auckland, then a flight east lands on Monday again in Los Angeles, then Wednesday there.
    const counted = new Set([
      learningDay(new Date('2026-10-11T22:00:00Z'), 'Pacific/Auckland'), // Monday 11:00 NZDT
      learningDay(new Date('2026-10-12T22:00:00Z'), 'America/Los_Angeles'), // Monday 15:00 PDT
      learningDay(new Date('2026-10-14T17:00:00Z'), 'America/Los_Angeles'), // Wednesday 10:00 PDT
    ])
    const w = weekState({ today: '2026-10-16', plannedDays: plan, counted, pauses: [] })
    expect(w.days.filter((d) => d.counted).map((d) => d.weekday)).toEqual([1, 3])
    expect(w.countedDays).toBe(2)
  })

  it('counts a week of someone who travels from India to London mid-week, each day where it was lived', () => {
    // Monday in Kolkata, Wednesday and Thursday in London: days are taken in the zone of the moment they happened.
    const counted = new Set([
      learningDay(new Date('2026-10-12T06:00:00Z'), 'Asia/Kolkata'), // Monday 11:30 IST
      learningDay(new Date('2026-10-14T18:00:00Z'), 'Europe/London'), // Wednesday 19:00 BST
      learningDay(new Date('2026-10-15T08:00:00Z'), 'Europe/London'), // Thursday 09:00 BST
    ])
    const w = weekState({ today: '2026-10-16', plannedDays: plan, counted, pauses: [] })
    expect(w.days.filter((d) => d.counted).map((d) => d.weekday)).toEqual([1, 3, 4])
    expect(w.countedDays).toBe(3)
  })
})
