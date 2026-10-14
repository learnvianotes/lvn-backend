# Repository activity from a GitHub App (P7d)

- Date: 2026-10-14
- Package: `@lvn/contracts` 0.52.0
- Spec: ADR-0078
- Breaking: no

## What changes for clients

Nothing shows until the owner configures the GitHub App (all `GITHUB_APP_*` variables).
- **`GroupRepository.app`** gives `{ connected, installUrl }` to members of a workspace whose repository is on
  GitHub. `installUrl` goes to the workspace's admins only, while not connected, and is valid for an hour. `app` is null
  when the App is not set up.
- **`connectRepositoryApp({ state, installationId, code })`**: the web's `/github/setup` page sends what GitHub
  returns.
  - Refused when the installation is not the person's ("That GitHub installation is not one you made."), when it does
    not cover the workspace's repository, when the state is forged or older than an hour, or when the person is not
    an admin.
- **`disconnectRepositoryApp({ groupId })`** stops the activity and deletes what was kept.
- **`GroupRepository.events(first)`** lists commits, pull requests and issues for members, newest first, and is null
  for anyone else. Each event has `kind`, `action`, `title`, `number`, `authorLogin` (a GitHub login), `url` and `at`.
- **`ActivityItem` gains `REPOSITORY`** and `repositoryEvent`. Its `actor` is null.
- **`POST /webhooks/github`** (API, not GraphQL):
  - 202 for a delivery with a good `X-Hub-Signature-256`, and `{ duplicate: true }` for a repeated
    `X-GitHub-Delivery`;
  - 401 for a bad signature;
  - 404 while the App is not configured.

## Data

- `core.GitHubInstallation`, `core.GitHubDelivery` (kept 30 days), `core.RepositoryEvent` and
  `GroupRepository.installationId`. Migration `20261031090000_github_app`.
