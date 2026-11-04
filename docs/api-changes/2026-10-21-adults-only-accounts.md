# Accounts for adults only (College/Interview launch)

> The live sign-up response is now `AGE_RESTRICTED` and the account is kept. See `2026-10-25-age-restricted-accounts.md`.
> The forms ask for an age in whole years, not a date of birth. See `2026-11-04-age-instead-of-date-of-birth.md`.

- Date: 2026-10-21
- Package: `@lvn/contracts` 0.60.0
- Spec: ADR-0091 (§6.2, §7, §15.2)
- Breaking: no (a new error code; older clients show its message as a general error)

## What changes for clients

- **`ErrorCode.UNDER_MINIMUM_AGE`**, returned in `userErrors` on `["input", "dateOfBirth"]`, with a message to show
  as it is ("Sorry, you can’t create an account. LearnViaNotes accounts are only for adults; …").
- **`signUp`**: a date of birth below `ACCOUNT_MINIMUM_AGE` (18 by default) returns it, and no account is created.
- **`completeRegistration`**: the same answer from an account a sign-in provider created erases that account at once.
  Its session ends: treat the client as signed out. A later sign-in with the same provider starts a new account.
- **Before sending any date of birth**, show it in words and ask "Is this right?", whatever the answer. Don't name the
  minimum age on the form.
- **After a refusal**, remember it on the device for a day and keep the sign-up forms closed there meanwhile. Don't
  delete or sign out anyone else because of it.
- **`apiConfigSchema`** gains `ACCOUNT_MINIMUM_AGE` (0–21, default 18; 0 turns the rule off).
