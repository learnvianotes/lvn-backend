# ADR-0103: Terms version managed from the admin page

- Status: Proposed (owner default (a), 2026-11-03; the owner may veto it)
- Date: 2026-11-03
- Deciders: Backend; owner
- Spec sections: §15.2 ("re-prompt on material change"), §6.3 (short caches)
- Amends: ADR-0101 (two new settings in category `legal`; every settings audit row gains `previous`)

## Context

The version people accept for the Terms, the Privacy Policy and the public-content licence was the constant
`TERMS_VERSION` in `contexts/users/src/domain/rules.ts`. Changing it needed a backend release in step with lvn-web's
`features/legal/documents.ts`. Clients already read `Query.termsVersion` and send it back, so the API decides which
version sign-up, `completeRegistration` and `acceptTerms` require. The legal **text** ships in lvn-web, so an admin
must not be able to point people at a version whose text is not deployed.

## Decision

**Version in effect.** The admin setting `terms_version` (STRING, category `legal`, a real YYYY-MM-DD date), else the
`TERMS_VERSION` environment variable, else the code constant `DEFAULT_TERMS_VERSION` (`2026-11-03`). A saved value that
does not parse is skipped, so a bad row cannot block sign-up. `TermsVersionProvider.current()` is the only reader;
`signUp`, `completeRegistration`, `acceptTerms`, `User.termsAccepted`, the age-block hold (which records the version
its caller already checked) and `Query.termsVersion` all use it.

**Published versions (owner default (a)).** An admin chooses only among versions the web has published. lvn-web's
legal pages are the source of truth and will export that list (a later web PR). The backend keeps an allowlist: the
setting `terms_published_versions` (comma-separated YYYY-MM-DD, stored sorted and without duplicates), else
`TERMS_PUBLISHED_VERSIONS`, else the code default `2026-10-08,2026-11-03`. The operator keeps it in step with the web.
The rule: **the version in effect is always on the published list.** So a save of `terms_version` outside the list is
refused (VALIDATION, naming the published versions), and a save or reset of the list, or a reset of `terms_version`,
that would leave the version in effect off the list is refused (VALIDATION). The check reads the saved rows from the
database, not the cache. When both variables are set, the environment must satisfy the same rule or the process does
not start; a `TERMS_VERSION` alone that is not on the built-in list logs a warning at start-up. To publish a new
version: deploy the web text, add the version to `terms_published_versions`, then switch `terms_version`. The web
admin page confirms before saving, because every signed-in person is asked to accept again.

**Caching and other processes.** The provider reads `PlatformSettingsStore`, the process's AppSetting cache
(ADR-0101): a save or reset updates the writing process at once, and every API and worker process re-reads the table
every 15 seconds. A second process can therefore require the previous version for up to about 15 seconds; a sign-up
form caught in that window gets the existing VALIDATION answer and reloads.

**Audit.** Saves and resets go through `AppSettingsService` and the existing `updateAdminSetting` /
`resetAdminSetting` mutations. `settings.updated` metadata is `{ key, value, previous }` and `settings.reset` is
`{ key, previous, value }`, where `previous` is the value in effect before (saved row, environment or default) and a
reset's `value` is the one in effect after. This applies to every setting.

**Admin view.** `adminTermsStatus` (PLATFORM_ADMIN only): `current`, `source` (`SETTING`, `ENV`, `DEFAULT`),
`publishedVersions`, `acceptedCurrent`, `acceptedOlder` and `lastChange { actorId, actorDisplayName, at, previous }`
from the latest audit row for `terms_version`. Counts are non-deleted accounts by their latest Terms acceptance, the
same rule as `User.termsAccepted`. They are counts only, and a count below 5 is returned as null (k-anonymity
threshold 5). No public query lists published versions; the public surface stays `Query.termsVersion`.

**Unchanged.** Sign-in, `refreshSession` and every other operation stay ungated on the terms; clients show their
accept dialog when `termsAccepted` is false. No migration: `AppSetting` already stores any key. Google Analytics
(ADR-0092) is untouched.

## Consequences

The owner can change the terms version without a backend release, but only to a version the web already serves, and
each change is attributed in the audit log with what it replaced. The allowlist is a second list to keep in step with
the web by hand until the web exports its list; forgetting to add a version only blocks the switch, it never shows
people a missing text. If the owner vetoes (a), the alternative is legal text stored in the database (option B in the
admin plan), which replaces the allowlist with the stored documents. Revisit when the web exports its list or when
the API runs more than one replica (a pub/sub invalidation would remove the 15-second window).
