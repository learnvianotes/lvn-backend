---
id: afec108b-b4d3-7d43-9cdd-4754cfc993b2
key: topic:python/os-sys
subject: python
topic: os-sys
title: os, sys, shutil & subprocess
slug: os-sys-shutil-subprocess
order: 1
---

The modules that let a Python program talk to its environment: the interpreter (`sys`), the operating system (`os`), whole files and folders (`shutil`) and other programs (`subprocess`).

# sys — the interpreter

```python filename:Python
import sys

print(sys.version_info >= (3, 10))          # True
print(type(sys.argv).__name__)               # list   ← ["script.py", "arg1", ...]
print(isinstance(sys.path, list))            # True   ← where imports are searched
print(sys.maxsize == 2**63 - 1)              # True   ← on 64-bit builds
print(sys.getrecursionlimit())               # 1000
```

| Name | What it is |
| --- | --- |
| `sys.argv` | Command-line arguments; `argv[0]` is the script name |
| `sys.exit(code)` | Exit by raising `SystemExit` — 0 means success |
| `sys.stdin` / `stdout` / `stderr` | The standard streams (file objects) |
| `sys.path` | Module search path |
| `sys.modules` | Cache of already-imported modules |
| `sys.platform` | `'linux'`, `'darwin'`, `'win32'`, … |
| `sys.executable` | Path of the running Python interpreter |
| `sys.getsizeof(obj)` | Shallow size of an object in bytes |

# os — environment, paths, processes

```python filename:Python
import os

os.environ["APP_MODE"] = "test"                     # visible to child processes too
print(os.environ.get("APP_MODE"))                   # test
print(os.environ.get("NOT_SET_ANYWHERE", "default"))  # default
print(os.getenv("NOT_SET_ANYWHERE") is None)        # True
print(os.path.join("data", "2026", "report.csv"))   # data/2026/report.csv
print(os.path.splitext("photo.tar.gz"))             # ('photo.tar', '.gz')
print(os.sep, os.cpu_count() > 0)                   # / True
del os.environ["APP_MODE"]
```

> [!WARNING] Watch out
>
> `os.environ["KEY"]` raises `KeyError` when the variable is missing — use `os.environ.get("KEY", default)` for optional settings, and never print secrets pulled from the environment.

# Walking a directory tree

```python filename:Python
import os, tempfile

root = tempfile.mkdtemp()
for rel in ["src/app.py", "src/util.py", "docs/index.md", "README.md"]:
    path = os.path.join(root, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, "w").close()

print(sorted(os.listdir(root)))                      # ['README.md', 'docs', 'src']
with os.scandir(root) as entries:                    # faster: file type info included
    print(sorted(e.name for e in entries if e.is_dir()))   # ['docs', 'src']

found = []
for dirpath, dirnames, filenames in os.walk(root):
    found += [f for f in filenames if f.endswith(".py")]
print(sorted(found))                                 # ['app.py', 'util.py']
```

> [!NOTE] Key point
>
> For new code, `pathlib.Path` (see <em>Files, JSON &amp; pathlib</em>) is usually nicer: `Path(root).rglob("*.py")` replaces the `os.walk` loop.

# shutil — high-level file operations

```python filename:Python
import shutil, tempfile
from pathlib import Path

base = Path(tempfile.mkdtemp())
(base / "src").mkdir()
(base / "src" / "a.txt").write_text("hello")

shutil.copy(base / "src" / "a.txt", base / "b.txt")        # copy one file
shutil.copytree(base / "src", base / "backup")             # copy a whole tree
shutil.move(base / "b.txt", base / "c.txt")                # move / rename
shutil.rmtree(base / "src")                                # delete a tree — careful!
print(sorted(p.name for p in base.iterdir()))              # ['backup', 'c.txt']
print(shutil.which("definitely-not-a-real-cmd"))           # None
archive = shutil.make_archive(str(base / "bundle"), "zip", base / "backup")
print(Path(archive).name)                                  # bundle.zip
```

# subprocess — running other programs

```python filename:Python
import subprocess, sys

result = subprocess.run(
    [sys.executable, "-c", "print('hello from a child process')"],
    capture_output=True, text=True,
)
print(result.returncode, result.stdout.strip())   # 0 hello from a child process

try:
    subprocess.run([sys.executable, "-c", "raise SystemExit(2)"], check=True)
except subprocess.CalledProcessError as e:
    print("failed with", e.returncode)            # failed with 2

out = subprocess.run([sys.executable, "-c", "import sys; print(sys.stdin.read().upper())"],
                     input="piped text", capture_output=True, text=True, timeout=10)
print(out.stdout.strip())                          # PIPED TEXT
```

| Argument | Effect |
| --- | --- |
| `["cmd", "arg"]` (a list) | Runs the program directly — no shell, no quoting problems |
| `capture_output=True` | Collect stdout / stderr instead of printing them |
| `text=True` | Decode bytes to `str` |
| `check=True` | Raise `CalledProcessError` on a non-zero exit code |
| `input=…` | Send data to the child's stdin |
| `timeout=…` | Kill the child and raise `TimeoutExpired` if it takes too long |
| `cwd=…`, `env=…` | Working directory / environment for the child |

> [!WARNING] Shell injection
>
> Never build a command string from user input with `shell=True` — `f"ls {name}"` with `name = "x; rm -rf ~"` runs both commands. Pass a list of arguments instead.

```question
What is the difference between os and sys?

---

`sys` is about the Python interpreter itself — arguments, import path, standard streams, exit, recursion limit. `os` is about the operating system — environment variables, files and directories, processes, permissions.
```

```question
How do you run a shell command from Python and get its output?

---

`subprocess.run(["git", "status"], capture_output=True, text=True, check=True).stdout`. Use a list of arguments (no `shell=True`), `check=True` to fail loudly, and `timeout` for anything that might hang.
```

```question
How does sys.exit() work?

---

It raises `SystemExit`. If nothing catches it, the interpreter exits with that code (0 = success, non-zero = error; a string is printed to stderr and gives exit code 1). `finally` blocks and `with` exits still run.
```
