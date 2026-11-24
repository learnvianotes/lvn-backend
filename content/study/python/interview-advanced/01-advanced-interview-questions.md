---
id: 0335141f-b9a4-7c67-b7b0-6833c859a0dd
key: topic:python/interview-advanced
subject: python
topic: interview-advanced
title: Advanced Interview Questions
slug: advanced-interview-questions
order: 1
---

The deeper questions asked for mid/senior Python roles — internals, the object model, concurrency and design — with answers you can say in under a minute.

# Object model &amp; internals

```question
What is the difference between \_\_new\_\_ and \_\_init\_\_?

---

`__new__` is a static method that <strong>creates</strong> and returns the instance (it receives the class). `__init__` <strong>initialises</strong> the already-created instance and returns `None`. You override `__new__` only for immutable types (subclassing `int`, `str`, `tuple`), singletons or caching instances.
```

```question
How does attribute lookup work for obj.x?

---

`type(obj).__getattribute__` runs: first a <strong>data descriptor</strong> (defines `__set__`, e.g. a `property`) found on the class MRO wins; otherwise the instance `__dict__`; otherwise a non-data descriptor or plain class attribute (functions become bound methods here); finally `__getattr__` if defined, else `AttributeError`.
```

```question
What is a descriptor? Where does Python use them?

---

An object on a class that defines `__get__` (and optionally `__set__` / `__delete__`) to control attribute access. `property`, `classmethod`, `staticmethod`, `functools.cached_property`, `__slots__` members and even ordinary methods (functions are descriptors that bind `self`) are all descriptors.
```

```question
What is a metaclass? When would you use one?

---

The class of a class — `type` by default. It controls class <em>creation</em> (`__new__` / `__init__` of the metaclass run when a `class` statement executes). Frameworks use them for ORMs and registries, but `__init_subclass__`, class decorators or descriptors solve most of those problems more simply.
```

```question
Why can't a list be a dict key, and what makes an object hashable?

---

Dict lookups rely on a key's hash never changing. A list is mutable, so its hash would change as it changes — Python makes it unhashable. An object is hashable if it has `__hash__` and equal objects hash equally (`a == b` ⇒ `hash(a) == hash(b)`). Defining `__eq__` without `__hash__` sets `__hash__` to `None`.
```

```question
What does \_\_slots\_\_ do and what are the trade-offs?

---

It replaces the per-instance `__dict__` with fixed slots, saving memory and making attribute access slightly faster. Trade-offs: you can't add new attributes, every class in the hierarchy must declare slots to get the saving, and weak references need `__weakref__` in the slots.
```

# Functions, generators &amp; scope

```question
How are closures implemented?

---

Variables captured by an inner function are stored in <strong>cell</strong> objects shared by the outer and inner function. The function's `__closure__` tuple holds these cells, which is why the inner function sees the variable's <em>current</em> value when called (late binding).
```

```question
How does a generator work under the hood?

---

Calling a generator function creates a generator object with a suspended frame. Each `next()` resumes the frame until the next `yield`, which returns a value and suspends again, keeping locals and the instruction pointer. When the function returns, `StopIteration` is raised (carrying the return value). `send()` resumes it with a value that becomes the result of the `yield` expression.
```

```question
Explain yield from.

---

It delegates to a sub-iterator: every value is yielded straight through, `send()` and `throw()` are forwarded, and the sub-generator's `return` value becomes the value of the `yield from` expression. It was the foundation of generator-based coroutines before `async` / `await`.
```

```question
What's the difference between an iterable and an iterator?

---

An iterable has `__iter__` returning a fresh iterator (lists, dicts, files) and can be looped many times. An iterator has `__next__` (and `__iter__` returning itself), keeps position, and is exhausted after one pass.
```

# Concurrency &amp; performance

```question
If the GIL exists, why do we still need locks?

---

The GIL only guarantees that one bytecode instruction runs at a time — it doesn't make <em>your</em> operations atomic. `counter += 1` is a load, an add and a store; a thread switch between them loses updates. Locks protect multi-step invariants. (And free-threaded builds have no GIL at all.)
```

```question
When would you choose asyncio over threads?

---

When you have many (hundreds to thousands) concurrent I/O waits — sockets, HTTP calls — and your libraries are async-aware. Tasks are far cheaper than threads and switch only at `await`, so there are fewer race conditions. Threads are simpler for a handful of blocking calls or for libraries without async support; neither helps CPU-bound work — use processes.
```

```question
How would you speed up a slow Python program?

---

Measure first (`cProfile`, `py-spy`). Then: a better algorithm or data structure (set instead of list lookups), push loops into C (built-ins, comprehensions, NumPy), cache repeated work (`functools.cache`), avoid repeated attribute lookups in hot loops, use `multiprocessing` for CPU-bound work and async/threads for I/O, and consider PyPy, Cython or Numba for hot numerical code.
```

```question
What is the difference between deepcopy and pickling for copying?

---

`copy.deepcopy` walks the object graph in memory, honours `__deepcopy__` and handles cycles with a memo dict. `pickle` serialises to bytes and back — slower, needs picklable objects, and is really for storage or sending between processes, not copying.
```

# Design &amp; practice

```question
How do you implement a singleton in Python?

---

The Pythonic answer: a <strong>module</strong> is already a singleton — put the shared state or instance at module level. Other options: override `__new__` to return a cached instance, a class decorator that caches the instance, or a metaclass. Mention that singletons make testing harder, so dependency injection is often better.
```

```question
How do you make a class iterable, comparable and usable with with?

---

Iterable: `__iter__` (often a generator method). Comparable: `__eq__` plus `__lt__` with `@functools.total_ordering`, or `@dataclass(order=True)`. Context manager: `__enter__` / `__exit__`, or a generator with `@contextlib.contextmanager`.
```

```question
What are \* and / in a function signature?

---

Parameters before `/` are positional-only (callers can't name them, so you can rename them freely). Parameters after `*` (or `*args`) are keyword-only, forcing readable calls like `sort(key=…, reverse=True)`.
```

```question
How do you manage dependencies and environments for a project?

---

One virtual environment per project (`python -m venv .venv` or `uv venv`), dependencies declared in `pyproject.toml`, exact versions pinned in a lock file (`uv.lock`, `poetry.lock`, or `pip freeze > requirements.txt`) for reproducible installs, and CI that installs from the lock file.
```

# Code you should be able to write on a whiteboard

```python filename:Python%20%E2%80%94%20LRU%20cache
from collections import OrderedDict

class LRUCache:
    """O(1) get/put: OrderedDict remembers recency order."""
    def __init__(self, capacity: int):
        self.capacity = capacity
        self.data = OrderedDict()

    def get(self, key):
        if key not in self.data:
            return -1
        self.data.move_to_end(key)            # mark as most recently used
        return self.data[key]

    def put(self, key, value):
        self.data[key] = value
        self.data.move_to_end(key)
        if len(self.data) > self.capacity:
            self.data.popitem(last=False)     # evict least recently used

c = LRUCache(2)
c.put("a", 1); c.put("b", 2); c.get("a"); c.put("c", 3)
print(list(c.data), c.get("b"))               # ['a', 'c'] -1
```

```python filename:Python%20%E2%80%94%20decorator%20with%20state
import functools, time

def rate_limited(max_calls, per_seconds, clock=time.monotonic):
    """Allow at most max_calls in any per_seconds window."""
    def decorator(func):
        calls = []
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            now = clock()
            while calls and now - calls[0] >= per_seconds:
                calls.pop(0)
            if len(calls) >= max_calls:
                raise RuntimeError("rate limit exceeded")
            calls.append(now)
            return func(*args, **kwargs)
        return wrapper
    return decorator

fake_now = [0.0]
@rate_limited(2, 1.0, clock=lambda: fake_now[0])
def ping():
    return "pong"

print(ping(), ping())             # pong pong
try:
    ping()
except RuntimeError as e:
    print(e)                      # rate limit exceeded
fake_now[0] = 1.5                 # time passes
print(ping())                     # pong
```

```python filename:Python%20%E2%80%94%20recursive%20generator
def flatten(nested):
    """Flatten arbitrarily nested lists/tuples lazily."""
    for item in nested:
        if isinstance(item, (list, tuple)):
            yield from flatten(item)
        else:
            yield item

print(list(flatten([1, [2, (3, [4])], 5])))   # [1, 2, 3, 4, 5]
```
