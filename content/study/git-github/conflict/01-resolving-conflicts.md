---
id: b97b4eb6-bd20-7fe2-881a-26eb30a19029
key: topic:git-github/conflict
subject: git-github
topic: conflict
title: Resolving Conflicts
slug: resolving-conflicts
order: 1
---

What happens when Git cannot merge automatically, and how to resolve it manually.

> [!INFO] Merge Conflict
>
> A <strong>Merge Conflict</strong> is an event that occurs when Git tries to merge two branches that have conflicting changes in the same line of the same file, or when a file has been deleted in one branch but modified in the other. Git cannot decide which version to keep and pauses the merge.

# How Git Flags Conflicts

When a conflict occurs, Git marks the conflict boundaries directly in the affected files using conflict markers:

```
<<<<<<< HEAD
This is my local code change on main branch.
=======
This is the incoming code change from feature branch.
>>>>>>> feature-branch
```

# Step-by-Step Conflict Resolution

1. Open the conflicted files in an editor (VS Code highlights these sections).
2. Inspect the code and manually choose which changes to keep, removing the markers (`<<<<<<<`, `=======`, `>>>>>>>`).
3. Stage the resolved files: `git add [filename]`.
4. Finalize the merge by committing: `git commit -m "Resolve merge conflict"`.
