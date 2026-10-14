# Achievements, points and contributor levels (P8a)

- Date: 2026-10-14
- Package: `@lvn/contracts` 0.53.0
- Spec: ADR-0080
- Breaking: no

## What changes for clients

- **`User.achievements: [Achievement!]`**
  - Each entry is the highest tier reached of one kind (and subject, for contributors).
  - Fields: `kind`, `tier`, `title`, `description`, `subjectTitle` and `earnedAt`.
  - It is null for anyone but the person, unless they are an adult who shows them.
- **`User.contribution: Contribution`**
  - Fields:
    - `points`: never below 0;
    - `level`: `NEWCOMER`, `CONTRIBUTOR` from 50, or `TRUSTED` from 250;
    - `nextLevelAt`: null at the top.
  - Visible under the same rule as `achievements`.
- **`myPoints(first, after)`**: the viewer's points history, newest first. Each entry has:
  - `delta`: negative when taken back;
  - `rule`: `REACTION`, `FORK` or `RESOURCE_APPROVED`;
  - `sourceType` (`NOTE` or `RESOURCE`) and `sourceId`, to link to;
  - `subjectTitle` and `createdAt`.

  Who acted is never given.
- **`achievementSettings`**: `{ showAchievements, canShow }`. `canShow` is false under 18, and `showAchievements` is then
  always false.
- **`setAchievementsShown(input: { show })`**: answers `AchievementSettingsPayload`. Under 18, showing is a user error:
  "Achievements stay private until you are 18."
- **Notifications:**
  - New category `ACHIEVEMENT`, opening `/achievements`.
  - `data`: `kind`, `tier` and `subject` (for a subject contributor).
  - It is shown in the app only, never pushed, and isn't in the settable categories.
- **Resources:** a `TRUSTED` contributor may submit 20 resources a day instead of 10.

## What earns points

| Action by someone else | Points |
| --- | --- |
| A reaction on the person's public note | +1 |
| A fork of it | +5 |
| A resource of theirs that moderators approve | +10 |

- **Never counted:**
  - the person themselves;
  - accounts that are unverified, suspended, or less than 7 days old;
  - people blocked either way;
  - the same actor more than 5 times in 7 days towards the same person.
- **Daily cap:** reactions earn at most 50 a day.
- **Points are taken back when:**
  - the reaction is removed;
  - the note stops being public;
  - the resource leaves the catalogue.

## Achievements

| Kind | Tiers |
| --- | --- |
| `TOPICS_MASTERED` | 1, 5, 20, 50 |
| `QUIZ_MASTER` | 1, 5 |
| `EXAM_READY` | 1, 5 |
| `RHYTHM_WEEKS` | 4, 12, 26, 52 |
| `SUBJECT_CONTRIBUTOR` | 50 or 250 points from notes on a subject |

A worker job checks them a little after learning events and point changes. Each tier is awarded once.

## Data

- **Tables:** `core.PointsEntry` (append-only, unique `awardKey`) and `core.Achievement` (unique per person and key).
- **New column:** `LearnerSettings.showAchievements`.
- **Migration:** `20261101090000_engagement`, which also adds `ACHIEVEMENT` to `comms.NotificationCategory`.
- **Export:** `data/core/points.json` and `data/core/achievements.json`.
- **Erasure:** removes the person's entries and those they caused for others.
- **Worker:** a new queue, `core.engagement`.
