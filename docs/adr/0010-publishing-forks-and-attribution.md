# ADR-0010: Publishing forks, and attribution everyone can see

- Status: Accepted (owner decision, 2026-10-08)
- Date: 2026-10-08
- Spec sections: §4.2, §4.4, §5, §9.3
- Amends: §4.4 (fork bullets)

## Context

ADR-0005 lets a share Editor edit a note's draft but only the Owner publishes it. The owner decided that an Editor
who wants their own version out **forks the note and publishes the fork**, and that **everyone can see where a
fork came from**.

Forks of SHARED notes raise a leak: a fork is owned by its forker, so without a rule anyone who can read a SHARED note
(viewers, group or class members) could fork it and publish someone else's non-public work to the internet.

## Decision

**Who may make a fork PUBLIC.** A fork can be published at PUBLIC visibility only if

1. its origin was **PUBLIC when it was forked** (the §4.4 public-content licence already allows this), or
2. the forker was the origin's **Owner or a share Editor** when they forked it (a co-author publishing their own
   version, as the owner decided).

Everyone else's fork of a SHARED note can stay PRIVATE or be SHARED, never PUBLIC. The usual publishing rules still
apply (verified email, restricted minors, moderation). Encoded in `can()` from facts stored on the fork:
`forkedFromVisibility` (snapshot at fork time — later changes to the origin do not matter, §4.2) and
`forkedAsRole` (`OWNER | EDITOR | READER`).

**Attribution.** Every fork carries a credit line that its owner cannot edit or remove, shown to every reader on web,
mobile and the public SEO page:

| Situation | Shown |
| --- | --- |
| Reader can open the origin | "Forked from **‹origin title›** by ‹author›" linking to the origin and the version forked |
| Reader cannot open the origin (it is SHARED or PRIVATE) | "Forked from a note by ‹author›" — the author is credited, the private title is not revealed |
| Origin deleted or unpublished | "Forked from a note by ‹author› that is no longer available" |
| Origin author deleted their account | "Forked from a note by Deleted user" (§7.2) |

Chains of forks credit the immediate origin; the origin's own credit line is one click away.

**Telling the origin's owner.** `NotePublished` carries `forkedFromNoteId` for forks; `communication` notifies the
origin's owner in-app (and by push, per their settings) when a fork of their note is published PUBLIC.

**Consent in the UI.** The share dialog states, when the owner grants Editor: "Editors can publish their own copy of
this note, with credit to you." The publish dialog of a fork shows the credit line that will appear.

## Consequences

- Co-authors can release their own version without the owner losing control of the original.
- A SHARED note cannot reach the public through a viewer's or member's fork.
- `Note` gains `forkedFromVisibility` and `forkedAsRole` (notes schema, Phase 2); GraphQL `NoteAttribution` gains
  `ownerHandle` and `originAvailable`.
