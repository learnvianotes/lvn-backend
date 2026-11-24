---
id: 18ac625f-6135-7341-a3af-cdd9ad62c2ee
key: topic:git-github/push
subject: git-github
topic: push
title: Pushing Code
slug: pushing-code
order: 1
---

Uploading committed snapshots from your local machine to the remote repository.

> [!INFO] Push
>
> <strong>Pushing</strong> is the process of uploading your local repository commit snapshots to a remote repository server like GitHub, making your local history available to collaborators.

# Setting Up Upstream &amp; Pushing

The first time you push code from a new local branch, you must bind it to the remote branch using the upstream flag (`-u`):

```bash filename:Shell
# Push and set upstream destination
git push -u origin main
```

For subsequent pushes, once the upstream is configured, you can run the simplified command:

```bash filename:Shell
git push
```

# Analogy: Publishing a Draft

> [!TIP] Analogy
>
> Writing code is like writing a blog post. Saving drafts is like committing locally on your laptop (private). <strong>Pushing</strong> is like hitting "Publish" or syncing it to your cloud drive, making it public to the internet so others can read and edit it.
