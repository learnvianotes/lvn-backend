---
id: 941a9990-368f-7bb7-b5df-2d5746dfbcf8
key: topic:git-github/intro
subject: git-github
topic: intro
title: Version Control Systems
slug: version-control-systems
order: 1
---

Why tracking source history is critical for clean, collaborative software development.

> [!INFO] Definition
>
> A <strong>Version Control System (VCS)</strong> is a software utility that tracks changes made to files (usually source code) over time. It allows developers to review modifications, revert files to previous states, compare revisions, and collaborate without overwriting each other's work.

> [!INFO] Track History
>
> Maintains a timeline (log) of every addition, modification, and deletion. You can trace who changed what line of code, when, and why.

> [!INFO] Collaborate
>
> Allows multiple developers to work simultaneously on the same project codebase without blocking one another.

# Why VCS Exists

Without a VCS, developers are forced to manually copy folders (e.g. `project_v1_final_v2`), coordinate changes via chat, and manually resolve conflicting modifications. A VCS automates this tracking, providing a safety net to undo mistakes instantly.

# Distributed vs Centralized VCS

Modern version control is divided into two primary architectures:

| Feature | Centralized VCS (e.g. SVN) | Distributed VCS (e.g. Git) |
| --- | --- | --- |
| <strong>History Location</strong> | Single central server only | Every developer has a full copy of the history locally |
| <strong>Offline Operations</strong> | Cannot commit, view log, or diff offline | Can perform almost all operations offline |
| <strong>Speed</strong> | Slower (requires remote network connections) | Near-instant (local filesystem reads/writes) |
| <strong>Resilience</strong> | Single point of failure (server crash = loss of history) | Highly resilient (every local copy is a backup) |

# Analogy: The Document Track Changes

> [!TIP] Analogy
>
> A VCS is like the <strong>"Version History"</strong> panel in Google Docs. Instead of saving a new document copy every time you write a paragraph, the system records only the incremental edits (diffs). If a paragraph gets accidentally deleted, you can scroll back in time and restore that exact block.
