---
id: 8081fc74-7e11-78f7-8733-12aebd2c69c9
key: topic:git-github/remote
subject: git-github
topic: remote
title: Initializing & Remotes
slug: initializing-remotes
order: 1
---

Creating a repository from scratch locally and binding it to a remote GitHub URL.

# Creating a New Local Repository

If you have an existing project folder locally that isn't under version control, you can initialize a Git database inside it using:

```bash filename:Shell
# Initialize local repository
git init
```

This creates a hidden folder named `.git` in the root directory.

# Binding a Remote Source (GitHub)

To sync this local repository with a remote repository you created on GitHub, add a remote binding address named `origin`:

```bash filename:Shell
# Bind local repository to remote GitHub URL
git remote add origin https://github.com/username/my-repo.git

# Verify connected remote URLs
git remote -v
```

# Renaming the Default Branch

By default, `git init` historically names the default branch `master`. To rename it to the modern standard `main`, use:

```bash filename:Shell
git branch -M main
```
