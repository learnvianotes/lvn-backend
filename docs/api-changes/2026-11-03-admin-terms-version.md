# Terms version managed from the admin page

- Date: 2026-11-03
- Package: `@lvn/contracts` 0.76.0 → **0.77.0**
- Spec: ADR-0103 (amends ADR-0101), §15.2; follows [terms version 2026-11-03](2026-11-03-terms-version-2026-11-03.md)
- Breaking: no. One new admin query, two new settings, two optional environment variables. Existing fields keep
  their shape.

## Why

The terms version was a code constant, so changing it needed a backend release. A platform admin can now change it
from the settings page, limited to versions whose text the web has published (owner default (a) in ADR-0103; the
owner may veto it).

## What changes for clients

### `Query.termsVersion: String!` (public, unchanged shape)

Now the version in effect: the admin setting `terms_version`, else `TERMS_VERSION`, else the built-in `2026-11-03`.
It can change without a release, so read it; never hard-code it. `signUp`, `completeRegistration` and `acceptTerms`
accept only this value (VALIDATION on `acceptedTermsVersion` / `version` otherwise, as before), and
`User.termsAccepted` compares against it. Sign-in and `refreshSession` are not gated. After a change, signed-in
people see the existing accept dialog once.

### Settings (`adminSettings`, `updateAdminSetting`, `resetAdminSetting`, PLATFORM_ADMIN)

New category `legal`:

| Key | Type | Value | Missing row |
| --- | --- | --- | --- |
| `terms_version` | STRING | YYYY-MM-DD, a real date; `constraints.pattern` `^\d{4}-\d{2}-\d{2}$` | `TERMS_VERSION`, else `2026-11-03` |
| `terms_published_versions` | STRING | comma-separated YYYY-MM-DD; stored sorted, without duplicates or spaces | `TERMS_PUBLISHED_VERSIONS`, else `2026-10-08,2026-11-03` |

The version in effect must stay on the published list:

- `updateAdminSetting(key: "terms_version")` with a version that is not published → `userErrors: [{ code: VALIDATION,
  field: ["input", "value"], message: "2026-12-01 is not a published terms version. Choose one of: …" }]`.
- `updateAdminSetting(key: "terms_published_versions")` without the version in effect → VALIDATION on
  `["input", "value"]`.
- `resetAdminSetting` of either key that would leave the version in effect off the list → VALIDATION on `["key"]`.

To publish a new version: deploy the web text, add it to `terms_published_versions`, then save `terms_version`. The
web should confirm before saving `terms_version`: every signed-in person is asked to accept again.

Audit rows for every setting now carry `previous` (the value in effect before). `settings.updated`:
`{ key, value, previous }`; `settings.reset`: `{ key, previous, value }` with `value` the one in effect after.

### `Query.adminTermsStatus: AdminTermsStatus!` (PLATFORM_ADMIN)

```graphql
enum TermsVersionSource { SETTING ENV DEFAULT }

type AdminTermsChange {
  actorId: UUID          # null when that account is gone
  actorDisplayName: String
  at: DateTime!
  previous: String       # version in effect before the change
}

type AdminTermsStatus {
  current: String!
  source: TermsVersionSource!
  publishedVersions: [String!]!   # oldest first
  acceptedCurrent: Int            # null when fewer than 5
  acceptedOlder: Int              # null when fewer than 5
  lastChange: AdminTermsChange    # latest save or reset of terms_version; null if none
}
```

Counts are non-deleted accounts by their latest Terms acceptance (the `termsAccepted` rule). Accounts that never
accepted are in neither count. A count below 5 is null (k-anonymity threshold 5); show it as "fewer than 5".
Anyone else gets `FORBIDDEN`; signed out, `UNAUTHENTICATED`.

### Configuration (`apiConfigSchema`, `workerConfigSchema`)

Two optional variables: `TERMS_VERSION` (YYYY-MM-DD) and `TERMS_PUBLISHED_VERSIONS` (comma-separated YYYY-MM-DD,
spaces trimmed). When both are set, `TERMS_VERSION` must be on the list or the process does not start. Unset, the
built-in values apply. See docs/architecture/env.md.

## Propagation

The process that saves applies the change at once. Other API and worker processes follow within about 15 seconds
(their AppSetting cache reload). A sign-up form submitted to a lagging process in that window gets the usual
VALIDATION answer; reloading fixes it.

## Migration

None. `AppSetting` already stores any key. With no row saved and no variable set, behaviour is the same as
`2026-11-03` today.
