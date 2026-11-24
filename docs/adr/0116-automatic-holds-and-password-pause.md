# ADR-0116: Automatic holds after bursts of refused requests; password pause per address

- Status: Accepted
- Date: 2026-11-25
- Deciders: owner; Backend agent
- Spec sections: §7.1, ADR-0053, ADR-0090

## Context

The owner asked that misuse is detected and refused immediately. Rate limits existed (ADR-0090 and per feature) but
nothing acted on a person who kept hitting them, and wrong passwords were limited only in 15-minute windows.

## Decision

- Strikes: every RATE_LIMITED refusal a signed-in person gets (the per-person GraphQL operation limit and every
  per-feature limit) is a strike in Redis. 40 strikes in an hour suspend the account for 60 minutes through
  Policy.suspend (ADR-0053), revoke the session that did it, and write `abuse.auto_hold` to the audit log. Staff roles
  are exempt. Fails open on Redis or database errors.
- Password pause: 20 wrong passwords for one address in 24 hours pause password sign-in for that address until the
  window passes. An emailed code or a passkey still works and lifts the pause, as does a password reset.

## Consequences

A moderator can lift an automatic hold early. The thresholds are constants to tune from the audit log; making them
admin settings is a later step.
