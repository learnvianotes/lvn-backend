# Finding resources (P7b)

- Date: 2026-10-14
- Package: `@lvn/contracts` 0.47.0
- Spec: §14.4, §14.3; ADR-0075
- Breaking: no

## What changes for clients

- **`resources(filter: { type, topicId, query }, sort: POPULAR | NEWEST, first, after)`** lists approved resources.
  - Guests can use it.
  - Blocked people's resources are left out.
  - POPULAR means most saved first.
- **Saves:**
  - `saveResource` / `unsaveResource` (`ResourceIdInput`) answer the resource.
  - `savedResources(first, after)` is the viewer's Saved list.
  - `Resource.saveCount` and `Resource.viewerSaved`.
  - `Resource.indexable` is true once approved and saved by three people. Pages are `noindex` until then.
- **Recommendations:**
  - `recommendResource(input: { resourceId, to: { userId | groupId | classroomId }, reason? })`.
  - The reason is at most 280 characters and goes through the word check. 30 recommendations an hour.
  - Who may receive one:
    - a **person** the sender follows, is connected to, or shares a group or class with (a child account only from
      someone in one of their classes);
    - a **group** the sender may post in;
    - a **class** the sender teaches.
  - `resourceRecommendations(to, first, after)` lists recommendations to a group or class the viewer is in, or to
    the viewer (`to: { userId: <viewer> }`).
  - `removeResourceRecommendation(input: { id })` is for its sender or recipient, the group's moderators, or the class's
    staff.
  - A recommendation to a person sends a `RESOURCE` notification with `data: { kind: RECOMMENDED }` and its sender as
    the actor.
- **Discussion:** `CommentTargetType.RESOURCE`. `discussion(target: { type: RESOURCE, id })` and `addComment` work on
  approved resources, as on public notes:
  - verified accounts comment; child accounts and unverified accounts read;
  - the submitter is told (`COMMENT`, path `/resources/<id>`);
  - `reactions` on a resource discussion are empty (resources are saved, not liked).
- **Search:** `SearchScope.RESOURCES` and `SearchResults.resources`. Approved resources match on title, author, topics
  and description, on both providers.
- **Recommendations (ADR-0071):** a new `RecommendationKind.RESOURCE`, with `Recommendation.resource`. These are the
  most saved resources on the viewer's exam and weak topics.

## What clients should do

- Add a Resources catalogue (filters, search, sort), a Saved list, a Save button with the count, a "Recommend"
  sheet (person, group or class, with a reason) and the resource discussion.
- Add a Resources tab to groups and classes (`resourceRecommendations`).
- Show resources in ⌘K / Explore results and in Recommended.
