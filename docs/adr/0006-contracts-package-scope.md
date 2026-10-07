# ADR-0006: Where @lvn/contracts is published

- Status: Proposed — blocked on the owner
- Date: 2026-10-08
- Spec sections: §2 (Repositories, CI/CD), §3

## Context

§2 pins publishing `@lvn/contracts` to GitHub Packages. GitHub Packages' npm registry only accepts a package whose
scope equals the owning GitHub account or organisation. The repositories live under the personal account
`thrishankkuntimaddi`, so `@lvn/...` can only be published from a GitHub organisation named `lvn` — which the
project would have to own.

## Options

1. **Create or use a GitHub organisation** (e.g. `learnvianotes`) and move the three repos there. The package becomes
   `@learnvianotes/contracts`; every import changes once, now, while nothing consumes it. Org-level permissions and
   CI tokens are also simpler for three repos.
2. **Publish under the personal scope** as `@thrishankkuntimaddi/contracts`, keeping `@lvn/contracts` as an
   install alias (`"@lvn/contracts": "npm:@thrishankkuntimaddi/contracts@^0.1.0"`) so source imports stay `@lvn/...`.
3. **Own the `lvn` organisation name** on GitHub if it is available.

## Recommendation

Option 1 — the spec's name is cosmetic, and an organisation is the natural home for a three-repo product.

## Until decided

The package builds and is consumed inside this workspace as `@lvn/contracts`; `contracts-publish.yml` is in place but
no tag is pushed. lvn-web keeps its local `lib/env.ts` (ADR-0003).
