---
id: 44be81d7-1fc5-7481-83e5-7c8f9ef30659
key: topic:git-github/lifecycle
subject: git-github
topic: lifecycle
title: Git Lifecycle & Status
slug: git-lifecycle-status
order: 1
---

Understanding the four states of files and how Git tracks modifications.

As you edit, add, or delete files in your local project workspace, Git classifies every file into one of four distinct states:

> [!INFO] 1. Untracked
>
> Files that exist in your working directory but have never been added to Git's database index. Git ignores them.

> [!INFO] 2. Modified
>
> Files already tracked by Git that have changes in your working directory, but the changes aren't staged yet.

> [!INFO] 3. Staged
>
> Files that have been flagged as ready to be committed. Staging prepares the snapshot of changes.

> [!INFO] 4. Unmodified
>
> Files that are committed in Git's database and match the local working directory exactly.

# Git State Flow Diagram

Untracked File add → Staged (Ready) commit → Unmodified

Unmodified edit file → Modified add → Staged (Ready)

# Checking Status

To inspect the status of your working directory relative to the current Git branch, use:

```bash filename:Shell
git status
```
