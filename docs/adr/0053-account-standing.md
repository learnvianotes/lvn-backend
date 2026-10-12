# ADR-0053: Account standing — warnings people read, suspensions, and removed groups

- Status: Accepted
- Date: 2026-10-13
- Deciders: Backend, Web and Mobile agents (P3o); owner ("continue with other issues")
- Spec sections: §15.1, §15.2; ADR-0005, ADR-0017, ADR-0037, ADR-0051

## Context

§15.1 lists `suspend` among the moderators' actions; ADR-0037 left it for later ("SUSPEND waits for account suspension
in the users context"). Phase 3 closed with three gaps in what moderation tells people:
- a warning to an account was recorded, but its owner never saw it;
- accounts could not be suspended;
- a group platform moderators removed told its owner that it was removed, not why, and could not be appealed.

## Decision

1. **Warnings.** A WARN on an account (a USER case, platform admins) tells the person with a MODERATION notification
   (`{ kind: WARNED, entityType: USER }`, opening `/profile`, never the reason). `myStanding.warnings` lists the
   warnings of the last 90 days with their reasons, for the account's owner alone. Warnings are not appealed.
2. **Suspension.**
   - `moderateContent(action: SUSPEND, suspendDays: 1–365, reason)` on a USER case, by platform admins only. The
     `users` context keeps `User.suspendedUntil` and `suspensionReason` (through the POLICY facade: `suspend`,
     `lift`, `suspension`); the Actor carries `suspended` while the time has not passed. Nothing has to run when it
     ends.
   - `can()` refuses a suspended actor everything that reaches other people (`BLOCKED_WHILE_SUSPENDED`: every action
     that needs a verified account, and moderating or running groups and classes, the teacher profile and platform
     moderation). The account still reads; keeps, writes and deletes its own notes; takes a note back to PRIVATE; makes
     private copies; leaves places; unfollows, blocks and restricts; reports; exports its data; appeals.
   - What it published stays up: content is judged on its own reports. Sessions are not ended.
   - The person is told (`SUSPENDED`), reads until when and why in `myStanding`, and may appeal each suspension once.
     The appeal reopens the USER case in the platform queue, which shows `suspendedUntil`. APPROVE on an account lifts
     the suspension (`RESTORED`); DISMISS keeps it.
3. **Removed groups.** REMOVE on a group still deletes it for everyone (`GroupDeleted`), and keeps why in
   `Group.removedReason`. Its owner reads the reason with `removedGroup(id)` and may appeal once; the platform queue
   shows the removed group with the appeal. APPROVE puts it back: `deletedAt` cleared, `GroupRestored` so `notes`
   opens its shared notes to the members again, and the owner is told (`RESTORED`). A group its owner deleted is not a
   removed group and has nothing to appeal.

## Consequences

- One flag on the Actor covers every context: no context checks suspensions itself, and the permission matrix tests
  them through the API.
- A suspension longer than a year is a new decision when the first ends.
- An account's earlier decided appeal is dropped when it is suspended again, so each suspension has its one appeal; the
  decisions themselves stay in `ModerationAction` and the audit log.
- Revisit when the admin app (§15.1) replaces the web's platform queue, and if repeat offenders call for automatic
  escalation (the copyright repeat-infringer policy of §15.2).
