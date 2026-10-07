# ADR-0005: Encoding the permission matrix

- Status: Accepted (owner decisions, 2026-10-08); decision 3 amended by ADR-0017 (verification = confirmed college or organisation email, for every action that reaches other people)
- Date: 2026-10-08
- Spec sections: §4.2, §4.4, §5, §7.1, §15.2
- Amends: §4.2 visibility table (PUBLIC row), §4.4 first bullet

## Context

§5 says permissions are "defined once as constants in `@lvn/contracts/domain`", used by the backend's
`PolicyService` and by clients only to hide controls. The §5 table has to be turned into code, and three of its
cells disagree with other sections.

## Decision

`contracts/src/domain/permissions.ts` holds the matrix as data (`NOTE_READERS` per visibility) plus one pure
function, `can(actor, action, resource)`. It takes **facts**, not ids: the backend loads ownership, share role and
memberships (from its read models) and passes them in, so the function has no I/O and behaves the same on every
platform. `permissions.test.ts` asserts every defined cell and must keep 100 % branch coverage (§17).

The owner settled the three conflicts:

| # | Conflict | Decision |
| --- | --- | --- |
| 1 | §5 lets the Owner fork any note; §4.4 says only PUBLIC and SHARED notes are forkable. | **Owners may fork their own notes at any visibility, PRIVATE included** — it is a copy of their own work and exposes nothing. Everyone else needs read access, a signed-in account and forking enabled; a PRIVATE note stays unforkable for them because they cannot read it. |
| 2 | §5 lets a Note Editor edit the draft at any visibility; §4.2 says only the Owner edits PUBLIC notes. | **A share Editor edits the draft while the note is SHARED or PUBLIC.** Only the Owner publishes, so readers keep seeing the last published version until the Owner releases the next one (§4.3). Share rows grant nothing while a note is PRIVATE. |
| 3 | §5 shows ✓ for comment, publish and join for any signed-in user; §7.1 requires a verified email first. | **Verified email required to comment, publish / change visibility, and request to join a group** (§7.1). Joining a classroom needs no verified email, because every join is approved by the classroom's staff (ADR-0009). Google sign-ins arrive verified (ADR-0007). |

Also encoded: restricted minors cannot set `PUBLIC` (§5, §15.2); `FILE_READ` on a note attachment equals `NOTE_READ`
on its note; anonymous visitors get nothing except reading PUBLIC notes. Joining is by request and approval —
ADR-0009.

## Consequences

Changing a permission is a contracts change: edit the data/function and the test in one PR, bump the contracts version
(major once ≥ 1.0 if access is removed), and note it in `docs/api-changes/`.
