# ADR-0088: Account deletion and the housekeeping it needs

- Status: Accepted
- Date: 2026-10-14
- Deciders: Backend, Web, Mobile agents; owner
- Spec sections: §4.1, §8.4 ("Account deletion: user-initiated, 14-day grace period, then hard delete of personal data
  and anonymisation of public contributions"), §9.2 (`housekeeping`: delete-accounts, orphan-s3), §6.1 (`UserDeleted`)

## Context

Nobody could delete their account. `UserDeleted` was in the event contract, and a dozen consumers already erased their
own tables on it (rhythm, reviews, exams, points, recommendations and more), but nothing published it. Some data had
no eraser at all:

- the users context's own rows;
- notes, folders and files;
- group and class memberships, reactions and join requests;
- AI artifacts and answers;
- device tokens.

Two more gaps from Phase 7 belong with it:

- unattached uploads and covers are never swept (`orphan-s3`);
- files the server stores itself (covers copied from links, files inside an import) skip the virus scan, which runs
  on `FileReady`.

## Decision

**Asking.** `requestAccountDeletion(input: { confirm: "DELETE", password })` requires the account's password when it
has one, and the word DELETE. It then:

- sets `deletionRequestedAt`;
- signs out every other session; the one that asked stays;
- emails the person the date their account will go.

`cancelAccountDeletion` clears the request any time before that date. `User.deletionScheduledFor` (viewer only) is the
request plus 14 days. Web and phone show it with Cancel on every page until then.

**Deleting.** The nightly `delete-accounts` job takes every account past its 14 days. For each, the users context
first:

- signs out everywhere;
- deletes its own rows: sessions, sign-in providers, email tokens, institutional emails, organisation memberships,
  consents, data exports with their files, verification requests with their documents, student and teacher profiles,
  skills and identities, plan, old-site import, follows, blocks, restrictions and connections;
- deletes the avatar;
- turns the user row into a tombstone. It keeps its id, so public contributions keep an author. It is named "Deleted
  user", with a handle `deleted-<id>`, an address under `.invalid`, no password, no date of birth and no roles.

Then `UserDeleted` is published.

**Each context erases or anonymises its part:**

- **notes:**
  - Public, published notes stay: they are contributions, now by "Deleted user".
  - Every other note goes, with its cards, versions, shares, links, chunks and search documents.
  - Folders, tags, saves, imports, highlights, PDF conversions, sync log and read markers go.
  - Files no note links to any more are deleted.
- **core:**
  - Learning data goes (existing erasers), as do old-site progress, reactions, join requests and appeals.
  - Group and class memberships end. A group the person owned passes to its longest-standing admin, else moderator,
    else member, or closes when it is empty.
  - A class the person taught passes to another teacher in it, or closes.
  - Posts, comments, doubts and answers stay, by "Deleted user".
- **ai:**
  - Their artifacts and answers go.
  - Usage rows lose the person but keep their tokens, so monthly budgets still add up.
- **communication:** notifications (existing), device tokens and notification settings go.
- **search:** the person's document leaves the index.

The job announces the deletion again on each of the next seven nights. Every eraser is idempotent, so a consumer that
failed one night catches up the next.

**Housekeeping (§9.2).** The nightly `orphan-s3` job deletes uploads and covers that were never attached a day after
their upload, and pending uploads that never completed. Files the server stores itself are announced with `FileReady`,
like uploads, so they are virus-scanned and get their sizes. The exception is the person's own data exports, which are
restricted and never served to anyone else.

## Consequences

- An account and its private material are gone 14 days after the person asks. What they made public stays, without
  their name.
- Within the grace a person can change their mind, and nothing is lost.
- A teacher's or owner's group or class carries on under someone else when there is someone.
- Audit log rows keep the account's id (security records, §16.6), and the id now names "Deleted user".
- The security suite checks, after deletion, that nothing of the person is readable through any channel.
