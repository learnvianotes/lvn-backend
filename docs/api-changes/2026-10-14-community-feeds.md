# Community's For You and Trending (UI-d2)

- Date: 2026-10-14
- Package: `@lvn/contracts` 0.49.0
- Spec: ADR-0076 (item 8), ADR-0026, ADR-0047
- Breaking: no

## What changes for clients

- **`forYouFeed(first, after)`** lists public notes (notes, blogs, posts and projects) on the viewer's topics, newest
  published first.
  - The topics are those the person chose, their upcoming exams' topics and, for an adult, what they read in the last
    two weeks. A child account's feed follows only chosen topics and exams.
  - Each edge has the `topic` of the viewer's it is on. `basedOn` lists the topics used and is empty when there are
    none, so clients can lead the person to choose some.
  - Their own notes and those of anyone blocked either way are left out.
- **`trendingFeed(first, after)`** lists the public notes most reacted to and commented on in the last 7 days.
  - Each person counts once per note, whatever they did, and the note's owner never counts.
  - Ties go to the most recent activity. At most 100 notes; pages go by position, so a client should drop a note it
    has already shown.
- Both return `CommunityConnection { edges { cursor node: Note topic: Topic } pageInfo basedOn }`. `node` is null
  for a note the viewer can no longer read.
- **`Note.previewPicture: MediaFile`**: the note's first picture as the viewer sees it (draft for editors, published
  version for readers); null without one.
- **`StudentProfile.interests: [Topic]`** (the viewer only): the topics chosen, resolved. They are set as before with
  `updateProfile(input: { interestTopicIds })`.

## Data

- Indexes `Reaction(targetType, createdAt)` and `Comment(targetType, createdAt)`; migration
  `20261028090000_community_feeds`. No new tables.
