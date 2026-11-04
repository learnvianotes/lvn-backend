# ADR-0104: Registration asks for an age in whole years, not a date of birth

- Status: Accepted (owner decision, 2026-11-04: "remove the dob input instead ask for age in number")
- Date: 2026-11-04
- Deciders: Backend, Web, Mobile agents; owner
- Spec sections: §15.2 (Age), §7 (registration), §6.2 (contract changes)
- Amends: ADR-0017 (what registration asks: an age instead of a date of birth); ADR-0091 (the minimum-age check reads
  that age; "the date of birth is still stored" no longer holds for new accounts)

## Context

ADR-0017 asks everyone for a date of birth at registration, and ADR-0091 refuses an account below
`ACCOUNT_MINIMUM_AGE` from it. The owner wants the sign-up and `completeRegistration` forms to ask for an age as a
number instead. The rules that need an age stay: the minimum age for an account (ADR-0091, kept recoverable as
`AGE_BLOCKED` by the 2026-10-25 change), the restricted minor of §15.2 under `DIGITAL_CONSENT_AGE` with guardian
consent, people search's `adultFrom` (ADR-0055), and the adult-only contest bands and achievements that read it.
Accounts already registered hold a date of birth, and phones with an older app still send one.

## Decision

**What is asked.** `signUp` and `completeRegistration` take `age: Int`, whole years. The server accepts 1 to 120 and
refuses anything else with `VALIDATION` on `["input", "age"]`. A missing age is the same error. A value that is not a
whole number never reaches the resolver: GraphQL's `Int` refuses it, and the API reports it as `VALIDATION`. No
message names the minimum age (ADR-0091's neutral screen). The web and the phone still ask "Is this right?" before
sending any answer, adult or not.

**What is stored.** Two new nullable columns on `users.User`: `declaredAge` (the number given) and `ageDeclaredAt`
(when). New registrations store no date of birth. The migration only adds the columns. `dateOfBirth` and every value
in it stay as they are.

**The age of an account now** (`ageOf`):

- the date of birth when the account has one (accounts from before this ADR, or set by an admin);
- otherwise the declared age plus the whole years since `ageDeclaredAt`. Someone who said 17 may turn 18 the next
  day, but is counted 18 only a year after saying 17. The result is never older than the person, so a rule that
  protects minors is never lifted early;
- unknown when neither is stored (registration not finished). Unknown is treated as a restricted minor, as before.

Database filters (people search, the followers who may be named) use the same rule (`atLeastAge`), and
`adultFrom` is the first day `ageOf` reaches the consent age.

**Older apps.** `dateOfBirth` stays on both inputs, now nullable and `@deprecated`. When only `dateOfBirth` is sent
it is checked as before (YYYY-MM-DD, a real date, not in the future, from 1900), turned into whole years today, and
must give 1 to 120 years. Only that age is stored, not the date. Errors and `AGE_RESTRICTED` name
`["input", "dateOfBirth"]`, the field that client shows. When both are sent, `age` is used and `dateOfBirth` is
ignored, neither checked nor stored. Clients should send only `age`.

**The minimum age and the hold** (ADR-0091, 2026-10-25) are unchanged except for their input. An age below
`ACCOUNT_MINIMUM_AGE` keeps the account as `AGE_BLOCKED` with its consent records, the declared age and no session.
`AGE_RESTRICTED` names `["input", "age"]`.

**Admins.** `AdminManagedUser` gains `age: Int` (as above). `dateOfBirth` is shown only for accounts that have one.
`adminUpdateUser` gains `age: Int` (1 to 120, as of now) and re-runs the age gate as a date of birth did. A stored
date of birth decides the age, so `age` is refused on an account that has one (correct `dateOfBirth` there), and the
two are not accepted together. The audit records the field names only (`"age"`), never the value.

**Privacy.** The data export and the deletion eraser treat `declaredAge` and `ageDeclaredAt` like `dateOfBirth`
(exported to the person; cleared on erasure). The logger redacts `age` and `declaredAge` as it does `dateOfBirth`.
Privacy and export wording says "age" (or the date of birth for accounts that gave one).

## Consequences

- Less personal data for new accounts, and an easier form. The age is self-declared, as the date of birth was.
- A minor's restriction lifts up to a year later than their real birthday would lift it. That is the safe side.
  When the School track turns the minimum down and needs exact ages, it asks again or uses guardian confirmation.
- Accounts from before this ADR keep their date of birth and their exact age. Nothing is converted.
- The terms version is not changed by this ADR. The legal text needs only a factual word change ("date of birth" to
  "age"); whether that is a material change that needs a new version is the owner's call (ADR-0103).
- Remove the deprecated `dateOfBirth` inputs once no supported phone build sends them (check the request logs for
  the field before removing it; that removal is a breaking change and needs its own api-changes note).
