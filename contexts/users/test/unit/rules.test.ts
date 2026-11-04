import {
  ageOf,
  ageOn,
  ageRestrictedMessage,
  ageSchema,
  dateOfBirthSchema,
  dayReachingAge,
  displayNameSchema,
  emailSchema,
  handleBase,
  handleSchema,
  isBelowMinimumAge,
  isReservedHandle,
  isRestrictedMinor,
  latestDayYearsBefore,
  UNDER_MINIMUM_AGE_MESSAGE,
} from '../../src/domain/rules'

const d = (s: string) => new Date(`${s}T00:00:00Z`)
/** An account with a date of birth (registered before ADR-0104). */
const born = (s: string) => ({ dateOfBirth: d(s), declaredAge: null, ageDeclaredAt: null })
/** An account that typed its age (ADR-0104). */
const declared = (age: number, at: string) => ({ dateOfBirth: null, declaredAge: age, ageDeclaredAt: new Date(at) })
const unknown = { dateOfBirth: null, declaredAge: null, ageDeclaredAt: null }

describe('ageOn', () => {
  it('counts whole years and turns over on the birthday', () => {
    expect(ageOn(d('2008-10-08'), d('2026-10-07'))).toBe(17)
    expect(ageOn(d('2008-10-08'), d('2026-10-08'))).toBe(18)
  })

  it('handles 29 February birthdays', () => {
    expect(ageOn(d('2008-02-29'), d('2026-02-28'))).toBe(17)
    expect(ageOn(d('2008-02-29'), d('2026-03-01'))).toBe(18)
  })
})

describe('ageOf (ADR-0104)', () => {
  it('uses the date of birth when the account has one', () => {
    expect(ageOf(born('2008-10-08'), d('2026-10-07'))).toBe(17)
    expect(ageOf(born('2008-10-08'), d('2026-10-08'))).toBe(18)
  })

  it('prefers the date of birth over a declared age', () => {
    expect(ageOf({ dateOfBirth: d('2008-10-08'), declaredAge: 40, ageDeclaredAt: d('2026-01-01') }, d('2026-10-08'))).toBe(18)
  })

  it('counts a declared age forward by whole years only, so it never overstates the age', () => {
    const facts = declared(17, '2026-11-04T18:30:00Z')
    expect(ageOf(facts, new Date('2026-11-04T18:31:00Z'))).toBe(17)
    // They may have turned 18 the next day; they are still counted 17 until a full year has passed.
    expect(ageOf(facts, d('2027-11-03'))).toBe(17)
    expect(ageOf(facts, d('2027-11-04'))).toBe(18)
    expect(ageOf(facts, d('2036-11-04'))).toBe(27)
  })

  it('never counts a declared age backwards', () => {
    expect(ageOf(declared(30, '2026-11-04T00:00:00Z'), d('2026-01-01'))).toBe(30)
  })

  it('is unknown before registration is finished', () => {
    expect(ageOf(unknown, d('2026-11-04'))).toBeNull()
    expect(ageOf({ dateOfBirth: null, declaredAge: 20, ageDeclaredAt: null }, d('2026-11-04'))).toBeNull()
  })
})

describe('dayReachingAge (ADR-0055 adultFrom)', () => {
  it('is the birthday that reaches the age', () => {
    expect(dayReachingAge(born('2008-10-08'), 18)).toEqual(d('2026-10-08'))
    expect(dayReachingAge(born('2008-02-29'), 18)).toEqual(d('2026-03-01'))
  })

  it('is the anniversary of the declaration that reaches the age, or the day it was declared', () => {
    expect(dayReachingAge(declared(16, '2026-11-04T18:30:00Z'), 18)).toEqual(d('2028-11-04'))
    expect(dayReachingAge(declared(25, '2026-11-04T18:30:00Z'), 18)).toEqual(d('2026-11-04'))
    expect(dayReachingAge(unknown, 18)).toBeNull()
  })

  it('agrees with ageOf on the day before and the day itself', () => {
    for (const facts of [born('2008-02-29'), born('2009-12-31'), declared(13, '2024-02-29T23:59:00Z'), declared(17, '2026-01-01T00:00:00Z')]) {
      const day = dayReachingAge(facts, 18)!
      expect(ageOf(facts, day)).toBeGreaterThanOrEqual(18)
      expect(ageOf(facts, new Date(day.getTime() - 86_400_000))).toBeLessThan(18)
    }
  })
})

describe('latestDayYearsBefore', () => {
  it('is the latest date of birth that is that old on the day', () => {
    expect(latestDayYearsBefore(new Date('2026-11-04T15:00:00Z'), 18)).toEqual(d('2008-11-04'))
    expect(ageOn(latestDayYearsBefore(d('2026-11-04'), 18), d('2026-11-04'))).toBe(18)
    expect(ageOn(d('2008-11-05'), d('2026-11-04'))).toBe(17)
  })

  it('uses 28 February when 29 February does not exist that many years back', () => {
    expect(latestDayYearsBefore(d('2028-02-29'), 1)).toEqual(d('2027-02-28'))
    expect(ageOn(d('2027-02-28'), d('2028-02-29'))).toBe(1)
    expect(ageOn(d('2027-03-01'), d('2028-02-29'))).toBe(0)
    expect(latestDayYearsBefore(d('2028-02-29'), 4)).toEqual(d('2024-02-29'))
  })
})

describe('isRestrictedMinor (§15.2)', () => {
  const on = d('2026-10-08')
  it('restricts anyone under the consent age without guardian consent', () => {
    expect(isRestrictedMinor(born('2009-01-01'), 18, false, on)).toBe(true)
    expect(isRestrictedMinor(born('2009-01-01'), 16, false, on)).toBe(false)
    expect(isRestrictedMinor(born('2000-01-01'), 18, false, on)).toBe(false)
  })

  it('restricts a declared minor until whole years since the declaration reach the consent age (ADR-0104)', () => {
    expect(isRestrictedMinor(declared(17, '2026-01-15T00:00:00Z'), 18, false, on)).toBe(true)
    expect(isRestrictedMinor(declared(17, '2025-10-08T09:00:00Z'), 18, false, on)).toBe(false)
    expect(isRestrictedMinor(declared(17, '2025-10-09T00:00:00Z'), 18, false, on)).toBe(true)
    expect(isRestrictedMinor(declared(30, '2026-10-08T00:00:00Z'), 18, false, on)).toBe(false)
  })

  it('lifts the restriction with verified consent', () => {
    expect(isRestrictedMinor(born('2015-01-01'), 18, true, on)).toBe(false)
    expect(isRestrictedMinor(declared(11, '2026-10-01T00:00:00Z'), 18, true, on)).toBe(false)
  })

  it('treats an unknown age as restricted', () => {
    expect(isRestrictedMinor(unknown, 18, false, on)).toBe(true)
  })
})

describe('isBelowMinimumAge (ADR-0091)', () => {
  const on = d('2026-10-21')
  it('refuses until the birthday that reaches the minimum', () => {
    expect(isBelowMinimumAge(ageOn(d('2008-10-22'), on), 18)).toBe(true)
    expect(isBelowMinimumAge(ageOn(d('2008-10-21'), on), 18)).toBe(false)
    expect(isBelowMinimumAge(ageOn(d('1990-01-01'), on), 18)).toBe(false)
  })

  it('refuses a typed age below the minimum (ADR-0104)', () => {
    expect(isBelowMinimumAge(17, 18)).toBe(true)
    expect(isBelowMinimumAge(18, 18)).toBe(false)
  })

  it('refuses nobody when the minimum is 0', () => {
    expect(isBelowMinimumAge(ageOn(d('2020-01-01'), on), 0)).toBe(false)
    expect(isBelowMinimumAge(1, 0)).toBe(false)
  })

  it('names the support address on the refusal the client shows', () => {
    expect(ageRestrictedMessage('support@learnvianotes.in')).toBe(`${UNDER_MINIMUM_AGE_MESSAGE} Contact an admin at support@learnvianotes.in.`)
  })
})

describe('input rules', () => {
  it.each(['2004-02-30', '2004-13-01', '04-05-2004', '2999-01-01', '1850-01-01'])('refuses the date of birth %s', (v) => {
    expect(dateOfBirthSchema.safeParse(v).success).toBe(false)
  })

  it('accepts a real date of birth', () => {
    expect(dateOfBirthSchema.parse('2004-02-29')).toEqual(d('2004-02-29'))
  })

  it.each([0, -1, 121, 17.5, Number.NaN, Number.POSITIVE_INFINITY, '18', null])('refuses the age %p (ADR-0104)', (v) => {
    expect(ageSchema.safeParse(v).success).toBe(false)
  })

  it.each([1, 13, 18, 120])('accepts the whole-number age %p', (v) => {
    expect(ageSchema.parse(v)).toBe(v)
  })

  it('never names the minimum age in an age error (ADR-0091)', () => {
    const messages = [0, 17.5, 121].map((v) => ageSchema.safeParse(v).error!.issues[0]!.message)
    expect(messages).toEqual(['Enter an age from 1 to 120.', 'Enter your age as a whole number.', 'Enter an age from 1 to 120.'])
    expect(messages.join(' ')).not.toMatch(/18|adult/)
  })

  it('normalises emails to lower case and refuses junk', () => {
    expect(emailSchema.parse('  Asha.Rao@College.EDU ')).toBe('asha.rao@college.edu')
    expect(emailSchema.safeParse('asha@').success).toBe(false)
  })

  it('refuses markup and control characters in names', () => {
    expect(displayNameSchema.safeParse('<b>Asha</b>').success).toBe(false)
    expect(displayNameSchema.parse('  Asha Rao ')).toBe('Asha Rao')
  })
})

describe('handleBase', () => {
  it('slugs the name, dropping accents and symbols', () => {
    expect(handleBase('Asha Rao')).toBe('asharao')
    expect(handleBase('José Álvarez-Núñez')).toBe('josealvareznunez')
  })

  it('pads names that leave too little to work with', () => {
    expect(handleBase('李')).toBe('learner')
    expect(handleBase('Al')).toBe('learneral')
  })

  it('does not offer a brand or role handle', () => {
    for (const name of ['LearnViaNotes', 'Learn-Via-Notes', 'LVN', 'Admin', 'Support', 'Official', 'System', 'Publisher', 'LearnViaNotes Official']) {
      expect(isReservedHandle(handleBase(name))).toBe(false)
      expect(handleBase(name)).toBe('learner')
    }
  })
})

describe('reserved handles', () => {
  it.each([
    'learnvianotes',
    'LearnViaNotes',
    'learn-via-notes',
    'learn_via_notes',
    'LVN',
    'lvn-official',
    'official-lvn',
    'admin',
    'Admin',
    'administrator',
    'superadmin',
    'support',
    'official',
    'system',
    'publisher',
    'moderator',
    'staff',
    'root',
    'helpdesk',
    'security',
  ])('reserves %s', (handle) => {
    expect(isReservedHandle(handle)).toBe(true)
    expect(handleSchema.safeParse(handle).success).toBe(false)
  })

  it('leaves ordinary names free to use', () => {
    for (const handle of ['asharao', 'Asha Rao', 'priya', 'arjun', 'saanvi', 'stafford', 'learner']) {
      expect(isReservedHandle(handle)).toBe(false)
    }
    expect(handleSchema.parse('Asha_Rao')).toBe('asharao')
  })
})
