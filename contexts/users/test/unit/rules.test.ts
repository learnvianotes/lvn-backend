import { ageRestrictedMessage, ageOn, dateOfBirthSchema, displayNameSchema, emailSchema, handleBase, handleSchema, isBelowMinimumAge, isReservedHandle, isRestrictedMinor, UNDER_MINIMUM_AGE_MESSAGE } from '../../src/domain/rules'

const d = (s: string) => new Date(`${s}T00:00:00Z`)

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

describe('isRestrictedMinor (§15.2)', () => {
  const on = d('2026-10-08')
  it('restricts anyone under the consent age without guardian consent', () => {
    expect(isRestrictedMinor(d('2009-01-01'), 18, false, on)).toBe(true)
    expect(isRestrictedMinor(d('2009-01-01'), 16, false, on)).toBe(false)
    expect(isRestrictedMinor(d('2000-01-01'), 18, false, on)).toBe(false)
  })

  it('lifts the restriction with verified consent', () => {
    expect(isRestrictedMinor(d('2015-01-01'), 18, true, on)).toBe(false)
  })

  it('treats an unknown date of birth as restricted', () => {
    expect(isRestrictedMinor(null, 18, false, on)).toBe(true)
  })
})

describe('isBelowMinimumAge (ADR-0091)', () => {
  const on = d('2026-10-21')
  it('refuses until the birthday that reaches the minimum', () => {
    expect(isBelowMinimumAge(d('2008-10-22'), 18, on)).toBe(true)
    expect(isBelowMinimumAge(d('2008-10-21'), 18, on)).toBe(false)
    expect(isBelowMinimumAge(d('1990-01-01'), 18, on)).toBe(false)
  })

  it('refuses nobody when the minimum is 0', () => {
    expect(isBelowMinimumAge(d('2020-01-01'), 0, on)).toBe(false)
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
