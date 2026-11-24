---
id: bad6ba39-d638-768c-9688-930a84716f5c
key: topic:git-github/fork
subject: git-github
topic: fork
title: Forking Repositories
slug: forking-repositories
order: 1
---

Creating independent copies of remote projects on your GitHub profile.

> [!INFO] Fork
>
> A <strong>Fork</strong> is a new remote repository that shares code and visibility settings with the original upstream project, but is copied entirely onto your personal GitHub account profile. It allows you to freely experiment and push changes without affecting the parent project.

# Fork vs Clone

| Dimension | Fork | Clone |
| --- | --- | --- |
| <strong>Location</strong> | Created on GitHub's remote server | Created on your local computer's drive |
| <strong>Relationship</strong> | Tethered to the original project (supports PRs) | Direct downstream mirror copy of a target remote |
| <strong>Access</strong> | No write access required on the original project | Requires write permissions to push back to remote |

> [!TIP] Use Case
>
> Forking is the primary workflow for <strong>Open-Source Contributions</strong>. You fork a public library, clone your fork locally, make improvements, commit and push to your fork, and then submit a <strong>Pull Request</strong> to merge those changes back into the original creator's repository.
