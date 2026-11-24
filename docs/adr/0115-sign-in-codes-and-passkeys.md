# ADR-0115: Sign in with an emailed code or a passkey; GitHub and LinkedIn sign-in retired

- Status: Accepted
- Date: 2026-11-25
- Deciders: owner; Backend, Web, Mobile agents
- Spec sections: §7 (auth)

## Context

The owner asked for a simple sign-in with strong safety: Google, email and password, passkeys and an emailed one-time
code, and to remove GitHub, GitLab and LinkedIn sign-in.

## Decision

- `requestSignInCode` always answers ok (no account enumeration). For a live account it emails a 6-digit code, stored
  only as HMAC-SHA256(`id:code`, CODE_HMAC_SECRET), valid 10 minutes, single use, burnt after 5 wrong tries; a new
  request ends earlier codes. Limits: 5 requests an hour per address, 40 per network, 10 checks per 15 minutes per
  address; failures count toward the network's failed-sign-in limit. A correct code verifies the login email.
- Passkeys (WebAuthn via @simplewebauthn/server): discoverable credentials, user verification required, attestation
  none. Only the public key and counter are kept (`users.passkey_credentials`); a counter that goes backwards is
  refused. Challenges live in Redis for 5 minutes and are deleted on first use. RP ID is WEB_URL's host; extra origins
  (the Android app) come from PASSKEY_ORIGINS. At most 10 passkeys an account.
- `signInOptions.github` and `.linkedin` are always false (deprecated fields kept for older apps); `oauthExchange`
  refuses both providers. Existing accounts made with them sign in with an emailed code or a password reset. GitHub
  remains a connection for skills import and project workspaces.

## Consequences

Mobile passkeys need the Android asset links / iOS associated domains and a native module before the app can offer
them; until then the app offers Google, code and password. The emailed-code template is the MFA code template.
