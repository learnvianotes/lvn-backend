---
id: a2d47a07-03e3-74d1-99b8-7f3804b5d13c
key: topic:python/decorators
subject: python
topic: decorators
title: Decorators
slug: decorators
order: 1
---

A decorator takes a function and returns a new function that wraps it — adding behaviour like timing, logging, caching or access checks without touching the original code.

> [!INFO]
>
> <strong>\`@decorator\`</strong> — syntax sugar: `@timer` above `def f` means `f = timer(f)`.

# Writing one

```python filename:Python
import functools

def shout(func):
    @functools.wraps(func)            # keep func's name and docstring
    def wrapper(*args, **kwargs):
        result = func(*args, **kwargs)
        return result.upper()
    return wrapper

@shout
def greet(name):
    """Say hello."""
    return f"hello, {name}"

print(greet("asha"))                     # HELLO, ASHA
print(greet.__name__, greet.__doc__)     # greet Say hello.
```

> [!WARNING] Watch out
>
> Without `functools.wraps`, the decorated function reports the name `wrapper` and loses its docstring — confusing in debugging and documentation.

# Decorators with arguments

Add one more level: a function that takes the arguments and <em>returns</em> the decorator.

```python filename:Python
import functools

def retry(times):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(1, times + 1):
                try:
                    return func(*args, **kwargs)
                except ValueError:
                    if attempt == times:
                        raise
        return wrapper
    return decorator

calls = {"n": 0}

@retry(times=3)
def flaky():
    calls["n"] += 1
    if calls["n"] < 3:
        raise ValueError("not yet")
    return "ok"

print(flaky(), calls["n"])   # ok 3
```

# A timing decorator

```python filename:Python
import functools, time

def timed(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        try:
            return func(*args, **kwargs)
        finally:
            elapsed = time.perf_counter() - start
            wrapper.last_ms = round(elapsed * 1000, 3)
    return wrapper

@timed
def work():
    return sum(range(100_000))

print(work())                            # 4999950000
print(isinstance(work.last_ms, float))   # True
```

# Stacking &amp; built-in decorators

Stacked decorators apply bottom-up: `@a` over `@b` over `def f` means `f = a(b(f))`.

| Decorator | Purpose |
| --- | --- |
| `@property` | Expose a method as a read-only (or validated) attribute |
| `@classmethod` / `@staticmethod` | Methods that receive the class / nothing instead of `self` |
| `@functools.cache` / `lru_cache` | Memoization |
| `@dataclasses.dataclass` | Generate `__init__`, `__repr__`, `__eq__` for a class |
| `@contextlib.contextmanager` | Turn a generator into a `with`-statement context manager |
