# ADR-0078: Repository activity from a GitHub App, in project workspaces

- Status: Accepted
- Date: 2026-10-14
- Deciders: Backend, Web and Mobile agents
- Spec sections: ADR-0015 (repository activity, Phase 7), ADR-0048 (project workspaces: public metadata without an
  App), ADR-0049 (activity feed); Phase 7 plan, "Research this plan rests on" (GitHub App webhooks)

## Context

ADR-0048 shows a workspace's repository from GitHub's public API: no tokens and no webhooks. ADR-0015 promised more
for Phase 7: a team installs a GitHub App, and the workspace feed shows the repository's commits, pull requests and
issues.

The Phase 7 plan's research sets the rules:
- **Permissions:** Contents: read for `push`, Pull requests: read and Issues: read. Metadata: read comes with them.
- **Deliveries:** each one is signed with HMAC-SHA256 (`X-Hub-Signature-256`) and must be answered within 10 seconds.
  Deliveries are de-duplicated on `X-GitHub-Delivery`.
- **The setup redirect's `installation_id` can be spoofed.** It must be confirmed with the installing user's token.
- **Tokens:** app JWTs are RS256 and last at most 10 minutes; installation tokens last an hour.
- **Public address:** webhooks need public HTTPS.

There is no App until the owner creates one.

## Decision

1. **Off until configured.**
   - The App needs all of `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_WEBHOOK_SECRET`,
     `GITHUB_APP_CLIENT_ID` and `GITHUB_APP_CLIENT_SECRET`, plus `GITHUB_API_URL` and `GITHUB_APP_URL` (github.com).
     Configuration checks refuse any partial set.
   - Without them, the apps offer nothing: no button that would refuse. The webhook answers 404.
2. **Connecting** (a workspace admin, for a workspace whose repository is on GitHub).
   - `GroupRepository.app` gives the install link, signed with the group's id, with "Request user authorization during
     installation" on.
   - GitHub returns to the web's `/github/setup` with `installation_id`, `code` and `state`.
     `connectRepositoryApp(state, installationId, code)` confirms all three:
     - **The person installed it:** the `code` becomes their user token, and `GET /user/installations` lists the
       installation.
     - **It covers the workspace's repository:** the installation's token lists that repository.
   - Only then is the repository linked. `disconnectRepositoryApp` unlinks it.
3. **Deliveries** (`POST /webhooks/github`).
   - The signature is checked over the raw body in constant time. A delivery id seen before is answered 200 and
     dropped.
   - The endpoint stores the delivery and answers 202 at once. The worker handles it.
   - **Events kept:**
     - `push`: each commit's first line, author and link, at most 20 per push.
     - `pull_request`: opened, closed, merged, reopened.
     - `issues`: opened, closed, reopened.
     - `installation` deleted, and `installation_repositories` removed, unlink.
   - **Never code or diffs.** Only the title, author login, link, kind, action and time (`RepositoryEvent`).
4. **Who sees it.**
   - Workspace members see the repository's activity on the workspace page.
   - Members also see it in their activity feed as `REPOSITORY` items. GitHub logins are shown as text; they are not
     LearnViaNotes people.
5. **Uninstalling or disconnecting** stops the feed and deletes that repository's stored events. The installation
   record goes when GitHub says it was uninstalled.
6. **Data:** `core.GitHubInstallation`, `core.GitHubDelivery` (kept 30 days, for de-duplication),
   `core.RepositoryEvent` and `GroupRepository.installationId`. The events belong to the workspace, not to a person, so
   they are not in anyone's export.

## Consequences

- Teams see their repository's progress beside their doubts and ideas without LearnViaNotes holding code or git.
- **Nothing runs on the local environment until the owner creates the App:**
  - Setting it up: register the App with the permissions above; turn on "Request user authorization"; set the setup URL
    to `${WEB_URL}/github/setup` and the webhook to `${API}/webhooks/github`; configure the variables.
  - Development needs a public URL (smee.io).
  - Tests sign deliveries locally and stand in for GitHub's API.
- An installation may cover many repositories. Only those linked to a workspace produce events.
