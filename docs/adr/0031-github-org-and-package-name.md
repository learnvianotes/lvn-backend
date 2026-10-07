# ADR-0031: GitHub organisation `learnvianotes`; contracts published as @learnvianotes/contracts

- Status: Accepted (owner created the organisation, 2026-10-08)
- Date: 2026-10-08
- Spec sections: §2 (Repositories, CI/CD), §3
- Amends: ADR-0006 (the organisation is `learnvianotes`, not `lvn`)

## Context

ADR-0006 expected a GitHub organisation named `lvn`, which would have let the package keep the spec's name,
`@lvn/contracts`. The owner created **https://github.com/learnvianotes**. GitHub Packages only accepts a package whose
scope is the owning organisation.

## Decision

- Repositories: `learnvianotes/lvn-backend`, `learnvianotes/lvn-web`, `learnvianotes/lvn-mobile`.
- The package is **published** as `@learnvianotes/contracts` and **imported everywhere as `@lvn/contracts`**, so the
  spec, the ADRs and all code keep one name:
  - inside lvn-backend, a pnpm workspace alias: `"@lvn/contracts": "workspace:@learnvianotes/contracts@*"`;
  - in lvn-web and lvn-mobile, an npm alias: `"@lvn/contracts": "npm:@learnvianotes/contracts@^<version>"`, with
    `@learnvianotes:registry=https://npm.pkg.github.com` in `.npmrc` and the read token taken from the environment
    (`NODE_AUTH_TOKEN`), never committed.
- `contracts-publish.yml` publishes on a `contracts-v*` tag from `learnvianotes/lvn-backend`.

## Consequences

One import name in documentation and code; the published name only appears in `package.json` dependency lines and
`.npmrc`. If the organisation is ever renamed, only those lines change.
