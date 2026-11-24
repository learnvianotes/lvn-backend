---
id: 18ea7c6e-55e4-7c58-b6c4-c85c0bc5b455
key: topic:python/python-versions
subject: python
topic: python-versions
title: "What's New: Python 3.8 → 3.14"
slug: what-s-new-python-3-8-3-14
order: 1
---

The features added in each recent release — what interviewers mean by “modern Python”, and what you'll see in current codebases.

> [!NOTE] Release cadence
>
> A new Python 3.x ships every October and gets \~5 years of support. At the time of writing 3.14 is current and 3.9 and older are end-of-life. Check yours with `python3 --version` or `sys.version_info`.

# At a glance

| Version | Headline features |
| --- | --- |
| <strong>3.8</strong> (2019) | Walrus `:=`, positional-only params `/`, `f"{x=}"`, `functools.cached_property`, `math.prod` / `isqrt` |
| <strong>3.9</strong> (2020) | Dict merge `&#124;` / `&#124;=`, `str.removeprefix` / `removesuffix`, `list[int]` generics without `typing`, `zoneinfo` |
| <strong>3.10</strong> (2021) | `match` statement, `X &#124; Y` union types, `zip(strict=True)`, parenthesised `with`, much better error messages |
| <strong>3.11</strong> (2022) | 10–60% faster CPython, `ExceptionGroup` / `except*`, `add_note`, `tomllib`, `asyncio.TaskGroup`, `typing.Self`, error locations with `^^^` |
| <strong>3.12</strong> (2023) | Type-parameter syntax `def f[T]`, `type` alias statement, f-strings may reuse quotes and nest freely, `itertools.batched`, `@override` |
| <strong>3.13</strong> (2024) | New colourful REPL, experimental free-threaded build (no GIL) and JIT, `copy.replace`, removed old “dead battery” modules |
| <strong>3.14</strong> (2025) | Deferred evaluation of annotations, template strings `t"…"`, free-threading officially supported, `except A, B` without brackets, `concurrent.interpreters`, `compression.zstd` |

# 3.8 – 3.9: walrus, `/`, `=` debugging, dict union

```python filename:Python
import re

# Walrus: assign inside an expression — avoids calling twice
if (m := re.search(r"\d+", "order 66 shipped")):
    print(m.group())                         # 66

# Positional-only (/) and keyword-only (*) parameters
def clamp(x, /, lo=0, *, hi=10):
    return max(lo, min(x, hi))
print(clamp(15), clamp(-3, lo=-1))           # 10 -1

# Self-documenting f-strings
width = 42
print(f"{width=}, {width * 2 = }")           # width=42, width * 2 = 84

# 3.9: dict merge and prefix removal
defaults, user = {"theme": "light", "size": 12}, {"size": 14}
print(defaults | user)                       # {'theme': 'light', 'size': 14}
print("test_login".removeprefix("test_"))    # login
```

# 3.10: `match`, `X | Y`, strict `zip`

```python filename:Python
def http_status(code: int | None) -> str:        # union without typing.Union
    match code:
        case 200 | 201:
            return "ok"
        case 404:
            return "not found"
        case int(n) if n >= 500:
            return "server error"
        case None:
            return "no response"
        case _:
            return "other"

print(http_status(201), http_status(503), http_status(None))   # ok server error no response

try:
    list(zip([1, 2, 3], ["a", "b"], strict=True))              # catch length bugs early
except ValueError as e:
    print(e)                  # zip() argument 2 is shorter than argument 1
```

# 3.11: speed, exception groups, notes

3.11 was the first release of the <em>Faster CPython</em> project — an adaptive, specialising interpreter that made typical code 10–60% faster with no changes. It also made concurrent failures first-class.

```python filename:Python
def validate(user):
    errors = []
    if not user.get("name"):
        errors.append(ValueError("name is required"))
    if user.get("age", 0) < 0:
        errors.append(ValueError("age must be >= 0"))
    if errors:
        raise ExceptionGroup("invalid user", errors)

try:
    validate({"age": -1})
except* ValueError as eg:                           # handles every ValueError in the group
    print(len(eg.exceptions), eg.exceptions[0])     # 2 name is required

try:
    int("x")
except ValueError as e:
    e.add_note("while parsing the 'qty' column")    # extra context in the traceback
    print(e.__notes__)                              # ["while parsing the 'qty' column"]
```

```python filename:Python
import tomllib                                     # read TOML config (stdlib since 3.11)
cfg = tomllib.loads("""
[tool.app]
debug = true
workers = 4
""")
print(cfg["tool"]["app"])                          # {'debug': True, 'workers': 4}
```

# 3.12: generics syntax &amp; f-string freedom

```python filename:Python
from itertools import batched

def first[T](items: list[T]) -> T:          # no TypeVar boilerplate
    return items[0]

class Stack[T]:
    def __init__(self) -> None:
        self._items: list[T] = []
    def push(self, item: T) -> None:
        self._items.append(item)
    def pop(self) -> T:
        return self._items.pop()

type Pair[T] = tuple[T, T]                  # lazily evaluated type alias

s = Stack[int]()
s.push(first([7, 8]))
print(s.pop(), Pair.__value__)              # 7 tuple[T, T]

names = ["asha", "ravi"]
print(f"{", ".join(names)}")                # asha, ravi   ← same quotes inside, 3.12+
print(list(batched("abcdefg", 3)))          # [('a', 'b', 'c'), ('d', 'e', 'f'), ('g',)]
```

# 3.13: new REPL, free-threading, JIT

> [!NOTE] New interactive shell
>
> Colour, multi-line editing, history browsing, and `exit` / `help` work without parentheses.

> [!NOTE] Free-threaded build
>
> An optional `python3.13t` build without the GIL, so threads can run Python code on several cores. Experimental in 3.13.

> [!NOTE] Experimental JIT
>
> A copy-and-patch JIT compiler, off by default — groundwork for future speed-ups.

> [!NOTE] copy.replace()
>
> One function to make a modified copy of dataclasses, named tuples, `datetime`s and more.

```python filename:Python
import copy
from dataclasses import dataclass

@dataclass(frozen=True)
class Point:
    x: int
    y: int

p = Point(1, 2)
print(copy.replace(p, y=5))          # Point(x=1, y=5)
```

# 3.14: t-strings, lazy annotations, `except A, B`

<strong>Template strings</strong> look like f-strings but produce a `Template` object instead of a `str`, so a library can see the static text and the interpolated values separately — the safe way to build SQL, HTML or shell commands.

```python filename:Python
from string.templatelib import Template, Interpolation

def safe_html(tpl: Template) -> str:
    out = []
    for part in tpl:                              # static strings and Interpolations, in order
        if isinstance(part, Interpolation):
            out.append(str(part.value).replace("<", "&lt;").replace(">", "&gt;"))
        else:
            out.append(part)
    return "".join(out)

user = "<script>"
tpl = t"<p>Hello {user}</p>"
print(type(tpl).__name__, tpl.values)             # Template ('<script>',)
print(safe_html(tpl))                             # <p>Hello &lt;script&gt;</p>
```

```python filename:Python
# Annotations are evaluated lazily (only when asked for), so forward references just work:
def make_node() -> Node:          # Node isn't defined yet — fine in 3.14
    return Node()

class Node:
    pass

print(type(make_node()).__name__)                 # Node

# Several exception types without brackets (when there's no "as"):
try:
    int(None)
except ValueError, TypeError:
    print("bad input")                            # bad input
```

| Also in 3.14 | What it gives you |
| --- | --- |
| Free-threaded build supported | `python3.14t` is no longer experimental (still optional; the default build keeps the GIL) |
| `concurrent.interpreters` | Several isolated interpreters in one process — parallelism without separate processes |
| `compression.zstd` | Zstandard compression in the standard library |
| `finally` warnings | `return` / `break` / `continue` inside `finally` now warns — it silently swallows exceptions |
| Better errors | Suggestions for mistyped keywords (`whille` → `while`?) |

> [!WARNING] Watch out
>
> When a job description or codebase pins an older version, avoid the newer syntax: `match` needs 3.10, `except*` 3.11, `def f[T]` 3.12, t-strings 3.14. Check `requires-python` in `pyproject.toml`.

```question
Name three features added to Python in the last few versions.

---

For example: structural pattern matching (`match`, 3.10), exception groups with `except*` and the big interpreter speed-up (3.11), the `def f[T]` generics syntax (3.12), the optional no-GIL free-threaded build (3.13, supported in 3.14), and template strings `t"…"` (3.14).
```

```question
What is the difference between an f-string and a t-string?

---

An f-string is evaluated immediately into a `str`. A t-string (3.14) evaluates the expressions but returns a `Template` holding the literal parts and the values separately, so code can escape or transform the values before producing the final string — useful for preventing injection in SQL, HTML and shell commands.
```
