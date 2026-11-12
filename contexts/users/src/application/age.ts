import { Errors } from '@lvn-backend/errors'
import type { Prisma } from '@lvn-backend/prisma-base'
import { GUARDIAN_CONSENT_VERIFIED } from '../domain/guardian-consent'
import { ageOn, ageSchema, dateOfBirthSchema, latestDayYearsBefore } from '../domain/rules'
import { parseField } from './input'

/** The columns `ageOf` and `isRestrictedMinor` read (ADR-0104). Spread into a Prisma `select`. */
export const AGE_FIELDS = { dateOfBirth: true, declaredAge: true, ageDeclaredAt: true } as const

/**
 * Consent rows `isRestrictedMinor` reads (ADR-0109). `consents` is the legacy verified GUARDIAN record.
 * `guardianConsents` includes `auto_unverified`, which must be passed through and not treated as verified.
 */
export const RESTRICTION_CONSENT_SELECT = {
  consents: { where: { kind: 'GUARDIAN' as const }, select: { kind: true }, take: 1 },
  guardianConsents: { select: { method: true } },
} as const

/**
 * Who may be named in a list: old enough, or holding verified guardian consent. `auto_unverified` is not in this
 * filter. A legacy ConsentRecord of kind GUARDIAN is verified consent and still matches.
 */
export function namedInLists(consentAge: number, on: Date = new Date()): Prisma.UserWhereInput[] {
  return [...atLeastAge(consentAge, on), { consents: { some: { kind: 'GUARDIAN' } } }, { guardianConsents: { some: { method: GUARDIAN_CONSENT_VERIFIED } } }]
}

const DAY_MS = 86_400_000

/**
 * Accounts whose `ageOf` is at least `age` on `on` (ADR-0104), as Prisma `OR` branches: a date of birth on or before
 * the latest one that is that old, or (with no date of birth) a declared age that, with the whole years since it was
 * declared, reaches it. One branch per declared age below `age`; `age` is a consent age, at most 21. Accounts with no
 * known age never match.
 */
export function atLeastAge(age: number, on: Date = new Date()): Prisma.UserWhereInput[] {
  const branches: Prisma.UserWhereInput[] = [
    { dateOfBirth: { lte: latestDayYearsBefore(on, age) } },
    { dateOfBirth: null, declaredAge: { gte: age }, ageDeclaredAt: { not: null } },
  ]
  for (let declared = 0; declared < age; declared++) {
    // ageOn(declaredAt, on) >= age - declared, i.e. declared on or before that day (any time of it).
    const lastDay = latestDayYearsBefore(on, age - declared)
    branches.push({ dateOfBirth: null, declaredAge: declared, ageDeclaredAt: { lt: new Date(lastDay.getTime() + DAY_MS) } })
  }
  return branches
}

/** What a sign-up or registration stores about age (ADR-0104). A date of birth is never stored from these forms. */
export interface DeclaredAge {
  declaredAge: number
  ageDeclaredAt: Date
}

/**
 * ADR-0104: the age a `signUp` or `completeRegistration` input declares. `age` is the field. `dateOfBirth` is the
 * deprecated one that apps from before ADR-0104 still send: it is checked as before, turned into whole years today,
 * and only that age is kept. When both are sent, `age` wins and `dateOfBirth` is ignored. `field` is the input the
 * client sent, for errors such as AGE_RESTRICTED.
 */
export function readDeclaredAge(input: { age?: number | null; dateOfBirth?: string | null }, now: Date = new Date()): { value: DeclaredAge; field: 'age' | 'dateOfBirth' } {
  if (input.age != null) return { value: { declaredAge: parseField(ageSchema, input.age, 'age'), ageDeclaredAt: now }, field: 'age' }
  if (input.dateOfBirth != null) {
    const years = ageOn(parseField(dateOfBirthSchema, input.dateOfBirth, 'dateOfBirth'), now)
    // The same 1–120 years a typed age must be: under a year old or over 120 is a mistake.
    if (!ageSchema.safeParse(years).success) throw Errors.validation('Enter a real date of birth.', ['input', 'dateOfBirth'])
    return { value: { declaredAge: years, ageDeclaredAt: now }, field: 'dateOfBirth' }
  }
  throw Errors.validation('Enter your age.', ['input', 'age'])
}
