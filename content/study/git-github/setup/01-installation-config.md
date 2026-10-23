---
id: ae0a0f78-6787-723c-91da-85831e887eba
key: topic:git-github/setup
subject: git-github
topic: setup
title: Installation & Config
slug: installation-config
order: 1
---

Setting up the command line, verifying versions, and writing global settings.

# Verifying Installation

Before using Git, check if it is already installed in your system's path by opening a terminal and running:

```bash filename:Shell
git --version
```

> [!TIP] Output example
>
> `git version 2.39.3 (Apple Git-145)`

# Setting Up User Configuration

When you commit changes, Git stamps them with your name and email. These must be set globally using the `git config` command:

```bash filename:Shell
# Set your global username
git config --global user.name "John Doe"

# Set your global email address
git config --global user.email "johndoe@gmail.com"
```

# Verifying Configurations

To view all configured settings and trace where they are saved, run:

```bash filename:Shell
git config --list
```

> [!NOTE]
>
> Global configurations are written to a file named `.gitconfig` located in your user's primary root directory (e.g. `~/.gitconfig`). You can open and edit it directly.
