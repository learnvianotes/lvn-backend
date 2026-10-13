# Recommendations (P6f)

- Date: 2026-10-13
- Package: `@lvn/contracts` (minor bump at merge)
- Spec: §14.3, §17.1; ADR-0071
- Breaking: no

## What changes for clients

- **`recommendations(limit?)`** (signed in; default 10, at most 20) gives what to do next, best first:
  - `kind`: `EXAM_TOPIC`, `REVISE_TOPIC`, `CONTINUE_NOTE`, `QUIZ_ON_TOPIC` or `POPULAR_NOTE`;
  - `reason`, in words ("On your plan for Networks, in 5 days", "You were reading this on Monday, 12 October");
  - `score`, higher first, each kind in its own band;
  - for note kinds, `note` and `noteTitle` (as the viewer sees it); for topic kinds, `topicKey`, `topic` and
    `topicTitle`.
- **`dismissRecommendation(input: { kind, entityId })`** sets an item aside for 30 days: `entityId` is the note id or
  the topic key.
- A new account is computed when it first asks; after that the worker recomputes hourly for people active in the
  last 7 days.
- The data export gains `learning/recommendations.json` (the items set aside).

## Authorization

- Each person sees only their own recommendations; signed out answers `UNAUTHENTICATED`.
- Every note is read through the read rule when the list is asked for: a note that left the viewer's view (made
  private, deleted, held back, or by someone they blocked) is gone at once.

## What clients should do

- Show the reason with each item; let the viewer set one aside.
- Open a note item's note; a topic item can open the notes on that topic.
