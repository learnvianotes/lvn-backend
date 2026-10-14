# Notes on several topics, and a group's picture (UI-e2)

- Date: 2026-10-14
- Package: `@lvn/contracts` 0.50.0
- Spec: ADR-0076 (item 10), ADR-0056
- Breaking: no

## What changes for clients

- **`SearchFilters.topicIds: [UUID!]`**: notes about any of these topics, at most 20. Exams' Notes tab uses it to list
  notes on an exam's topics: the person's own, those shared with them, and public ones.
  - With no words, they come newest first, as with the other filters.
  - It combines with the other filters. More than 20 topics is a validation error: "Filter by at most 20 topics."
- **A group's picture.**
  - Upload it with `createUploadIntent(purpose: GROUP_PICTURE)`: JPEG, PNG or WebP, up to 2 MB.
  - Set it with `updateGroup(input: { groupId, pictureFileId })`. Only the group's admins may, and only with a file of
    their own uploaded for this purpose.
  - Take it away with `removePicture: true`. A replaced or removed picture's file is deleted.
  - **`Group.pictureUrl`**: a read URL valid for 15 minutes, for anyone who sees the group. It is null without a
    picture.

## Data

- `core.Group.pictureFileId`, and the new values `FilePurpose.GROUP_PICTURE` and `FileParentType.GROUP`. Migration
  `20261029090000_group_picture`.
