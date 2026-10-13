# Resources: submit and moderate (P7a)

- Date: 2026-10-13
- Package: `@lvn/contracts` 0.46.0
- Spec: §14.4, §18 (Phase 7); ADR-0074
- Breaking: no

## What changes for clients

- **`resourcePreview(input: { url } | { isbn })`** (signed in, may submit; 30 an hour) reads a page or looks a book up
  on Open Library. It returns:
  - the link as it would be kept (no tracking or affiliate parameters) and the type suggested;
  - title, description, author, ISBN, site name and the page's picture (`imageUrl`);
  - `found`, and `existing`: an approved resource with the same link or ISBN.

  If the page cannot be read, `found` is false and nothing else is an error. If the address is not on the public
  internet, the answer is `VALIDATION` ("That address is not on the public internet.").
- **`submitResource(input)`**:
  - Fields: `type`, `title` (3–200), `description` (≤ 2,000), `url`, `isbn` (books, ISBN-10 or -13), `author`,
    `topicIds` (1–5 curated topics).
  - A cover is either `coverFileId`, from `createUploadIntent(purpose: COVER)` (JPEG, PNG or WebP, ≤ 2 MB), or the
    preview's `imageUrl`, which the server copies into storage. A picture that cannot be copied is left out.
  - It answers `ResourcePayload`, with the resource `PENDING`.
  - Refusals:
    - `FORBIDDEN`: unverified, child or suspended accounts, each with a reason.
    - `CONFLICT`: a pending or approved resource has the same link or ISBN. An approved one is named.
    - `RATE_LIMITED`: 10 a day.
    - `VALIDATION`: 20 waiting.
- **`updateResource(input)`** is for its submitter while it is `PENDING` or `REJECTED`. Saving a rejected one sends it
  to moderators again, and `removeCover` takes the cover away. An approved resource answers `FORBIDDEN`.
- **`deleteResource(input: { id })`** is for its submitter, or a platform admin.
- **`resource(id)`** answers anyone, guests included, for an approved resource. A pending or rejected one answers only
  its submitter and platform admins; anyone else gets `null`.
  - Fields:
    - `host` (the link's site), `coverUrl` (a read URL for 15 minutes), `topics`, `submittedBy` and `status`;
    - `reason` (submitter and moderators only);
    - `viewerCan { edit delete report }`.
- **`myResources`** lists the viewer's resources, newest first, in every state.
- **`resourceTopicOptions(query)`** finds curated topics only (a resource's topics); a person's own proposals are left out.
- **Moderation:**
  - `ReportEntityType.RESOURCE` exists, and `ModerationCase.resource` is set for resource cases.
  - Every submission opens a case in the platform queue. Its report has no reporter, with details "New resource,
    waiting for approval." or the word check's verdict.
  - `moderateContent` on a resource:
    - `APPROVE` approves it, or puts it back.
    - `REMOVE` rejects or removes it. A reason is required, and it is shown to the submitter.
    - `DISMISS` closes people's reports on an approved resource.
  - `reportContent` works on approved resources. Three people's reports take one off the catalogue until a moderator
    looks.
- **Notifications:** category `RESOURCE`, `data: { decision: APPROVED | REJECTED }`, path `/resources/<id>`. It can be
  turned off.

## Authorization

- A pending or rejected resource is "not found" to everyone but its submitter and platform admins.
- The server fetches only through the safe fetcher, which never connects to this machine or to private, link-local or
  metadata addresses, on any redirect.

## What clients should do

- Offer "Add a resource" with a link or ISBN preview, a type, topics from the curated list, and an optional cover.
- Show links as `<a rel="ugc nofollow noopener" target="_blank">` and keep pages of resources `noindex` (P7b adds the
  save count that lifts it).
- Show the person's own resources with their state, and the reason for a rejection, with "Edit and send again".
- Render resource cases in the moderation queue with Approve and Reject (a reason is required).
