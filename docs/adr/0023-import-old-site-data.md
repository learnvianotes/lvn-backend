# ADR-0023: Bring the old learnvianotes.in data across in Phase 1, readable by the web

- Status: Accepted (owner decision, 2026-10-08)
- Date: 2026-10-08
- Spec sections: §6.1, §11, §14.1, §15.2, §18
- Answers: existing-state.md → Cut-over, open question

## Context

The live site stores each learner's data in Firestore: `users/{uid}` (progress — topics read, topics to revisit,
problems marked solved/revisit, items studied per day — and preferences), `users/{uid}/days/{date}` (time per topic
per day, focus minutes), `users/{uid}/notes/{id}` (personal notes per topic) and `users/{uid}/events/{batch}` (raw
activity). Topic keys are `subjectId/topicId`, the same ids the rewritten `/core` pages use. The owner decided to
**use this data in Phase 1**, and that it must be **consumable by the web through an endpoint**.

## Decision

**Snapshot, then claim.**
1. Phase 1 adds a one-off **snapshot job**: read-only Firestore access (a service account held in Secrets Manager)
   copies every user's documents and the Firebase Auth user list (uid, email, providers) into an encrypted, private
   S3 prefix as JSON per user. It re-runs until the old site is switched off, then the Firestore data is deleted.
2. A returning user **claims** their data:
   - **Google users** — sign-in already carries their Firebase UID (ADR-0007), so the data is matched automatically
     and the user is told "Your progress from the old site is here" with a button to remove it.
   - **Email + password users** — matched by the same verified email; the user confirms before anything is attached.
   - Either way the user can **decline**; declined or unclaimed snapshots are deleted 12 months after cut-over.
3. `users` emits `LegacyDataClaimed`; `core` and `notes` import their parts from the snapshot (`LegacyImportPartDone`).

**Mapping.**

| Old data | New home |
| --- | --- |
| Topics read, topics to revisit, problem marks | `core`: `/core` progress, as `TOPIC_COMPLETED` / `PROBLEM_MARKED` learning events (new event types) |
| Per-day time per topic, focus minutes | `core`: learning history (`TIME_SPENT`, `TOPIC_VIEWED`) — feeds the habit system that replaces streaks |
| Personal notes per topic | `notes`: PRIVATE notes, each linked to its `/core` topic |
| Preferences (subject order, daily goal, "notify me" courses) | `users`: settings; course interests seed profile interests (ADR-0026) |
| Raw events | `core`: kept in a legacy archive for 24 months (§15.2 retention) and used only for history and recommendations |

**The endpoint.** One GraphQL API (`/graphql` on the API origin from `.env`, ADR-0022) serves web and mobile alike:
- `viewer.legacyImport` → status (`NOT_FOUND`, `AVAILABLE`, `CLAIMED`, `DECLINED`), counts, claim date;
  `claimLegacyData`, `declineLegacyData`.
- `coreProgress(subjectId)` → topics completed, topics to revisit, time studied, problem marks. It returns the **old
  history plus everything recorded since**, so the `/core` pages show read status and personal notes for every
  signed-in learner, not only returning ones. `/core` stays statically generated; progress loads in the browser after
  sign-in.

**Permissions.** `account.claimLegacyData` — the signed-in owner only, verified or not (it is their own data).

## Consequences

- Returning learners keep their history and notes on day one of the new site.
- Firestore stays readable only until cut-over plus the snapshot; then the old project keeps Authentication (Google)
  and Cloud Messaging only (ADR-0007, ADR-0021).
