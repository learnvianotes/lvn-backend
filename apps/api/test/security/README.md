# Security suite (spec §17.1)

Mandatory: it runs on every pull request that touches auth, files, notes, search, AI, groups or classrooms, and
nightly in full (`.github/workflows/security.yml`). Run it locally with `pnpm --filter @lvn-backend/api test:security`.

The fixture (`support/actors.ts`) seeds **Student A**, **Student B**, **Teacher T** and a platform admin. **Group G**
(A a member, B not) and **Classroom C** (B a member, A not) are made by the Phase 3 tests that need them; the matrix
test seeds its own world with every group and class role. Every §17.1
assertion has a test here: the ones whose channel exists are implemented, the rest are `it.todo` naming the phase that
brings the channel, so the list of open items is visible in every run.

| §17.1 assertion | Channels today | File |
| --- | --- | --- |
| B cannot read, fork, comment on or get AI answers about A's private notes | none yet (Phase 2, 5) — today: viewer-only account fields | `privacy.security.test.ts` |
| B cannot see G's shared notes or posts; A cannot see C's content | group and class queries, notes, search, sync, notifications, sharing and posting into them | `privacy.security.test.ts` |
| Content moderators hid reaches no other member, and its author never learns who reported it (ADR-0051) | posts, the activity feed, discussions, reports, the queues, notifications, every type in the schema | `privacy.security.test.ts` |
| Every community action of the §5 matrix is refused to whom it refuses and allowed to whom it allows; an action without cases fails the suite | every group, workspace, classroom, people, teacher, report and moderation mutation and queue | `matrix.security.test.ts` |
| A student cannot obtain TEACHER or GROUP_ADMIN through any mutation | every mutation, fuzzed | `roles.security.test.ts` |
| A pre-signed URL stops working when access is lost (TTL ≤ 15 min, re-checked on issue) | upload URLs, verification documents | `files.security.test.ts` |
| Unpublishing removes a note from search, recommendations and RAG within 60 s | none yet (Phase 2, 4, 5) | `privacy.security.test.ts` |
| Depth, complexity, pagination caps and rate limits reject abuse | GraphQL gateway, list queries | `abuse.security.test.ts` |
| Spoofed MIME, oversized and EICAR uploads are rejected or quarantined | upload flow | `files.security.test.ts` |
| Brute force and credential stuffing are rate-limited; refresh-token reuse revokes the family | sign-in, refresh | `abuse.security.test.ts` |
