---
id: 4e644b9a-fa01-7ed4-8648-d5413f83c143
key: topic:git-github/commit
subject: git-github
topic: commit
title: Committing Changes
slug: committing-changes
order: 1
---

Creating a permanent, signed snapshot of staged files in the Git database.

> [!INFO] Commit
>
> A <strong>Commit</strong> is a permanent snapshot of your staged changes saved directly to the local repository history. Each commit has a unique alphanumeric SHA-1 hash identifier, an author stamp, and a descriptive commit message.

# Running a Commit

To commit your staged changes, use the `-m` flag to supply a short, descriptive message in the terminal:

```bash filename:Shell
git commit -m "Add responsive mobile navigation layout"
```

# Analogy: Saving a Game State

> [!TIP] Analogy
>
> A commit is like creating a <strong>Save State</strong> (checkpoint) in a video game. If you fail a boss fight or make a mistake, you can reload that exact save file to restore your character's state. The commits form a linear history of save states.

# Common Commit Mistakes

> [!DANGER] Mistake
>
> - Writing generic messages like "Fixed stuff" or "Update".
> - Committing massive, unrelated changes at once, making bugs hard to isolate.

> [!TIP] Correct Pattern
>
> - Use imperative mood (e.g. "Fix CSS bug" instead of "Fixed CSS bug").
> - Commit early and commit often, grouping changes atomically.
