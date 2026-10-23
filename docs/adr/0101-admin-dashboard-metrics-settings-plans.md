# ADR-0101: Admin dashboard counts, settings and plan prices

- Status: Proposed
- Date: 2026-10-23
- Deciders: Backend; owner
- Spec sections: §1 (payments out of scope), §6.3 (short caches), §8.1, §10.1, §15.1
- Amends: ADR-0024 (plans gain a price), ADR-0097 (uploads can be switched without a redeploy once an admin saves the row)

## Context

The admin screen needs metrics, the switches and limits that today are split between `AppSetting` and environment
variables, and plan prices. ADR-0024 already stores plans and entitlements as data and keeps payments out of this
build. `AppSetting` held two booleans (`google_sign_in`, `student_id_verification`), each with its own query and
mutation. Other switches (`UPLOADS_ENABLED`, `AI_PUBLIC_PIPELINE`, `SEARCH_HYBRID`, ages, timeouts, the AI budget)
were environment variables, so changing them meant a restart.

## Decision

**Counts.** `adminMetrics` is platform-admin only. It returns totals: people (all, new in 7 and 30 days, and how many
have a live session), notes, subjects, topics, groups, classes, AI calls in a time window (runs, failures, by
provider, model and task, tokens and recorded cost), stored bytes, the college-ID queue and other pending reviews,
and open reports and appeals. No account, note or document is identified. Each API process keeps a result for about
a minute. The AI window is at most 366 days and is aligned to UTC minutes. Notes, AI and core each count their own
tables; users asks them through facades.

**Settings.** One catalog describes every application setting: key, type (boolean, integer or string), category,
description and validation. `adminSettings`, `updateAdminSetting` and `resetAdminSetting` are platform-admin only.
The saved value lives in `AppSetting.value` as `{ "v": ... }`. `enabled` still mirrors a boolean so the two existing
switches keep their meaning. A missing row keeps today's behaviour: the environment variable where there was one
(`UPLOADS_ENABLED` and the other switches and limits above), or the built-in default (`google_sign_in` on,
`student_id_verification` off). Saving a row overrides that until `resetAdminSetting` deletes the row. The process
re-reads the table about every 15 seconds and updates its copy on write. Every save and reset is audit-logged
(`settings.updated`, `settings.reset`; the older mutations keep `settings.google_sign_in` and
`settings.student_id_verification`). `account_minimum_age` cannot be set below 18.

Ports, URLs, secrets and connection details stay in the environment. The old variables remain the value in effect
until an admin saves a row, so a deploy that has not been touched behaves as it does today.

**Plan prices.** Plans already exist (ADR-0024). This adds `priceMinor`, `currency` (ISO 4217), `interval`
(`NONE`, `MONTH`, `YEAR`), `features` (short lines) and `active` on `Plan`. `adminPlans`, `createAdminPlan`,
`updateAdminPlan` and `deleteAdminPlan` are platform-admin only and audited. Entitlements stay the limits. The code
does not change after create. FREE cannot be deactivated or deleted, because accounts without a plan use it. A plan
someone is on cannot be deleted; mark it inactive. **Nothing is charged and no payment provider is called.** A price
is configuration for a later billing integration (ADR-0024).

## Consequences

The web admin can build one screen against `adminMetrics`, `adminSettings` and `adminPlans`. Introducing a charge
later is still a billing integration on top of these rows. A second API process can be up to a minute behind on
counts and about 15 seconds behind on a setting another process saved. The environment variables listed above are no
longer the only way to change those switches.
