---
id: 3624fa47-bf75-74b2-98a1-683cb5cd8f27
key: topic:python/context-managers
subject: python
topic: context-managers
title: Context Managers & contextlib
slug: context-managers-contextlib
order: 1
---

A context manager pairs setup with guaranteed teardown. `with` runs the teardown however the block exits — normally, by `return`, or by an exception.

# The protocol

```python filename:Python
class Resource:
    def __init__(self, name):
        self.name = name
    def __enter__(self):
        print(f"open {self.name}")
        return self                          # bound to the "as" target
    def __exit__(self, exc_type, exc, tb):
        print(f"close {self.name} (error: {exc_type.__name__ if exc_type else None})")
        return False                         # False/None → let the exception propagate

with Resource("db") as r:
    print("using", r.name)

try:
    with Resource("file"):
        raise KeyError("boom")
except KeyError:
    print("caught outside")
```

```text filename:Output
open db
using db
close db (error: None)
open file
close file (error: KeyError)
caught outside
```

1. <strong>Evaluate</strong>

   The expression after `with` produces the manager.

2. <strong>Enter</strong>

   `__enter__()` runs; its return value is bound to the `as` name.

3. <strong>Body</strong>

   The indented block runs.

4. <strong>Exit</strong>

   `__exit__(exc_type, exc, tb)` always runs — all three are `None` if there was no exception.

5. <strong>Suppress?</strong>

   If `__exit__` returns a truthy value, the exception is swallowed. Almost always return `False`.

# A reusable class-based manager

```python filename:Python
import time

class Timer:
    def __enter__(self):
        self.start = time.perf_counter()
        return self
    def __exit__(self, *exc):
        self.elapsed = time.perf_counter() - self.start
        return False

with Timer() as t:
    sum(range(100_000))
print(t.elapsed > 0)          # True
```

# `@contextmanager`: a generator becomes a manager

Everything before `yield` is `__enter__`, the yielded value is the `as` target, everything after is `__exit__`. Wrap the `yield` in `try`/`finally` or the cleanup is skipped when the body raises.

```python filename:Python
from contextlib import contextmanager

@contextmanager
def temporary_setting(config, key, value):
    old = config[key]
    config[key] = value
    try:
        yield config
    finally:
        config[key] = old             # restored even if the body raises

cfg = {"debug": False}
with temporary_setting(cfg, "debug", True):
    print(cfg["debug"])               # True
print(cfg["debug"])                   # False
```

# contextlib helpers

```python filename:Python
import io
from contextlib import suppress, redirect_stdout, nullcontext, closing

with suppress(KeyError):                  # ignore one specific exception
    {}["missing"]

buf = io.StringIO()
with redirect_stdout(buf):                # capture print output
    print("hidden")
print(buf.getvalue().strip())             # hidden

def process(lock=None):
    with lock or nullcontext():           # "maybe a lock" without an if/else
        return "processed"
print(process())                          # processed

class Conn:
    def close(self):
        self.closed = True
with closing(Conn()) as c:                # calls c.close() on exit
    pass
print(c.closed)                           # True
```

| Helper | Purpose |
| --- | --- |
| `suppress(*excs)` | Ignore the listed exceptions inside the block |
| `redirect_stdout(f)` / `redirect_stderr(f)` | Temporarily send prints somewhere else |
| `closing(obj)` | Call `obj.close()` on exit, for objects without `__exit__` |
| `nullcontext(value)` | A do-nothing manager — for optional context |
| `ExitStack()` | Enter a <em>dynamic</em> number of managers; unwinds them in reverse |
| `chdir(path)` | Temporarily change the working directory (3.11+) |
| `ContextDecorator` | A manager that can also be used as `@decorator` |
| `asynccontextmanager` | The `async with` version of `@contextmanager` |

# ExitStack: many resources at once

```python filename:Python
import tempfile
from pathlib import Path
from contextlib import ExitStack

folder = Path(tempfile.mkdtemp())
names = ["a.txt", "b.txt", "c.txt"]
with ExitStack() as stack:
    files = [stack.enter_context(open(folder / n, "w", encoding="utf-8")) for n in names]
    for i, f in enumerate(files):
        f.write(str(i))
# every file is closed here, even if one open() had failed half-way
print(all(f.closed for f in files), (folder / "c.txt").read_text())   # True 2
```

# Several managers in one `with`

```python filename:Python
import io

src, dst = io.StringIO("copy me"), io.StringIO()
with (
    src as reader,          # parenthesised form (3.10+) allows one per line
    dst as writer,
):
    writer.write(reader.read())
    copied = writer.getvalue()
print(copied, src.closed, dst.closed)   # copy me True True
```

# Async context managers

```python filename:Python
import asyncio
from contextlib import asynccontextmanager

@asynccontextmanager
async def session(name):
    await asyncio.sleep(0)          # e.g. open a network connection
    try:
        yield f"session:{name}"
    finally:
        await asyncio.sleep(0)      # e.g. close it

async def main():
    async with session("api") as s:
        return s

print(asyncio.run(main()))          # session:api
```

> [!TIP] Do
>
> Use `with` for anything that must be released: files, locks, DB transactions, network connections, temporary state.

> [!DANGER] Avoid
>
> Returning `True` from `__exit__` "just in case" — it silently swallows every exception raised in the block.

```question
What happens if an exception occurs inside a with block?

---

`__exit__` is called with the exception type, value and traceback. If it returns a falsy value the exception continues propagating after cleanup; if it returns `True` the exception is suppressed and execution continues after the `with`.
```

```question
How do you write a context manager without a class?

---

Decorate a generator with `contextlib.contextmanager`: setup, `yield` the resource inside `try`, clean up in `finally`.
```

```question
When would you use ExitStack?

---

When the number of resources is only known at runtime (open N files), or when you need to conditionally enter managers or register arbitrary cleanup callbacks with `stack.callback(func)`.
```
