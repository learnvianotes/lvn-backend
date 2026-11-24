---
id: 648e9994-574a-7292-8d70-3bc2d0ccf59d
key: topic:python/files-io
subject: python
topic: files-io
title: Files & pathlib
slug: files-pathlib
order: 1
---

Reading and writing files safely with `with`, text vs binary modes, seeking and chunked reads, `pathlib` for paths, and `shutil` / `tempfile` for everything around them.

# Text files

```python filename:Python
import os, tempfile
path = os.path.join(tempfile.mkdtemp(), "notes.txt")

with open(path, "w", encoding="utf-8") as f:     # "w" truncates, "a" appends
    f.write("line one\nline two\n")

with open(path, encoding="utf-8") as f:           # default mode "r"
    for line in f:                                # streams line by line
        print(line.rstrip())
```

```text filename:Output
line one
line two
```

| Mode | Meaning |
| --- | --- |
| `'r'` | Read (default) — error if missing |
| `'w'` | Write — creates or <strong>truncates</strong> |
| `'a'` | Append to the end |
| `'x'` | Create — error if it exists |
| `'b'` | Binary, e.g. `'rb'` for images |
| `'+'` | Read and write |

> [!WARNING] Watch out
>
> Always pass `encoding="utf-8"` for text — the platform default differs between Windows and macOS/Linux.

# Reading methods

```python filename:Python
import io
f = io.StringIO("alpha\nbeta\ngamma\n")    # behaves like an open text file

print(f.readline())            # alpha
print(f.read(3))               # bet
print(f.readlines())           # ['a\n', 'gamma\n']
print(repr(f.read()))          # ''   ← at the end, read() returns an empty string
```

```text filename:Output
alpha

bet
['a\n', 'gamma\n']
''
```

| Call | Returns | Memory |
| --- | --- | --- |
| `for line in f` | One line at a time | O(1) — best for big files |
| `f.read()` | The whole file as one string | Whole file |
| `f.read(n)` | Up to `n` characters (bytes in binary mode) | O(n) |
| `f.readline()` | Next line, including `\n` | One line |
| `f.readlines()` | List of all lines | Whole file |
| `f.write(s)` / `f.writelines(lines)` | Write text (no newline added) | — |

# Binary files, chunks &amp; seek/tell

```python filename:Python
import os, tempfile
path = os.path.join(tempfile.mkdtemp(), "data.bin")

with open(path, "wb") as f:
    f.write(bytes(range(10)))

chunks = []
with open(path, "rb") as f:
    while chunk := f.read(4):             # fixed-size chunks: constant memory
        chunks.append(chunk)
print(chunks)                             # [b'\x00\x01\x02\x03', b'\x04\x05\x06\x07', b'\x08\t']

with open(path, "rb") as f:
    f.seek(6)                             # jump to byte offset 6
    print(f.tell(), f.read(2))            # 6 b'\x06\x07'
    f.seek(-1, os.SEEK_END)               # 1 byte before the end
    print(f.read())                       # b'\t'
```

> [!NOTE] Key point
>
> In text mode, `seek` only accepts offsets previously returned by `tell()` (or 0) because characters can be several bytes. Use binary mode for random access. Hashing a big file? Read it in chunks and call `h.update(chunk)`.

# Temporary files &amp; directories

```python filename:Python
import os, tempfile

with tempfile.TemporaryDirectory() as d:          # deleted with everything inside
    path = os.path.join(d, "scratch.txt")
    with open(path, "w", encoding="utf-8") as f:
        f.write("draft")
    print(os.path.exists(path))                   # True
print(os.path.exists(d))                          # False

with tempfile.NamedTemporaryFile("w+", suffix=".txt", encoding="utf-8") as tmp:
    tmp.write("scratch")
    tmp.seek(0)                                   # rewind before reading back
    print(tmp.read(), tmp.name.endswith(".txt"))  # scratch True
```

# pathlib

```python filename:Python
from pathlib import Path
import tempfile

root = Path(tempfile.mkdtemp())
report = root / "reports" / "2026.txt"      # "/" joins paths
report.parent.mkdir(parents=True, exist_ok=True)
report.write_text("ok", encoding="utf-8")

print(report.name, report.stem, report.suffix)   # 2026.txt 2026 .txt
print(report.read_text(encoding="utf-8"))         # ok
print([p.name for p in root.rglob("*.txt")])      # ['2026.txt']
print(report.relative_to(root).as_posix())        # reports/2026.txt
print(report.with_suffix(".md").name)             # 2026.md
```

| Task | `os` / `os.path` | `pathlib` |
| --- | --- | --- |
| Join | `os.path.join(a, b)` | `Path(a) / b` |
| File name / extension | `os.path.basename(p)`, `os.path.splitext(p)` | `p.name`, `p.stem`, `p.suffix` |
| Parent folder | `os.path.dirname(p)` | `p.parent` |
| Exists / is file | `os.path.exists(p)`, `os.path.isfile(p)` | `p.exists()`, `p.is_file()` |
| Make folders | `os.makedirs(p, exist_ok=True)` | `p.mkdir(parents=True, exist_ok=True)` |
| List / pattern match | `os.listdir(p)`, `glob.glob('*.py')` | `p.iterdir()`, `p.glob('*.py')`, `p.rglob('*.py')` |
| Read whole file | `open(p).read()` | `p.read_text(encoding=…)`, `p.read_bytes()` |
| Absolute path | `os.path.abspath(p)` | `p.resolve()` |

> [!NOTE] Key point
>
> Prefer `pathlib` in new code — paths become objects with methods instead of strings passed to functions. Every standard-library function that takes a path also accepts a `Path`.

# glob &amp; shutil: finding, copying, moving

```python filename:Python
import glob, os, shutil, tempfile
from pathlib import Path

with tempfile.TemporaryDirectory() as d:
    root = Path(d)
    for name in ["a.py", "b.py", "notes.md"]:
        (root / name).write_text(name, encoding="utf-8")

    print(sorted(p.name for p in root.glob("*.py")))                          # ['a.py', 'b.py']
    print(sorted(os.path.basename(p) for p in glob.glob(str(root / "*.md"))))  # ['notes.md']

    backup = root / "backup"
    backup.mkdir()
    shutil.copy(root / "a.py", backup)                  # copy into a folder
    shutil.move(root / "notes.md", backup / "README.md")  # move + rename
    print(sorted(p.name for p in backup.iterdir()))     # ['README.md', 'a.py']

    shutil.rmtree(backup)                               # delete a whole tree
    print(backup.exists())                              # False
```

# Safe writes

```python filename:Python
import os, tempfile
from pathlib import Path

def atomic_write(path: Path, text: str) -> None:
    """Readers see either the old file or the new one — never half a file."""
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(text, encoding="utf-8")
    os.replace(tmp, path)            # atomic rename on the same filesystem

target = Path(tempfile.mkdtemp()) / "settings.json"
atomic_write(target, '{"theme": "dark"}')
print(target.read_text(encoding="utf-8"))   # {"theme": "dark"}
```

> [!TIP] Do
>
> Use `with open(...)`, pass `encoding="utf-8"`, stream big files line by line or in chunks, and use `tempfile` for scratch files.

> [!DANGER] Avoid
>
> Calling `open()` without closing it, `read()` on multi-GB files, or building paths with string `+` (`folder + "/" + name`).

Structured formats — JSON, CSV, pickle, TOML — are covered in <strong>Serialization: JSON, CSV &amp; pickle</strong>.

```question
How would you process a 10 GB log file?

---

Stream it: `with open(path, encoding='utf-8') as f: for line in f:` keeps one line in memory at a time. For binary data read fixed-size chunks with `f.read(1 << 20)`. Combine with generators to build a lazy pipeline.
```
