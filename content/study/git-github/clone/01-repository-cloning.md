---
id: 25b43d82-6a27-748c-9d04-e17930b58a6f
key: topic:git-github/clone
subject: git-github
topic: clone
title: Repository & Cloning
slug: repository-cloning
order: 1
---

Creating a local folder copy of remote GitHub repositories.

> [!INFO] Repository (Repo)
>
> A <strong>Repository</strong> is a database folder containing all your project files and their complete version history logs (the metadata is stored inside a hidden folder called `.git`).

# Cloning a Remote Repository

To duplicate an existing remote repository hosted on GitHub down to your local machine, use the `git clone` command along with the HTTPS or SSH link:

```bash filename:Shell
git clone https://github.com/username/my-project.git
```

This command automatically does the following:

- Creates a new folder matching the repository name.
- Initializes a local Git database inside it.
- Fetches all the history branches and commits.
- Checks out the default branch (usually `main` or `master`).
- Configures the remote source address as `origin`.

# Basic Terminal Operations

| Command | Purpose | Description |
| --- | --- | --- |
| <strong>cd \[dir\]</strong> | Change Directory | Navigates into the specified folder. |
| <strong>ls</strong> | List Files | Lists all visible files in the directory. |
| <strong>ls -a</strong> | List All | Lists all files, including hidden files (like the `.git` folder). |
