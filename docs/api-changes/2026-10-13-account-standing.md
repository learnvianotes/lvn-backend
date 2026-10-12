# Account standing: warnings, suspensions, removed groups (P3o)

- Date: 2026-10-13
- Package: `@lvn/contracts` 0.28.0
- Spec: §15.1; ADR-0037, ADR-0051, ADR-0053
- Breaking: no. Two behaviours change: SUSPEND now works on accounts, and APPROVE works on accounts and groups.

## What changes for clients

**The person's own standing:**
- `myStanding: AccountStanding!` — `suspendedUntil`, `suspensionReason`, `canAppeal`, and `warnings { reason at }`
  from the last 90 days. Always the viewer's own.
- MODERATION notifications gain `kind: SUSPENDED`; `WARNED`, `SUSPENDED` and `RESTORED` come with
  `entityType: USER` and open `/profile`.
- `appealModeration(entityType: USER, entityId: <own id>)` appeals the current suspension, once.

**Removed groups:**
- `removedGroup(id): RemovedGroup` — `name`, `reason`, `removedAt`, `canAppeal`, for the owner of a group platform
  moderators removed; null for anyone else and for groups their owners deleted. `group(id)` stays null for it.
- `appealModeration(entityType: GROUP, entityId)` by that owner, once.

**Moderators (platform admins):**
- `ModerateContentInput.suspendDays: Int` (1–365) with `action: SUSPEND` and a `reason`, on USER cases only.
- APPROVE on a USER case lifts a suspension; on a removed group's case it puts the group back.
- `ModerationCase.suspendedUntil` (USER cases) and `ModerationCase.removedGroup` (GROUP cases).

**Refusals:** while suspended, publishing, sharing, going public, commenting, reacting, posting, joining, following,
connecting, teaching profile edits and moderating are FORBIDDEN, with the message "Your account is suspended until
<date>, so nothing you do reaches other people until then." Taking a note back to PRIVATE is allowed.

## What clients should do

- lvn-web and lvn-mobile: show the standing on the account page and a banner while suspended, with the appeal; the
  removed group's reason and appeal where the group was; SUSPEND (with days) and the lift on account cases in the
  platform queue; describe the new notification kinds.
