import {
  activeMetricFor,
  activeRows,
  chunks,
  COHORT_METRICS,
  cohortRows,
  cohortStarts,
  contiguous,
  daysOf,
  medianHoursOf,
  MetricRows,
  oldestCohortFor,
  perDay,
  rolledActive,
  retentionCohorts,
  weeksEndingIn,
  type MetricRow,
} from '../../src/domain/daily-metrics'
import { addActive, median, type ActiveDays } from '../../src/domain/usage-metrics'

/** ADR-0106: the daily rollup's arithmetic. A stored day and a day counted now have to give the same numbers. */

const row = (day: string, metric: string, value: number, dimension = ''): MetricRow => ({ day, metric, dimension, value })

describe('spans of days', () => {
  it('lists days, groups them into runs and cuts long spans into pieces', () => {
    expect(daysOf({ fromDay: '2026-10-30', toDay: '2026-11-02' })).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'])
    expect(contiguous(['2026-11-04', '2026-11-01', '2026-11-02', '2026-11-02', '2026-11-06'])).toEqual([
      { fromDay: '2026-11-01', toDay: '2026-11-02' },
      { fromDay: '2026-11-04', toDay: '2026-11-04' },
      { fromDay: '2026-11-06', toDay: '2026-11-06' },
    ])
    expect(contiguous([])).toEqual([])
    expect(chunks({ fromDay: '2026-01-01', toDay: '2026-03-05' }, 31)).toEqual([
      { fromDay: '2026-01-01', toDay: '2026-01-31' },
      { fromDay: '2026-02-01', toDay: '2026-03-03' },
      { fromDay: '2026-03-04', toDay: '2026-03-05' },
    ])
  })

  it('finds the complete weeks whose Sunday is in a span', () => {
    // 2026-11-01 and 2026-11-08 are Sundays.
    expect(weeksEndingIn({ fromDay: '2026-11-01', toDay: '2026-11-03' })).toEqual(['2026-10-26'])
    expect(weeksEndingIn({ fromDay: '2026-11-02', toDay: '2026-11-07' })).toEqual([])
    expect(weeksEndingIn({ fromDay: '2026-10-31', toDay: '2026-11-08' })).toEqual(['2026-10-26', '2026-11-02'])
  })
})

describe('MetricRows and perDay', () => {
  const rows = [row('2026-11-01', 'notes_created', 2, 'PUBLIC'), row('2026-11-01', 'notes_created', 3, 'PRIVATE'), row('2026-11-02', 'notes_created', 1, 'PUBLIC'), row('2026-11-02', 'saves', 4)]

  it('reads a value, sums dimensions over days, and totals a metric', () => {
    const m = new MetricRows(rows)
    expect(m.get('notes_created', '2026-11-01', 'PRIVATE')).toBe(3)
    expect(m.get('notes_created', '2026-11-03', 'PRIVATE')).toBe(0)
    expect(m.byDimension('notes_created')).toEqual(new Map([['PUBLIC', 3], ['PRIVATE', 3]]))
    expect(m.total('notes_created')).toBe(6)
    expect(m.total('nothing')).toBe(0)
  })

  it('makes per-day objects for rollUp, summing a metric over its dimensions', () => {
    expect(perDay(rows, { notes: 'notes_created', saves: 'saves' })).toEqual([
      { day: '2026-11-01', notes: 5, saves: 0 },
      { day: '2026-11-02', notes: 1, saves: 4 },
    ])
    expect(perDay([row('2026-11-01', 'other', 1)], { notes: 'notes_created' })).toEqual([])
  })
})

describe('medianHoursOf', () => {
  const expand = (d: Map<string, number>) => [...d].flatMap(([ms, n]) => Array.from({ length: n }, () => Number(ms) / 3_600_000))

  it('is the median of the values the distribution stands for', () => {
    const cases = [
      new Map([['3600000', 1]]),
      new Map([['3600000', 1], ['7200000', 1]]),
      new Map([['18000000', 2], ['3600000', 1]]),
      new Map([['1000', 3], ['5000', 1], ['9000', 2]]),
      new Map([['1000', 2], ['9000', 2]]),
      new Map([['-60000', 1], ['60000', 1], ['120000', 1]]),
    ]
    for (const d of cases) expect(medianHoursOf(d)).toBeCloseTo(median(expand(d))!, 12)
    expect(medianHoursOf(new Map([['18000000', 2], ['3600000', 1]]))).toBe(5)
  })

  it('is null for no values', () => {
    expect(medianHoursOf(new Map())).toBeNull()
    expect(medianHoursOf(new Map([['1000', 0]]))).toBeNull()
  })
})

describe('active people from the rollup', () => {
  const days: ActiveDays = new Map()
  // a: 1 and 8 November; b: 5 and 8 November; c: 8 November only.
  for (const [day, id] of [['2026-11-01', 'a'], ['2026-11-05', 'b'], ['2026-11-08', 'a'], ['2026-11-08', 'b'], ['2026-11-08', 'c']] as const) addActive(days, day, id)

  it('stores each day, its last 7 days and its last 30 days, leaving zeros out', () => {
    const rows = activeRows({ fromDay: '2026-11-07', toDay: '2026-11-08' }, days)
    expect(rows).toEqual([
      row('2026-11-07', 'active_users_7d', 2),
      row('2026-11-07', 'active_users_30d', 2),
      row('2026-11-08', 'active_users', 3),
      row('2026-11-08', 'active_users_7d', 3),
      row('2026-11-08', 'active_users_30d', 3),
    ])
  })

  it('answers a span of 1, 7 or 30 days ending on a rolled-up day, and nothing else', () => {
    const rows = new MetricRows(activeRows({ fromDay: '2026-11-08', toDay: '2026-11-08' }, days))
    const rolled = new Set(['2026-11-08'])
    expect(activeMetricFor({ fromDay: '2026-11-02', toDay: '2026-11-08' })).toBe('active_users_7d')
    expect(rolledActive({ fromDay: '2026-11-08', toDay: '2026-11-08' }, rolled, rows)).toBe(3)
    expect(rolledActive({ fromDay: '2026-11-02', toDay: '2026-11-08' }, rolled, rows)).toBe(3)
    expect(rolledActive({ fromDay: '2026-10-10', toDay: '2026-11-08' }, rolled, rows)).toBe(3)
    // A partial week, or a day not rolled up, is counted live.
    expect(rolledActive({ fromDay: '2026-11-05', toDay: '2026-11-08' }, rolled, rows)).toBeNull()
    expect(rolledActive({ fromDay: '2026-11-07', toDay: '2026-11-07' }, rolled, rows)).toBeNull()
  })
})

describe('retention cohorts', () => {
  it('lists the sign-up weeks, this one last, and the oldest cohort a week covers', () => {
    expect(cohortStarts('2026-11-04', 3)).toEqual(['2026-10-19', '2026-10-26', '2026-11-02'])
    expect(oldestCohortFor('2026-11-02')).toBe('2025-11-10')
  })

  it('counts the active people of each cohort that had signed up by the week', () => {
    const signUp = new Map([['a', '2026-10-19'], ['b', '2026-10-19'], ['c', '2026-10-26'], ['d', '2026-11-02']])
    const sizes = new Map([['2026-10-19', 6], ['2026-10-26', 5], ['2026-11-02', 2]])
    const rows = cohortRows('2026-10-26', new Set(['a', 'b', 'c', 'd', 'stranger']), signUp, sizes)
    expect(rows).toEqual(
      expect.arrayContaining([
        row('2026-10-26', COHORT_METRICS.active, 2, '2026-10-19'),
        row('2026-10-26', COHORT_METRICS.active, 1, '2026-10-26'),
        row('2026-10-26', COHORT_METRICS.size, 6, '2026-10-19'),
        row('2026-10-26', COHORT_METRICS.size, 5, '2026-10-26'),
      ]),
    )
    // d signed up after the week; the stranger is in no cohort.
    expect(rows).toHaveLength(4)
  })

  it('gives each week as a share of the cohort and hides cohorts under 5 people', () => {
    const r = (week: string, cohort: string, active: number, size: number) => [row(week, COHORT_METRICS.active, active, cohort), row(week, COHORT_METRICS.size, size, cohort)]
    const rows = new MetricRows([
      ...r('2026-10-19', '2026-10-19', 6, 6),
      ...r('2026-10-26', '2026-10-19', 3, 6),
      ...r('2026-11-02', '2026-10-19', 2, 6),
      ...r('2026-10-26', '2026-10-26', 3, 3),
      ...r('2026-11-02', '2026-10-26', 1, 3),
      // Five now, four when its first week was counted: hidden.
      ...r('2026-10-12', '2026-10-12', 4, 4),
      ...r('2026-10-19', '2026-10-12', 4, 5),
      ...r('2026-10-26', '2026-10-12', 4, 5),
      ...r('2026-11-02', '2026-10-12', 4, 5),
    ])
    const { cohorts, hidden } = retentionCohorts(['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02'], '2026-11-02', rows)
    expect(cohorts).toEqual([{ start: '2026-10-19', size: 6, returned: [1, 0.5, 0.333] }])
    // 2026-10-12 and 2026-10-26 are under 5; nobody signed up on 2026-10-05 or 2026-11-02 (not a group, not counted).
    expect(hidden).toBe(2)
  })
})
