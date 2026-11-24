---
id: b91f74d2-32af-793b-9085-eff56206e6f2
key: topic:data-science/os-module
subject: data-science
topic: os-module
title: Files & Folders with os
slug: files-folders-with-os
order: 1
---

The `os` module talks to the operating system: where you are, what's in a folder, and creating, renaming or removing directories — the plumbing behind organising datasets.

# Where am I?

```python filename:Python
import os
start = os.getcwd()              # current working directory
os.mkdir("project")              # create one folder
os.chdir("project")              # move into it
print(os.path.basename(os.getcwd()))   # project
os.chdir("..")                   # back to the parent
print(os.getcwd() == start)      # True
```

| Function | Does |
| --- | --- |
| `os.getcwd()` | Current working directory |
| `os.chdir(path)` | Change directory (`..` = parent) |
| `os.listdir(path='.')` | Names of files and folders in a directory |
| `os.mkdir(path)` | Create <strong>one</strong> folder (parent must exist) |
| `os.makedirs(path, exist_ok=True)` | Create a whole chain of folders |
| `os.rmdir(path)` | Remove an <strong>empty</strong> folder |
| `os.rename(old, new)` | Rename or move |
| `os.remove(path)` | Delete a file |
| `os.path.join(a, b)` | Build a path with the right separator |
| `os.path.exists(p)` / `isdir` / `isfile` | Check what's there |

# Nested folders

```python filename:Python
import os
os.makedirs("data/raw/2026", exist_ok=True)     # creates data, data/raw and data/raw/2026
os.rmdir("data/raw/2026")                       # only works because it's empty
os.rename("data", "dataset")
print(sorted(os.listdir("dataset")))            # ['raw']
```

> [!WARNING] Watch out
>
> `os.rmdir` refuses non-empty folders. To delete a whole tree use `shutil.rmtree(path)` — carefully: there's no recycle bin.

# Creating folders in bulk

```python filename:Python
import os
master = "KT"
n, m = 5, 5
for i in range(1, n + 1):
    for j in range(1, m + 1):
        os.makedirs(os.path.join(master, f"{master} {i}", f"{master} {i}.{j}"), exist_ok=True)

total = sum(len(dirs) for _, dirs, _ in os.walk(master)) + 1   # + the master folder itself
print(total)                                                    # 31
```

> [!NOTE] Key point
>
> That's the notebook's `n*m + n + 1` = 5×5 + 5 + 1 folders. `os.walk(top)` yields `(folder, subfolders, files)` for every folder under `top`.

# Reading many text files

```python filename:Python
import os
os.makedirs("Files", exist_ok=True)
for name, text in [("a.txt", "first"), ("b.txt", "second"), (".DS_Store", "junk")]:
    with open(os.path.join("Files", name), "w") as f:
        f.write(text)

contents = []
for name in sorted(os.listdir("Files")):
    if name.startswith("."):                    # skip hidden files like .DS_Store
        continue
    with open(os.path.join("Files", name)) as f:
        contents.append(f.read())
print(contents)                                 # ['first', 'second']
```

> [!NOTE] Tip
>
> Modern alternative: `pathlib` — `[p.read_text() for p in Path("Files").glob("*.txt")]` does the same in one line.
