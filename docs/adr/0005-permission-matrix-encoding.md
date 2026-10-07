# ADR-0005: Encoding the permission matrix

- Status: Proposed — needs the owner's answer on the three interpretations below
- Date: 2026-10-08
- Spec sections: §4.2, §4.4, §5, §7.1, §15.2

## Context

§5 says permissions are "defined once as constants in `@lvn/contracts/domain`", used by the backend's
`PolicyService` and by clients only to hide controls. The §5 table has to be turned into code, and three of its
cells disagree with other sections.

## Decision

`contracts/src/domain/permissions.ts` holds the matrix as data (`NOTE_READERS` per visibility) plus one pure
function, `can(actor, action, resource)`. It takes **facts**, not ids: the backend loads ownership, share role and
memberships (from its read models) and passes them in, so the function has no I/O and behaves the same on every
platform. `permissions.test.ts` asserts every defined cell of the §5 table and must keep 100 % branch coverage (§17).

Where sections disagree, the stricter rule is encoded:

| # | Conflict | Encoded rule |
| --- | --- | --- |
| 1 | §5 lets the Owner fork any note; §4.4 says only PUBLIC and SHARED notes are forkable. | PRIVATE notes are not forkable, even by the owner. Owners can fork their own SHARED/PUBLIC notes even with forking disabled. |
| 2 | §5 lets a Note Editor edit the draft with no visibility qualifier; §4.2 says PUBLIC notes are edited by the Owner only. | A share EDITOR edits only while the note is SHARED. |
| 3 | §5 shows ✓ for comment/publish/join for any signed-in user; §7.1 requires a verified email first. | Comment, publish/change visibility and group join require `emailVerified`. Classroom join does not (invite codes are often used before verification) — confirm. |

Also encoded: restricted minors cannot set `PUBLIC` (§5, §15.2); `FILE_READ` on a note attachment equals `NOTE_READ`
on its note; anonymous visitors get nothing except reading PUBLIC notes.

## Consequences

Changing a permission is a contracts change: edit the data/function and the test in one PR, bump the contracts
minor (or major if access is removed), and note it in `docs/api-changes/`. If the owner picks the looser reading for
any row, that row's code and test flip and this ADR is accepted with the answer recorded.
