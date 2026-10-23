---
id: dabd9d03-bcfc-7e3d-a7ca-b41b01114a26
key: topic:git-github/merge
subject: git-github
topic: merge
title: Merging & PRs
slug: merging-prs
order: 1
---

Integrating isolated branches and requesting code reviews on GitHub.

# Comparing Changes

To view the difference in code content between two branches, commits, or staging areas before merging, use:

```bash filename:Shell
git diff feature-branch main
```

# Merging Locally

To integrate changes from a feature branch into your active branch (e.g., merging `feature-login` into `main`), run:

```bash filename:Shell
# 1. Switch to the recipient branch (main)
git checkout main

# 2. Merge changes from the target branch
git merge feature-login
```

# Pull Requests (PRs)

> [!INFO] Pull Request
>
> A <strong>Pull Request (PR)</strong> is a collaboration feature on GitHub that notifies team members that you've pushed changes to a branch and would like them to review, comment on, and merge those changes into the main repository.

# Fast-Forward vs Three-Way Merge

> [!INFO] Fast-Forward Merge
>
> If the recipient branch hasn't diverged (no new commits were made to `main` while you worked on the feature), Git simply moves the branch pointer forward. No merge commit is created.

> [!INFO] Three-Way Merge (3-Way)
>
> If both branches have diverged (new commits were made on both branches), Git performs a three-way merge using a common ancestor and creates a new, dedicated <strong>merge commit</strong>.
