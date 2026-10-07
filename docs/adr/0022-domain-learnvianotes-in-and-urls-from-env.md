# ADR-0022: The domain is learnvianotes.in, and every URL comes from .env

- Status: Accepted (owner decision, 2026-10-08)
- Date: 2026-10-08
- Spec sections: §1, §9.3, §16.1
- Amends: §1 domain table, §9.3 deep links, §16.1 Domains row; supersedes the `.com` addresses written in
  ADR-0002, ADR-0007 and ADR-0021 (their decisions are unchanged)

## Context

The spec used `learnvianotes.com`. The owner decided the product stays on **learnvianotes.in** (the live domain) and
that **all URLs across the three repositories are set through `.env`**, never written into code.

## Decision

**Addresses.**

| What | Production | Sandbox |
| --- | --- | --- |
| Web (student platform) | `https://www.learnvianotes.in` | `https://sandbox.learnvianotes.in` |
| API | `https://api.learnvianotes.in` | `https://api.sandbox.learnvianotes.in` |
| Admin / college / company apps (later, §1) | `admin.` / `org.` / `company.learnvianotes.in` | `*.sandbox.learnvianotes.in` |
| App links | `learnvianotes://` and universal links on the web origin | same |

The canonical web host stays **`www.learnvianotes.in`**, which search engines index today; the bare domain redirects
to it. Switching the canonical host later is a change of one value per environment.

**Every URL comes from the environment.**
- No URL, origin, host or connection string is written into application code or shared contracts, and none has a
  default in a config schema. Code reads them only through the validated config of its repository (lvn-web
  `lib/env.ts`, lvn-mobile `lib/env.ts`, backend `libs/config` → `@lvn/contracts/config`).
- **Per repository:** `.env.example` (committed) lists every variable with development values; developers copy it to
  `.env` (git-ignored) and put personal overrides in `.env.local`. lvn-mobile keeps one public file per build variant,
  `env/<variant>.env`, plus git-ignored `env/<variant>.local.env` (ADR-0008).
- **CI** copies `.env.example` to `.env`; no workflow writes a URL.
- **Sandbox and production** get their values from the deploy environment (ECS task definitions and Secrets
  Manager for the backend; the web host's environment; the mobile build environment) — never from committed files.
- **Contracts carry paths, not domains.** Push notifications link with in-app paths such as `/n/<slug>-<id>`; each
  app joins the path to its own scheme or origin.
- Not covered: fixed third-party tooling endpoints in build configuration (for example the GitHub Packages registry
  URL in `contracts/package.json`), schema URLs, and test fixtures.

## Consequences

- Moving domains, adding a staging host or pointing a phone at a different dev machine is a config change only.
- A missing URL stops the app at start-up or build with the variable's name (verified: lvn-web build fails on a missing
  `NEXT_PUBLIC_SITE_URL`).
- `@lvn/contracts` 0.9.0: `webConfigSchema.NEXT_PUBLIC_SITE_URL` has no default; push `data.deepLink` became
  `data.path` (an in-app path).
