---
id: 1a07fd7f-4f81-7ba4-b377-7e3ee550f1c4
key: topic:python/generators-advanced
subject: python
topic: generators-advanced
title: "Generators: send, yield from & Coroutines"
slug: generators-send-yield-from-coroutines
order: 1
---

Generators are more than lazy lists: they can receive values, be told to stop, return a result and delegate to each other — the machinery that `async`/`await` grew out of.

# Iterator class vs generator

Both objects below behave identically in a `for` loop. The generator version gets `__iter__`, `__next__` and `StopIteration` for free.

```python filename:Python
class Countdown:                       # hand-written iterator
    def __init__(self, start):
        self.n = start
    def __iter__(self):
        return self
    def __next__(self):
        if self.n <= 0:
            raise StopIteration
        self.n -= 1
        return self.n + 1

def countdown(start):                  # the same thing as a generator
    while start > 0:
        yield start
        start -= 1

print(list(Countdown(3)), list(countdown(3)))   # [3, 2, 1] [3, 2, 1]
```

# Generator states

```python filename:Python
from inspect import getgeneratorstate

def gen():
    yield 1
    yield 2

g = gen()
print(getgeneratorstate(g))      # GEN_CREATED
next(g)
print(getgeneratorstate(g))      # GEN_SUSPENDED
list(g)
print(getgeneratorstate(g))      # GEN_CLOSED
```

| State | Meaning |
| --- | --- |
| `GEN_CREATED` | Created, body hasn't started — the first `next()` runs up to the first `yield` |
| `GEN_RUNNING` | Currently executing (only visible from inside) |
| `GEN_SUSPENDED` | Paused at a `yield`, locals preserved |
| `GEN_CLOSED` | Finished, closed, or raised — further `next()` raises `StopIteration` |

# `send()`: values flow <em>into</em> the generator

`x = yield value` hands `value` out and pauses; when resumed with `g.send(v)`, the `yield` expression evaluates to `v`. `next(g)` is the same as `g.send(None)`. The first call must be `next()` (or `send(None)`) to <em>prime</em> the generator.

```python filename:Python
def running_average():
    total, count, avg = 0, 0, None
    while True:
        value = yield avg           # hand out avg, wait for the next value
        total += value
        count += 1
        avg = total / count

avg = running_average()
next(avg)                           # prime: run to the first yield
print(avg.send(10))                 # 10.0
print(avg.send(20))                 # 15.0
print(avg.send(60))                 # 30.0
```

# `throw()`, `close()` and `GeneratorExit`

```python filename:Python
def worker():
    try:
        while True:
            try:
                job = yield
                print("did", job)
            except ValueError as e:
                print("recovered from", e)      # the error is raised AT the paused yield
    finally:
        print("cleanup")                         # runs on close() — GeneratorExit

w = worker()
next(w)
w.send("a")                                      # did a
w.throw(ValueError("bad job"))                   # recovered from bad job
w.close()                                        # cleanup
```

```text filename:Output
did a
recovered from bad job
cleanup
```

> [!WARNING] Watch out
>
> Never swallow `GeneratorExit` and keep yielding — `close()` then raises `RuntimeError: generator ignored GeneratorExit`. Do cleanup in `finally` and let it propagate.

# Return values &amp; `yield from`

A generator's `return x` becomes `StopIteration(x).value`. `yield from sub` re-yields everything `sub` produces, forwards `send`/`throw` to it, and evaluates to its return value.

```python filename:Python
def read_block(lines):
    count = 0
    for line in lines:
        if line == "END":
            return count                 # becomes the value of "yield from"
        yield line.upper()
        count += 1

def document(lines):
    it = iter(lines)
    n1 = yield from read_block(it)
    n2 = yield from read_block(it)
    yield f"blocks had {n1} and {n2} lines"

print(list(document(["a", "b", "END", "c", "END"])))
# ['A', 'B', 'C', 'blocks had 2 and 1 lines']
```

```text filename:Output
['A', 'B', 'C', 'blocks had 2 and 1 lines']
```

```python filename:Python
def tree(node):                          # recursive delegation: walk a nested structure
    name, children = node
    yield name
    for child in children:
        yield from tree(child)

t = ("root", [("a", [("a1", [])]), ("b", [])])
print(list(tree(t)))                     # ['root', 'a', 'a1', 'b']
```

# Pipelines

```python filename:Python
def parse(lines):
    for line in lines:
        name, amount = line.split(",")
        yield name, float(amount)

def only_large(rows, limit):
    return ((n, a) for n, a in rows if a >= limit)

def total(rows):
    return sum(a for _, a in rows)

log = ["tea,40", "laptop,55000", "phone,18000", "pen,10"]
print(total(only_large(parse(log), 1000)))    # 73000.0
```

> [!NOTE] Key point
>
> Each stage pulls one item at a time from the previous one, so the whole pipeline runs in constant memory — whether the input is 4 lines or a 40 GB log file.

# From generators to `async`/`await`

1. <strong>2001 — generators (PEP 255)</strong>

   `yield` makes pausable functions.

2. <strong>2005 — </strong><strong>`send`</strong><strong>/</strong><strong>`throw`</strong><strong>/</strong><strong>`close`</strong><strong> (PEP 342)</strong>

   Generators become coroutines that can receive values.

3. <strong>2012 — </strong><strong>`yield from`</strong><strong> (PEP 380)</strong>

   Delegation lets coroutines call sub-coroutines; asyncio was first built on it.

4. <strong>2015 — </strong><strong>`async def`</strong><strong> / </strong><strong>`await`</strong><strong> (PEP 492)</strong>

   Native coroutine syntax, separate from generators, with the same suspend/resume idea.

> [!WARNING] One-shot
>
> A generator can be consumed <strong>once</strong>. Passing the same generator to two functions gives the second one nothing — materialise it with `list()` or use `itertools.tee`.

```question
What does send() do, and why must you call next() first?

---

`send(v)` resumes a paused generator and makes the pending `yield` expression evaluate to `v`. A freshly created generator isn't paused at a `yield` yet, so the first resume must be `next(g)` (or `send(None)`) — sending a non-`None` value raises `TypeError`.
```

```question
How do you get a generator's return value?

---

With `yield from` (the expression's value), or by catching `StopIteration` and reading `.value`. A plain `for` loop discards it.
```

```question
Generator vs coroutine in modern Python?

---

A generator (`def` + `yield`) produces a stream of values. A native coroutine (`async def`) is awaited and scheduled by an event loop; it can't be iterated with `for`. Both suspend and resume a frame, but they are different types with different protocols.
```
