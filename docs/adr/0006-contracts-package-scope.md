# ADR-0006: Where @lvn/contracts is published

- Status: Accepted; organisation name amended by ADR-0031 (`learnvianotes`; package published as `@learnvianotes/contracts`, imported as `@lvn/contracts`)
- Date: 2026-10-08
- Spec sections: §2 (Repositories, CI/CD), §3

## Context

§2 pins publishing `@lvn/contracts` to GitHub Packages. GitHub Packages' npm registry only accepts a package whose
scope equals the owning GitHub account or organisation, and the old repository lived under a personal account.

## Decision

The owner will create a GitHub organisation named **`lvn`** and publish `lvn-backend`, `lvn-web` and `lvn-mobile`
there. The package keeps the spec's name, `@lvn/contracts`, published from `lvn/lvn-backend`.

Until then the three repositories are local only, side by side in one folder (`LVN/`), with no remotes. Nothing is
published; `contracts-publish.yml` runs on the first `contracts-v*` tag after the move.

If the organisation ends up with a different name, the package scope follows it (`@<org>/contracts`) in a single
contracts major release, before any client depends on the package.

## Consequences

- Clients keep using local copies (lvn-web `lib/env.ts`, lvn-mobile `lib/parse-env.ts`) until the first publish
  (ADR-0003).
- Org-level settings (branch protection, Actions secrets, Packages access for web and mobile CI) are set once.
