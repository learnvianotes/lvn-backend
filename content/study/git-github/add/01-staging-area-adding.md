---
id: 60417b46-2be6-7382-97c8-bfea29ada62a
key: topic:git-github/add
subject: git-github
topic: add
title: Staging Area & Adding
slug: staging-area-adding
order: 1
---

Preparing changes for a commit snapshot by moving them to the staging index.

> [!INFO] Staging Area
>
> The <strong>Staging Area</strong> (or index) is a conceptual middle ground in Git. It is a file that tracks changes that are ready to be snapshotted in the next commit. This allows developers to stage only a subset of their modifications instead of committing everything at once.

# Staging Specific Files

To stage changes in a specific file, use the `git add` command:

```bash filename:Shell
git add index.html
```

# Staging All Changes

To stage all new, modified, and deleted files in the entire project folder in one command, use the dot wildcard:

```bash filename:Shell
git add .
```

# Analogy: Packing boxes for moving

> [!TIP] Analogy
>
> Imagine packing boxes to move houses. Your <strong>Working Directory</strong> is your room with items strewn about. Running \*\*`git add`\*\* is like picking up specific items and loading them into a box. The box represents the <strong>Staging Area</strong>. You haven't sealed it or shipped it yet; you are just choosing what goes in the box.
