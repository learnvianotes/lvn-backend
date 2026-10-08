# ADR-0037: Moderation before the AI gateway

- Status: Accepted
- Date: 2026-10-09
- Deciders: Backend, Web agents; owner
- Spec sections: §15.1, §15.2, §6.1 (`core` owns moderation and reports, `ai` owns moderation scoring), §4.2

## Context

§15.1 gates public content with AI moderation on publish, user reports, a moderation queue and recorded actions, and
says a public note must not ship without human moderation (Phase 2 exit). The AI gateway that would score content is
Phase 5. Phase 2 makes notes public, so the gate is needed now without AI.

## Decision

1. **The gate.** A note has a moderation state (`ModerationState`: OK, PENDING_REVIEW, HIDDEN, REMOVED). Only OK notes
   are readable through the PUBLIC path; a held (PENDING_REVIEW) note stays readable for the people it is shared with.
   HIDDEN and REMOVED notes are closed to everyone but the owner, who sees the state and the reason, and cannot be made
   public again until a moderator approves them.
2. **Scoring on the way to the public.** Making a note PUBLIC, and publishing a new version of a PUBLIC note, runs the
   `MODERATION_SCORER` facade on the title and the words of the published cards. Phase 2 binds a rule-based scorer in
   `core` (links, repetition, shouting, a word list with categories); Phase 5 binds the AI scorer in `ai` behind the
   same interface. A flagged note goes to PENDING_REVIEW and the author is told why; an open system report puts it in
   the queue.
3. **Reports.** `reportContent(entityType, entityId, reason, details)` by any signed-in user who can see the content,
   once per reporter and entity, rate limited. Three open reports from different people put a public note in
   PENDING_REVIEW until a moderator decides.
4. **The queue.** Until the admin app exists (§15.1), PLATFORM_ADMIN accounts review open cases on a web page:
   APPROVE (back to OK), HIDE, REMOVE, DISMISS (closes the reports and frees a held note), WARN (the same, with a
   reason for the author); SUSPEND waits for account suspension in the users context. Every action is a `ModerationAction` row and an
   audit entry; the author is notified in the note banner. The author may appeal a HIDE or REMOVE once; an appeal
   reopens the case.
5. **Contexts.** Reports, actions, appeals and the scorer live in `core`; the note's state lives in `notes`. They talk
   through facades: `MODERATION_SCORER` (core → used by notes) and `NOTE_MODERATION` (notes → used by core: describe
   notes for the queue, set their state, check that a reporter can read them).

## Consequences

- Public notes ship with a human in the loop; the rule-based scorer will miss things and flag some harmless notes, which
  the queue absorbs while traffic is small.
- The word list is configuration (`MODERATION_WORDS_FILE`), not code, so it can change without a release.
- Groups, comments and resources add their own entity types to reports when they arrive; the queue groups by entity.
- Revisit when the AI gateway lands (Phase 5): bind the AI scorer, keep the rule-based one as a fallback when the
  gateway is down or over budget.
