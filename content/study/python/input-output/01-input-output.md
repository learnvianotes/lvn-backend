---
id: b40b91a7-376a-7641-89de-b846f26f7423
key: topic:python/input-output
subject: python
topic: input-output
title: Input & Output
slug: input-output
order: 1
---

Talking to the console: everything `print()` can do, reading typed input with `input()`, and the fast `sys.stdin` patterns used in coding rounds.

# `print()` in full

Signature: `print(*objects, sep=' ', end='\n', file=sys.stdout, flush=False)`. Each object is converted with `str()`, joined by `sep`, followed by `end`.

```python filename:Python
print("a", "b", "c")                      # a b c
print("a", "b", "c", sep="-")             # a-b-c
print(2026, 9, 29, sep="/")               # 2026/9/29
print("Loading", end=""); print("...done")   # Loading...done
print(*[1, 2, 3], sep=", ")               # 1, 2, 3
print("tab\tseparated", repr("hi"))      # tab	separated 'hi'
```

| Parameter | Default | Use it for |
| --- | --- | --- |
| `sep` | `' '` | What goes <em>between</em> the objects |
| `end` | `'\n'` | What goes <em>after</em> the last object — `end=''` keeps the cursor on the line |
| `file` | `sys.stdout` | Any object with `.write()`: `sys.stderr`, an open file, an `io.StringIO` |
| `flush` | `False` | Force the output out immediately (progress bars, logs piped to another program) |

```python filename:Python
import io
buf = io.StringIO()
# file= sends the text to buf instead of the screen:
print("to a buffer", 42, file=buf)
print(repr(buf.getvalue()))           # 'to a buffer 42\n'
result = print("shown", end=" ")
print(result)                         # shown None
```

> [!NOTE] Key point
>
> `print` returns `None` — it only has a side effect. Errors and diagnostics belong on `sys.stderr` (`print(msg, file=sys.stderr)`) so they don't mix with the program's real output.

# `input()` — reading a line

`input(prompt)` shows the prompt, waits for the user to press Enter and returns the line <strong>as a </strong><strong>`str`</strong><strong>, without the newline</strong>. Convert it yourself.

```filename:greet.py
name = input("Your name? ")
age = int(input("Your age? "))
print(f"Hi {name}, next year you'll be {age + 1}")

$ python3 greet.py
Your name? Asha
Your age? 24
Hi Asha, next year you'll be 25
```

Below, `sys.stdin` is swapped for an in-memory stream so the example runs without a keyboard — exactly how tests feed input to a program.

```python filename:Python
import io, sys
fake = io.StringIO("Asha\n3 1 4 1 5\n42\n")
old, sys.stdin = sys.stdin, fake          # pretend the user typed three lines
try:
    name = input()                        # 'Asha' — always a str
    nums = list(map(int, input().split()))
    n = int(input())
    try:
        input()                           # nothing left to read
    except EOFError:
        eof = True
finally:
    sys.stdin = old                       # always restore the real stdin
print(name, nums, n + 1, eof)             # Asha [3, 1, 4, 1, 5] 43 True
```

> [!WARNING] Watch out
>
> `input()` never returns a number: `input() + 1` is a `TypeError`. And at end of input (Ctrl-D, or a judge's file running out) it raises `EOFError`.

# Parsing patterns

| Input shape | Code |
| --- | --- |
| One integer | `n = int(input())` |
| Two integers on a line | `a, b = map(int, input().split())` |
| A list of integers | `nums = list(map(int, input().split()))` |
| `n` lines of text | `lines = [input() for _ in range(n)]` |
| A grid of characters | `grid = [list(input()) for _ in range(rows)]` |
| Comma-separated | `parts = input().split(',')` |
| Everything at once | `tokens = sys.stdin.read().split()` |

# Fast input for coding rounds

`input()` is slow for 10⁵+ lines. `sys.stdin.readline` is much faster, but it <strong>keeps the trailing </strong><strong>`\n`</strong> — strip it (or let `int()` / `split()` ignore it).

```python filename:Python
import io
data = io.StringIO("3\n10 20\n30 40\n50 60\n")
readline = data.readline                  # real code: import sys; readline = sys.stdin.readline
n = int(readline())                       # int() ignores the trailing newline
pairs = [tuple(map(int, readline().split())) for _ in range(n)]
print(pairs)                              # [(10, 20), (30, 40), (50, 60)]
print(repr(io.StringIO("hi\n").readline()))   # 'hi\n'

tokens = iter(io.StringIO("2\n5 7\n").read().split())   # read everything, walk token by token
count = int(next(tokens))
print(sum(int(next(tokens)) for _ in range(count)))    # 12
```

# Fast output

```python filename:Python
import sys
written = sys.stdout.write("written ")    # no automatic newline; returns chars written
print(written)                            # written 8

results = [3, 1, 4]
print(" ".join(map(str, results)))        # 3 1 4
```

> [!TIP] Do
>
> Collect answers in a list and print once with `'\n'.join(map(str, answers))`.

> [!DANGER] Avoid
>
> Calling `print` a million times in a loop — each call has overhead (and may flush).

# Pretty-printing nested data

```python filename:Python
from pprint import pprint
data = {"name": "Asha", "skills": ["python", "sql", "dsa"],
        "address": {"city": "Pune", "pin": 411001}}
pprint(data, width=40)
```

```text filename:Output
{'address': {'city': 'Pune',
             'pin': 411001},
 'name': 'Asha',
 'skills': ['python', 'sql', 'dsa']}
```

> [!NOTE] Key point
>
> `pprint` wraps long structures and sorts dict keys (pass `sort_dicts=False` to keep insertion order). `pprint.pformat` returns the text instead of printing it.

# Formatting output

```python filename:Python
price, qty, item = 49.5, 3, "pen"
print(f"{item:<6}|{qty:>3}|{price * qty:8.2f}|")   # pen   |  3|  148.50|
print(f"{0.4567:.1%}  {1234567:,}  {7:03d}")       # 45.7%  1,234,567  007
```

f-strings and the format-spec mini-language (`:<6`, `.2f`, `,`, `%`) are covered in depth in <strong>String Formatting</strong> under <em>Strings &amp; Numbers</em>.

```question
What type does input() return?

---

Always `str` (without the trailing newline), even if the user types digits. Convert explicitly: `int(input())`, `float(input())`, or `map(int, input().split())` for several numbers.
```

```question
Why use sys.stdin.readline instead of input()?

---

It avoids `input()`'s per-call overhead (prompt handling, newline stripping), which matters with hundreds of thousands of lines. Remember it keeps the `\n`, and returns `''` (not `EOFError`) at end of input.
```

```question
What is the difference between print and sys.stdout.write?

---

`print` accepts any objects, converts them with `str()`, adds separators and a newline, and returns `None`. `sys.stdout.write` accepts one string, adds nothing, and returns the number of characters written.
```
