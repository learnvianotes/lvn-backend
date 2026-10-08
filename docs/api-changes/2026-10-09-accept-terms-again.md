# Accepting the terms again (Phase 2, P2d-3)

- Date: 2026-10-09
- Package: `@lvn/contracts` unchanged; GraphQL only
- Spec: §15.2 ("re-prompt on material change")
- Breaking: no

`User.termsAccepted: Boolean` — the viewer's own (null for anyone else): whether their latest acceptance is of the
current `Query.termsVersion`. `acceptTerms(input: { version })` records the Terms, the Privacy Policy and the
public-content licence at that version (VALIDATION if it is not the current one; accepting twice changes nothing).

Bump `TERMS_VERSION` (contexts/users/src/domain/rules.ts) together with the web app's `features/legal/documents.ts`
when the documents change materially; clients then ask everyone to accept again (web: a dialog on signed-in pages;
mobile: with the notes screens, P2f). The live web tests check that both versions match.
