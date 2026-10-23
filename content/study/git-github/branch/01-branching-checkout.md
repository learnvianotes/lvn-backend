---
id: 129d6d4c-abd4-797b-a6dd-43d4b7034f39
key: topic:git-github/branch
subject: git-github
topic: branch
title: Branching & Checkout
slug: branching-checkout
order: 1
---

Creating parallel lines of development to build features in isolation.

> [!INFO] Branch
>
> A <strong>Branch</strong> in Git is a lightweight, moveable pointer to a specific commit. By default, projects start with a default branch (typically `main`). Creating a new branch creates a separate pathway of history so you can build features or fix bugs without affecting the stable production code.

# Branching Flow Chart

Commit 1 → Commit 2 (main) → Commit 3 (main)

Commit 2 (main) ↳ checkout new branch → Feature Commit A → Feature Commit B

# Branching Commands

| Command | Purpose | Description |
| --- | --- | --- |
| <strong>git branch</strong> | List Branches | Lists all local branches in the repository. |
| <strong>git checkout \[branch\]</strong> | Navigate Branch | Switches the working directory to the target branch. |
| <strong>git checkout -b \[new-branch\]</strong> | Create &amp; Navigate | Creates a new branch and switches to it in one step. |
| <strong>git branch -d \[branch\]</strong> | Delete Branch | Deletes a branch (requires that changes are merged). |

> [!TIP] Interview tip
>
> On modern versions of Git, the checkout command can be replaced with `git switch` (e.g. `git switch -c new-branch` to create and switch), separating branch navigation from file restoration.
