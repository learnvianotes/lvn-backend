import { ErrorCode, type AppError } from '@lvn-backend/errors'
import { AGE_FIELDS, atLeastAge, readDeclaredAge } from '../../src/application/age'
import { ageOf, ageOn, type AgeFacts } from '../../src/domain/rules'

const d = (s: string) => new Date(`${s}T00:00:00Z`)
const DAY = 86_400_000

type Condition = null | number | { lte?: Date; lt?: Date; gte?: number; not?: null }

/** Just enough of Prisma's filter semantics to run atLeastAge's branches against a row. */
function matches(row: AgeFacts, branch: Record<string, Condition>): boolean {
  return Object.entries(branch).every(([key, cond]) => {
    const value = row[key as keyof AgeFacts]
    if (cond === null) return value === null
    if (typeof cond === 'number') return value === cond
    if ('not' in cond) return value !== null
    if (value === null) return false
    const n = value instanceof Date ? value.getTime() : value
    if (cond.lte !== undefined && !(n <= cond.lte.getTime())) return false
    if (cond.lt !== undefined && !(n < cond.lt.getTime())) return false
    if (cond.gte !== undefined && !(n >= cond.gte)) return false
    return true
  })
}

const matchesAny = (row: AgeFacts, age: number, on: Date) => atLeastAge(age, on).some((b) => matches(row, b as Record<string, Condition>))

describe('atLeastAge (ADR-0104)', () => {
  const days = ['2026-11-04', '2028-02-29', '2027-02-28', '2027-03-01', '2026-01-01', '2026-12-31']
  const times = ['T00:00:00.000Z', 'T13:45:00.000Z', 'T23:59:59.999Z']

  it.each(days)('agrees with ageOf for dates of birth and declared ages on %s', (day) => {
    const on = new Date(`${day}T15:00:00Z`)
    const rows: AgeFacts[] = [{ dateOfBirth: null, declaredAge: null, ageDeclaredAt: null }]
    // Dates of birth around each consent-age boundary.
    for (const years of [12, 13, 17, 18, 19, 21, 22]) {
      for (let offset = -2; offset <= 2; offset++) {
        const dob = d(day)
        dob.setUTCFullYear(dob.getUTCFullYear() - years)
        rows.push({ dateOfBirth: new Date(dob.getTime() + offset * DAY), declaredAge: null, ageDeclaredAt: null })
      }
    }
    rows.push({ dateOfBirth: d('2008-02-29'), declaredAge: null, ageDeclaredAt: null }, { dateOfBirth: d('2009-02-28'), declaredAge: null, ageDeclaredAt: null })
    // Declared ages given around each anniversary, at different times of day.
    for (const declared of [1, 5, 12, 13, 15, 16, 17, 18, 25]) {
      for (const yearsAgo of [0, 1, 2, 3, 5]) {
        for (let offset = -1; offset <= 1; offset++) {
          for (const time of times) {
            const at = new Date(`${day}${time}`)
            at.setUTCFullYear(at.getUTCFullYear() - yearsAgo)
            rows.push({ dateOfBirth: null, declaredAge: declared, ageDeclaredAt: new Date(at.getTime() + offset * DAY) })
          }
        }
      }
    }
    rows.push({ dateOfBirth: null, declaredAge: 17, ageDeclaredAt: new Date('2024-02-29T22:00:00Z') })
    // A date of birth decides over a declared age.
    rows.push({ dateOfBirth: d('2015-01-01'), declaredAge: 40, ageDeclaredAt: d('2020-01-01') }, { dateOfBirth: d('1990-01-01'), declaredAge: 3, ageDeclaredAt: on })

    for (const age of [13, 16, 18, 21]) {
      for (const row of rows) {
        const known = ageOf(row, on)
        expect({ row, age, matched: matchesAny(row, age, on) }).toEqual({ row, age, matched: known !== null && known >= age })
      }
    }
  })

  it('leaves out accounts with no known age, and a declared age without its time', () => {
    const on = d('2026-11-04')
    expect(matchesAny({ dateOfBirth: null, declaredAge: null, ageDeclaredAt: null }, 18, on)).toBe(false)
    expect(matchesAny({ dateOfBirth: null, declaredAge: 30, ageDeclaredAt: null }, 18, on)).toBe(false)
  })

  it('selects every column ageOf reads', () => {
    expect(Object.keys(AGE_FIELDS).sort()).toEqual(['ageDeclaredAt', 'dateOfBirth', 'declaredAge'])
  })
})

describe('readDeclaredAge (ADR-0104)', () => {
  const now = new Date('2026-11-04T10:00:00Z')
  const fails = (input: Parameters<typeof readDeclaredAge>[0]): AppError => {
    try {
      readDeclaredAge(input, now)
    } catch (e) {
      return e as AppError
    }
    throw new Error('expected a rejection')
  }

  it('takes a whole-number age as given, with the time it was given', () => {
    expect(readDeclaredAge({ age: 19 }, now)).toEqual({ value: { declaredAge: 19, ageDeclaredAt: now }, field: 'age' })
  })

  it('turns an older app’s date of birth into the age it gives today, and keeps no date', () => {
    const read = readDeclaredAge({ dateOfBirth: '2008-11-05' }, now)
    expect(read).toEqual({ value: { declaredAge: 17, ageDeclaredAt: now }, field: 'dateOfBirth' })
    expect(readDeclaredAge({ dateOfBirth: '2008-11-04' }, now).value.declaredAge).toBe(18)
    expect(Object.keys(read.value)).toEqual(['declaredAge', 'ageDeclaredAt'])
  })

  it('prefers the age when both are sent, and does not check the date of birth', () => {
    expect(readDeclaredAge({ age: 30, dateOfBirth: '2015-01-01' }, now)).toEqual({ value: { declaredAge: 30, ageDeclaredAt: now }, field: 'age' })
    expect(readDeclaredAge({ age: 30, dateOfBirth: 'not a date' }, now).field).toBe('age')
    // An explicit null age falls back to the date of birth.
    expect(readDeclaredAge({ age: null, dateOfBirth: '2000-01-01' }, now).field).toBe('dateOfBirth')
  })

  it.each([
    [{ age: 0 }, 'age', 'Enter an age from 1 to 120.'],
    [{ age: -3 }, 'age', 'Enter an age from 1 to 120.'],
    [{ age: 121 }, 'age', 'Enter an age from 1 to 120.'],
    [{ age: 18.2 }, 'age', 'Enter your age as a whole number.'],
    [{}, 'age', 'Enter your age.'],
    [{ age: null, dateOfBirth: null }, 'age', 'Enter your age.'],
    [{ dateOfBirth: '2026-06-01' }, 'dateOfBirth', 'Enter a real date of birth.'],
    [{ dateOfBirth: '1900-01-01' }, 'dateOfBirth', 'Enter a real date of birth.'],
    [{ dateOfBirth: '2004-02-30' }, 'dateOfBirth', 'Enter a real date.'],
    [{ dateOfBirth: '' }, 'dateOfBirth', 'Use the format YYYY-MM-DD.'],
  ])('refuses %p as VALIDATION on input.%s', (input, field, message) => {
    expect(fails(input as never)).toMatchObject({ code: ErrorCode.VALIDATION, field: ['input', field], message })
  })

  it('accepts the oldest and youngest ages the range allows', () => {
    expect(readDeclaredAge({ age: 1 }, now).value.declaredAge).toBe(1)
    expect(readDeclaredAge({ age: 120 }, now).value.declaredAge).toBe(120)
    expect(ageOn(d('1906-11-04'), now)).toBe(120)
    expect(readDeclaredAge({ dateOfBirth: '1906-11-04' }, now).value.declaredAge).toBe(120)
  })
})
