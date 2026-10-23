---
id: bb271661-abeb-7d98-ad42-a6f1ae74deda
key: topic:git-github/pull
subject: git-github
topic: pull
title: Pulling & Syncing
slug: pulling-syncing
order: 1
---

Updating your local repository to match remote updates on GitHub.

> [!INFO] Pull
>
> <strong>Pulling</strong> fetches the latest commits from the remote repository and immediately integrates (merges) them into your active local branch.

# Running a Pull

```bash filename:Shell
# Fetch and merge remote changes
git pull origin main
```

# Git Fetch vs Git Pull

It is critical to distinguish between `fetch` and `pull`:

git fetch Downloads remote changes to database only Safe (doesn't modify working files)

git pull Downloads remote changes + immediately merges Active (can cause merge conflicts)

> [!NOTE]
>
> Under the hood, running `git pull` is exactly equivalent to running `git fetch` followed immediately by `git merge`.
