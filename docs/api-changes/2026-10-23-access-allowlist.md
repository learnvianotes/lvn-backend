# Beta access allowlist

- Date: 2026-10-23
- Package: `@lvn/contracts` 0.70.0 → **0.71.0**
- Spec: beta invite list. Depends on the admin settings registry (0.68.0). Public plans shipped as 0.70.0, so this is 0.71.0. The composed schema includes both.
- Breaking: no. New queries and mutations. Existing fields stay.

## What changes for clients

`accessPolicy { inviteOnly }` is public. It is true only when an admin has saved `access_allowlist_enabled` as `true`.
That setting is a boolean in `adminSettings`, category `auth`, default `false`. It is not an environment variable.

While `inviteOnly` is true, email+password sign-up and sign-in, the email link that attaches a password, Google
sign-in and sign-up, and GitHub and LinkedIn sign-in (including linking to an existing account) succeed only for
emails on the list. A blocked call returns:

```
userErrors [{ code: FORBIDDEN, field: ["email"], message: "LearnViaNotes beta is invite-only. Ask an admin to add your email." }]
```

Password reset still returns `ok: true` for an address that is not listed, and sends nothing. A reset link for an
address that was removed fails as an invalid or expired link.

A session whose email is no longer listed is revoked on the next refresh. Removing an entry revokes that account's
sessions at once. The role on the entry is the account's `globalRole` on sign-up, and is written onto an existing
account when the entry is added or updated.

### Platform admins

`adminAccessAllowlist(search: String): [AccessAllowlistEntry!]!`

`addAccessAllowlistEntry`, `updateAccessAllowlistEntry`, `removeAccessAllowlistEntry`.

Emails are stored lowercased. `CONFLICT` when the email is already listed. `VALIDATION` for a bad email. You cannot
remove or demote your own entry, or the last `PLATFORM_ADMIN` (GraphQL `FORBIDDEN` with a message). Add, update,
remove and the setting toggle each write an audit row (`access_allowlist.added`, `access_allowlist.updated`,
`access_allowlist.removed`, and `settings.updated` for the toggle).

The migration copies every existing account onto the list at its current role. `publisher@learnvianotes.invalid` is
not a sign-in account; publishing does not consult the list.

Age checks are unchanged. Someone under 18 is still refused, whether or not their email is listed.
