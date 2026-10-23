---
id: 109b2388-b2f0-7e95-9522-cefa4599a013
key: topic:git-github/reset
subject: git-github
topic: reset
title: Undoing Changes
slug: undoing-changes
order: 1
---

Resetting states, restoring working directories, and reverting history.

# Case 1: Staged changes (Unstaging files)

If you ran `git add` but decided you aren't ready to commit those files yet, unstage them using:

```bash filename:Shell
# Unstage a specific file
git reset index.html

# Unstage all staged changes
git reset
```

# Case 2: Committed changes (Undoing commits)

If you committed changes locally but want to pull that commit back, you can reset. Git defines three modes of resetting, referencing `HEAD~1` (one commit back from active branch point):

| Reset Mode | Impact on Working Directory | Impact on Staging Area | Log History |
| --- | --- | --- | --- |
| <strong>Soft (</strong><strong>`--soft`</strong><strong>)</strong> | Keeps all modified files intact | Keeps all staged changes intact | Moves commit pointer back |
| <strong>Mixed (Default)</strong> | Keeps all modified files intact | Unstages all changes | Moves commit pointer back |
| <strong>Hard (</strong><strong>`--hard`</strong><strong>)</strong> | Deletes all working changes | Deletes all staged changes | Moves commit pointer back |

# Running a Hard Reset

```bash filename:Shell
# WARNING: This destroys all uncommitted local modifications permanently
git reset --hard HEAD~1

# Reset to a specific commit hash in history
git reset --hard a1b2c3d
```

> [!TIP] Warning
>
> Never run a hard reset on commits that have already been pushed to a shared remote repository. It rewrites log history, causing severe sync issues for other team members.
