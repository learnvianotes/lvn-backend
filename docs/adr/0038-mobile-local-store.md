# ADR-0038: The phone's notes in expo-sqlite, with our own outbox

- Status: Accepted
- Date: 2026-10-09
- Deciders: Mobile, Backend agents; owner
- Spec sections: §2 (WatermelonDB), §13.1, §13.2

## Context

§2 and §13.1 pin WatermelonDB for the phone's notes, cards and sync queue. Its last release (0.28.0) predates Expo SDK
57 and React Native's New Architecture, which work only through community forks. The sync protocol is ours either way
(§13.2: outbox, per-entity conflict rules decided by the server), so WatermelonDB's sync adapter would be bypassed.
The plan for Phase 2 (docs/plans/phase-2.md) proposed expo-sqlite with Drizzle.

## Decision

1. **expo-sqlite (SDK 57), plain SQL.** One database per phone (`lvn-notes.db`): `notes`, `cards`, `outbox`, `kv`.
   Migrations are an ordered list of SQL scripts applied by `PRAGMA user_version`. A thin typed module
   (lvn-mobile `features/notes/store/db.ts`) is the only code that writes SQL. Drizzle is not used: four tables do not
   repay its build setup (Babel inline import and a Metro extension for its migrations) and an extra dependency.
2. **Dirty flags, then a frozen outbox.** An edit writes the local row at once and marks it dirty. A sync first
   *freezes* dirty changes into outbox operations (`CREATE_NOTE`, `UPDATE_NOTE` with card operations and the revision
   each was based on, `TRASH_NOTE`, `RESTORE_NOTE`) with a `clientOpId`, in one transaction, then pushes the outbox in
   order (`syncPush`). Retries resend the same operations, so the server answers them once (lvn-backend SyncOpLog).
3. **The server decides.** Verdicts: APPLIED (keep the new revisions), REJECTED (kept in a visible "Needs attention"
   list until the person lets the change go; §13.2 "never discarded without the user confirming"), RETRY (stop, try on
   the next trigger). Card conflicts are settled by the server's CONFLICT versions (§13.2), as on the web.
4. **Pull and merge.** `syncPull` brings changed notes with all their cards; a dirty title or card on the phone wins
   until the server has answered it, notes with operations in flight are left alone, and notes not in `liveNoteIds`
   are removed unless they have unsent changes.
5. **One account at a time.** The database belongs to the account in the access token; another account signing in on
   the phone starts from an empty database. Signing out keeps the data for the same account, so unsent work survives.
6. **Triggers.** Opening the signed-in app, returning to the foreground, the connection returning (expo-network),
   and 2.5 s after an edit.

## Consequences

- The sync logic that matters (freezing, merging, what to drop) is pure and unit-tested; SQL stays small.
- Notes made offline keep their device-made UUIDv7 ids end to end (`CreateNoteInput.id`).
- Media cards are shown as placeholders on the phone until media sync (download and LRU cache, §13.1) arrives.
- Revisit if the phone's data grows beyond notes (groups, quizzes): Drizzle or another ORM may then pay off.
