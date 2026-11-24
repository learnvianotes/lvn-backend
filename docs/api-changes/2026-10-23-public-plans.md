# Plans people can see, and limits from those plans

- Date: 2026-10-23
- Package: `@lvn/contracts` 0.68.0 → **0.70.0**
- Spec: amends ADR-0024
- Breaking: no. New queries and two `LimitKey` values. Existing fields stay.
- Depends on: PR #24 (admin plan prices, contracts 0.68.0). The access allowlist follows this release as 0.71.0.

**Version.** 0.68.0 is the admin dashboard release. This change is **0.70.0**. The allowlist is **0.71.0** (0.69.0 was not published).

## What changes for clients

Nothing here charges anyone. There is no checkout or subscribe mutation. An admin assigns a plan with the existing admin plan tools.

### `plans: [PublicPlan!]!`

Active plans only, cheapest first. Works signed out. `current` is then false on every plan.

Each plan has `id`, `code`, `name`, `priceMinor` (minor currency units), `currency`, `interval`, `features`, `limits`, and `current`. `current` is true for the signed-in person's plan. An account with no subscription is on FREE.

`limits` are `PlanLimit`: `key`, `label`, and `limit` (a decimal string, or null when the plan does not cap it). They are the rows for the viewer's role. Signed out, they are the student limits.

### `myPlan: MyPlan!`

Signed in (`UNAUTHENTICATED` otherwise). `plan` is the person's plan, including one that is no longer active. `usage` is one `PlanUsage` per limit: `key`, `label`, `used` (decimal string), `limit` (decimal string or null), and `resetsAt`. `resetsAt` is the next UTC midnight for a daily limit, the first of the next UTC month for a monthly limit, and null for a standing cap.

### `LimitKey`

Adds `NOTES_OWNED` and `AI_REQUESTS_DAILY`. `createAdminPlan` and `updateAdminPlan` accept them.

## When a limit is hit

The mutation returns `userErrors` with `code` `RATE_LIMITED` (a daily or monthly cap) or `FORBIDDEN` (a standing cap) and message `You've reached your plan's limit for <label>.` Other `FORBIDDEN` errors still throw.

Labels: storage, AI tokens a day, AI asks a day, PDF pages a month, groups, group members, classes, class members, project workspaces, exports a day, imports a day, organisation seats, notes.

An account with no `UserPlan` row uses FREE. A missing entitlement row means unlimited.

## Authorization

`plans` is public. `myPlan` requires a session.

## Migration

`20261110090000_public_plan_limits` adds the two enum values and, on FREE, one export a day and five imports a day for STUDENT, TEACHER, and PLATFORM_ADMIN. Those were the effective caps before. Storage and AI tokens a day stay as already seeded. Notes and AI asks a day stay unlimited on FREE, because nothing capped them before. Re-running the migration does not delete data.
