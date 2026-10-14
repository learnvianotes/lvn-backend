# Account deletion

- Date: 2026-10-14
- Package: `@lvn/contracts` 0.58.0
- Spec: ADR-0088 (§8.4, §9.2)
- Breaking: no

## What changes for clients

- **`requestAccountDeletion(input: { password, confirm })`**: `confirm` must be the word DELETE (any case);
  `password` is required when the account has one. User errors:
  - `["input", "confirm"]`: "Type DELETE to confirm.";
  - `["input", "password"]`: "That password is not right."

  It returns `deletionScheduledFor`, 14 days from the first request; asking again keeps the date. Every other session
  is signed out, and the person is emailed the date with a link back to their profile.
- **`cancelAccountDeletion`** keeps the account and returns `deletionScheduledFor: null`.
- **`User.deletionScheduledFor`** (viewer only): show it on every page with Cancel until then.
- **After the date:**
  - the account is gone: its sessions end and it cannot sign in;
  - its private notes, files, learning history, results, saves, follows and memberships are deleted;
  - what it made public stays: public notes, posts, comments, doubts and answers. Their author is `displayName:
    "Deleted user"` with a handle starting `deleted-`.

  A group or class the person owned passes to its next admin or teacher, or closes when nobody is left. Clients render
  such an author as plain text, not as a link to a profile, since `userByHandle` finds nobody.
- **Files the server stores itself** (a cover copied from a link, a file inside an import) are virus-scanned like
  uploads. Their sizes (`thumbUrl`, `mediumUrl`) appear once processing is done.
- **Uploads never completed or never attached** are deleted after a day.
