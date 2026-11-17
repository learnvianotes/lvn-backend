# Recover an admin who cannot receive the sign-in code

An admin who still has their email asks for a new code with `startMfaChallenge`. Five wrong guesses burn a code; five sends an hour is the cap.

When the mailbox itself is down, a platform admin who has already passed MFA calls `adminRecoverMfa` with the account id and a reason. That clears unused codes and lets the account sign in without a code for 2 hours. An admin cannot recover themselves.

The owner can do the same from a shell, for up to 7 days:

```bash
DATABASE_URL=postgres://... REDIS_URL=redis://... node scripts/mfa-recover.mjs --email admin@example.com --reason "mailbox outage" --hours 24
```

`REDIS_URL` is optional. The script writes an audit row. The row cannot be edited or deleted. After the window, the emailed code is required again.
