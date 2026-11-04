# ADR-0091: Accounts for adults only, by configuration (College/Interview launch)

- Status: Accepted (owner decision, 2026-10-20: the College/Interview track launches for 18+; the School track later);
  amended by ADR-0104 (the check reads an age in whole years; new accounts store that age, not a date of birth)
- Date: 2026-10-21
- Deciders: Backend, Web, Mobile agents; owner
- Spec sections: §15.2 (Age), §6.2 (error vocabulary), §7 (registration); amends ADR-0017's age rule while it is on

## Context

§15.2 lets anyone register: under the digital-consent age (18 under India's DPDP Act) an account is a restricted minor
until a parent, guardian or school confirms consent. The owner launches the College/Interview track first, for adults
only; the School track, with parent accounts and its own content, is a later phase. The old app's launch build
(lvn-web `release/college-launch`) already refuses under-18s at sign-up. The rewrite needs the same rule without losing
the restricted-minor model the School track will use.

The old build's review also found three ways an age check can go wrong, which this design avoids:

- a refusal remembered on a shared device deleted the next person's new account;
- one mis-picked year could wipe an adult's data, because only an under-18 answer was asked to confirm;
- a hint of the cut-off before the answer invites a different answer (FTC COPPA FAQ H.3, D.7: a neutral age screen).

## Decision

**`ACCOUNT_MINIMUM_AGE` (api, default 18).** The youngest age that may hold an account. `0` turns the rule off, and
minors are then restricted as §15.2 says (`DIGITAL_CONSENT_AGE`). The restricted-minor code stays as it is.

**Sign-up (`signUp`).** A date of birth below the minimum is refused before anything is stored, with the new error code
`UNDER_MINIMUM_AGE` on `["input", "dateOfBirth"]` in `userErrors`.

**Provider accounts (`completeRegistration`).** Google, GitHub and LinkedIn create the account before the date of birth
is asked. If the answer is below the minimum:

- the unfinished account is erased at once, through ADR-0088's eraser (sessions, sign-in providers, the user row as
  "Deleted user"), and `UserDeleted` is published as for any deletion;
- the payload carries `UNDER_MINIMUM_AGE`.

The account was created by the same person's sign-in moments before and holds nothing: the clients send nothing else
until registration is complete. A finished account is never erased this way.

**Nothing is deleted that nobody asked to delete.**

- The only accounts erased without the 14-day grace are unfinished ones whose own answer was under the minimum.
- Accounts that finished registering before the minimum was set keep the §15.2 rules; nothing removes them.
- A refusal remembered on a device (below) only closes the sign-up forms there. It never deletes anything.

**Every answer is confirmed.** The web and the phone:

- show the chosen date in words ("14 March 2001");
- ask "Is this right?" before sending any answer, adult or not, so no answer stands out and one mis-picked year
  cannot erase an account.

Nothing on the screen names the cut-off before the answer.

**The refusal is remembered on the device for a day.** Going back and answering again does not reopen sign-up there.
On the web the device's analytics choice is also set to "don't allow" (ADR-0092).

**`UNDER_MINIMUM_AGE` joins the error vocabulary (§6.2).** It is returned in `userErrors`, like `VALIDATION`.

## Consequences

- No minor gets an account while the minimum is 18. The Privacy Policy and Terms say accounts are for adults. They
  hold the age in their text (lvn-web `config/legal.ts` → `ACCOUNTS_FROM_AGE`), which must match this variable.
- The date of birth is still stored, as ADR-0017 says. It drives the age band, and the School track needs it.
- The School track turns the minimum to `0` (or the age it chooses) and brings the guardian-consent flow.
- Clients older than this change show the refusal as a general error with the server's message; nothing breaks.
