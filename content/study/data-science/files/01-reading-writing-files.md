---
id: 5b2bc252-4e93-75b0-a2f9-dff3da9bd5cc
key: topic:data-science/files
subject: data-science
topic: files
title: Reading & Writing Files
slug: reading-writing-files
order: 1
---

Most data science starts with a file. Python's built-in `open()` reads and writes text files — and a few string methods already give you basic text statistics.

> [!INFO]
>
> <strong>File object</strong> — what `open(path, mode)` returns: a handle with `read`, `readline`, `readlines`, `write` and `seek`. Always close it — or better, use `with`, which closes it for you.

# Modes

| Mode | Meaning | If the file exists | If it doesn't |
| --- | --- | --- | --- |
| `'r'` | Read (default) | Reads from the start | `FileNotFoundError` |
| `'w'` | Write | <strong>Erases</strong> it first | Creates it |
| `'a'` | Append | Writes at the end | Creates it |
| `'r+'` | Read and write | Starts at the beginning | `FileNotFoundError` |
| `'x'` | Create only | `FileExistsError` | Creates it |

# Writing: write vs writelines

```python filename:Python
lines = ["This is Delhi \n", "This is Paris \n", "This is London \n"]
with open("myfile.txt", "w", encoding="utf-8") as f:
    f.write("Hello \n")          # one string
    f.writelines(lines)          # an iterable of strings (no newlines are added for you)

with open("myfile.txt", encoding="utf-8") as f:
    print(f.read())
```

```filename:Output
Hello
This is Delhi
This is Paris
This is London
```

# Reading: read, readline, readlines, seek

```python filename:Python
with open("myfile.txt", encoding="utf-8") as f:
    print(repr(f.read(9)))       # 'Hello \nTh'   ← 9 characters, across lines
    f.seek(0)                    # jump back to the start
    print(repr(f.readline()))    # 'Hello \n'     ← up to and including the newline
    f.seek(0)
    print(f.readlines())         # ['Hello \n', 'This is Delhi \n', 'This is Paris \n', 'This is London \n']
```

| Method | Returns |
| --- | --- |
| `f.read()` / `f.read(n)` | The whole file / the next `n` characters, as one string |
| `f.readline()` | The next line, including its `\n` |
| `f.readlines()` | A list of all remaining lines |
| `for line in f:` | Lines one at a time — memory-friendly for big files |
| `f.seek(n)` | Moves the position to byte `n` (0 = start) |

# Append vs write

```python filename:Python
with open("notes.txt", "w") as f:
    f.write("Today \n")
with open("notes.txt", "a") as f:        # append keeps what was there
    f.write("Tomorrow \n")
with open("notes.txt") as f:
    print(f.readlines())                  # ['Today \n', 'Tomorrow \n']

with open("notes.txt", "w") as f:        # write erases it first
    f.write("Only this \n")
with open("notes.txt") as f:
    print(f.readlines())                  # ['Only this \n']
```

> [!WARNING] Watch out
>
> Opening with `'w'` silently wipes the file. Use `'a'` to add to it, or `'x'` to refuse overwriting.

# Quick text statistics

```python filename:Python
text = """Data science turns raw data into insight. It mixes statistics and programming.

Python is the most popular language for it."""

paragraphs = [p for p in text.split("\n\n") if p.strip()]
sentences = [s for s in text.replace("\n", " ").split(".") if s.strip()]
words = text.split()                     # split() with no argument handles any whitespace

print(len(paragraphs), len(sentences), len(words))   # 2 3 20
```

> [!NOTE] Key point
>
> `split(" ")` counts empty strings between double spaces and keeps newlines inside words — `split()` with no argument is almost always what you want for words.

# Cleaning unwanted characters

```python filename:Python
raw = "Hello!! World@ #2026 [7] [12]"
for ref in [f"[{i}]" for i in range(1, 20)]:     # remove citation markers like [7]
    raw = raw.replace(ref, "")
for ch in "!@#":                                 # remove unwanted symbols
    raw = raw.replace(ch, "")
print(" ".join(raw.split()))                     # Hello World 2026
```

> [!NOTE] Key point
>
> For anything more than a few characters, a regular expression is cleaner: `re.sub(r"\[\d+\]|[!@#]", "", raw)` — see <em>Regular Expressions</em>.
