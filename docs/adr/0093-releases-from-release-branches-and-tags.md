# ADR-0093: Releases — checks on every push, the sandbox from release branches, production from `v*` tags

- Status: Accepted (owner decision, 2026-10-20, made for the old app's launch build and carried to the rewrite); the deploy mechanism amended by ADR-0096 (Lightsail over SSH instead of deploy.sh on AWS; beta in place of the sandbox)
- Date: 2026-10-21
- Deciders: Backend, Web agents; owner
- Spec sections: §16.4 (CI/CD: "`main` merge: build images, deploy to sandbox …; Production: manual approval → …")

## Context

The owner's launch build of the old app (lvn-web `release/college-launch`) changed how releases happen:

- CI runs on every push;
- the test site follows release branches;
- the live site changes only when a `v*` tag is pushed.

The rewrite should release the same way, so that what is live is always a named, reviewed version. §16.4 instead
deploys every `main` merge to the sandbox and gates production on a manual approval. Two more rules from the same
review apply to the rewrite:

- a test build must never talk to the production Firebase project, so a test site cannot touch live sign-ins;
- the legal pages must not go live with their operator details blank.

## Decision

**Checks on every push.** lvn-web's and lvn-backend's CI run on every branch push and pull request, not only on
`main`.

**Two ways to deploy, both through lvn-backend's `infra/scripts/deploy.sh`.** It refuses any other:

| Environment | Deploys from | Who triggers it |
| --- | --- | --- |
| `sandbox` (the test site) | an lvn-web `release/**` branch (or a `v*` tag, to try a release candidate) | a push to that branch (lvn-web `.github/workflows/deploy.yml`, GitHub environment `sandbox`) |
| `production` | both repositories' HEADs carrying a `v*` tag | pushing the tag (`deploy.yml`, GitHub environment `production`, which should require a reviewer) |

- Each GitHub environment holds its `infra/terraform/envs/<env>/.env` as a secret and a role to assume in its AWS
  account.
- Values from the event reach scripts through `env:`, never written into the script text.
- The manual approval of §16.4 becomes the `production` environment's required reviewer.

**Each build uses its own Firebase project.**

- lvn-web `config/firebase-projects.json` names the production project.
- A `production` build must use it, and any other build must not.
- `next build` refuses a mix-up, so sandbox images can only be built with the test project's keys.

**A production build of the web refuses blank legal details.** `next build` with `NEXT_PUBLIC_APP_ENV=production`
stops while lvn-web `config/legal.ts` → `LEGAL` has a blank field: the operator, address, city for disputes, Grievance
Officer or mailbox. lvn-web's CI builds for production too, as a job that may fail ("launch readiness"), so the gap
stays visible.

## Consequences

- Merging into `main` no longer deploys anything. Releasing means cutting `release/<name>` from `main`, testing it on
  the sandbox, then tagging the release commit in both repositories.
- The local environment (`deploy-local.sh`, ADR-0036) is unchanged: it deploys whatever is checked out.
- Hot fixes go on the release branch, are checked on the sandbox, and are tagged as the next patch version.
- AWS is still deferred. The workflow runs once the environments and the `production` folder of
  `infra/terraform/envs` exist (lvn-web `docs/runbooks/release.md`).
