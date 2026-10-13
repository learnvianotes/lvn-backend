# ADR-0075: Finding resources — the catalogue, saves, recommendations and discussion

- Status: Accepted
- Date: 2026-10-13
- Deciders: Backend, Web and Mobile agents
- Spec sections: §14.4 ("search, save, share, recommend, discuss"), §14.3 (recommendations), §15.2 (minors);
  ADR-0045 (groups), ADR-0046 (classes), ADR-0047 (comments), ADR-0055 (search), ADR-0071 (recommendations), ADR-0074

## Context

ADR-0074 brought resources in: people submit them and moderators approve them. This ADR is how people find and use
approved ones.

The research behind the Phase 7 plan bears on this:
- Students choose courses largely from peers' recommendations.
- Recommended resources often go unused.
- There is no good evidence that star ratings help learners choose.

So LearnViaNotes shows **saves** (how many people kept it) and **reasons** (why someone recommends it), and no stars.

## Decision

1. **The catalogue.**
   - `resources(filter: { type?, topicId?, query? }, sort: POPULAR | NEWEST, first, after)` lists approved resources.
     Blocked people's resources are left out.
   - Search adds a `RESOURCES` scope to the search providers (Postgres, and Typesense with a `resources` collection).
     Search reads approved resources only, and a resource leaves the index when it stops being approved.
   - POPULAR sorts by saves, then newest.
2. **Saves.**
   - `saveResource` / `unsaveResource` keep a resource in the person's Saved list (`ResourceSave`, unique per person).
   - A resource shows `saveCount` and `viewerSaved`.
   - Saving is private: nobody sees who saved what. Saves go into the data export and are erased with the account.
   - Its page is `noindex` until three people have saved it (ADR-0074, decision 8).
3. **Recommending.** `recommendResource(resourceId, to, reason?)` sends it with an optional reason (at most 280
   characters) to one of three places:
   - **A person** the recommender follows, is connected to, or shares a class or group with. They get a notification
     (category `RESOURCE`, `kind: RECOMMENDED`). Blocks, and child accounts receiving from adults they share no class
     with, are refused, as for notes (§15.2).
   - **A group** the recommender is a member of: it shows on the group's Resources tab (the UI reference's group page).
   - **A class** the recommender is staff of: it shows on the class's Resources tab.
   - Recommendations to a group or class are read by its members; the platform does not list who recommended what
     anywhere else.

   One recommendation per resource, place and sender. Reasons go through the word check (refused when flagged). Its
   sender or recipient removes a recommendation; so do a group's moderators and a class's staff in their place.
4. **Discussion.** Comments on an approved resource (`CommentTargetType.RESOURCE`), with replies and reactions, as on
   public notes (ADR-0047):
   - verified accounts comment;
   - child accounts read but do not comment in public;
   - reports go to the platform queue.
5. **Learning recommendations.** ADR-0071 gains a sixth kind, `RESOURCE`: a popular approved resource on one of the
   person's weak or exam topics, with its reason ("For your exam on Arrays: saved by 12 people"). Its score band sits
   below notes on the same topic.
6. **Pages.** The resource page is rendered on the server with schema.org data (`Book`, `Course`,
   `SoftwareApplication`, or `CreativeWork` otherwise; never offers or prices), its saves and its discussion. A guest
   sees all of it; saving, recommending and commenting need an account. Search (decision 1) finds resources in ⌘K and
   on the phone's Explore, as a Resources section beside notes, people, topics, groups and classes.

## Consequences

- Resources join search, notifications, recommendations and the group and class pages. None of these needs a new
  permission model: each reuses the place's own.
- No ratings means no rating abuse to moderate. If reasons prove too sparse to help, a later decision can add them.
