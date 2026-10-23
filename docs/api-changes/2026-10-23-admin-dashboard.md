# Admin dashboard: counts, settings and plan prices

- Date: 2026-10-23
- Package: `@lvn/contracts` 0.67.0 → **0.68.0**
- Spec: ADR-0101; amends ADR-0024 and ADR-0097
- Breaking: no. New queries and mutations. Existing fields stay.

**Version.** 0.67.0 shipped with the admin model pickers. This change is **0.68.0** on top of that.

## What changes for clients

Platform admins only. Anyone else receives `FORBIDDEN`. Signed out, `UNAUTHENTICATED`.

### `adminMetrics(from: DateTime, to: DateTime): AdminMetrics!`

Dashboard totals. No personal data. Cached for about a minute in each API process. `from` and `to` bound **AI usage
only** (inclusive start, exclusive end, aligned to a UTC minute). Omit them for the last 30 days. The window can be
at most 366 days. Token sums, cost and storage bytes are decimal strings. Cost is millionths of a US dollar.

`users.active` is distinct accounts with a session that is not revoked and not expired. Storage counts files that are
uploaded, processing, ready or quarantined.

### `adminSettings: [AdminSetting!]!`

Every application setting: `key`, `type` (`BOOLEAN`, `INTEGER`, `STRING`), `category`, `description`, `value`,
`overridden`, `updatedAt`, `constraints`. `value` is `true` or `false`, a decimal integer, text, or empty when an
integer is cleared. `overridden` is false when the value is still the environment variable or the built-in default.

`updateAdminSetting(input: { key, value })` saves one and writes an audit row. `resetAdminSetting(key)` deletes the
row so the environment or the default applies again. `account_minimum_age` cannot be set below 18.

The previous mutations `setGoogleSignInEnabled` and `setStudentIdVerificationEnabled` still work and write the same rows.

### `adminPlans: [AdminPlan!]!`

Every plan: `code`, `name`, `priceMinor` (minor units), `currency`, `interval` (`NONE`, `MONTH`, `YEAR`), `features`,
`active`, `entitlements` (`key`, `limit` as a decimal string or null for unlimited, `appliesToRole`) and
`subscriberCount`. **Saving a price does not charge anyone.**

`createAdminPlan`, `updateAdminPlan` (code is immutable; FREE cannot be deactivated) and `deleteAdminPlan` (FREE, and
any plan someone is on, stay).

## Authorization

`PLATFORM_ADMIN` on every operation above.

## Migration

`20261109090000_admin_dashboard` adds `AppSetting.value` and the plan price columns with defaults. Existing rows are
kept. FREE stays the plan accounts use when they have none. Re-running the migration does not delete data.
