---
id: eadbd4fc-4cd0-7449-9cbb-509a79d056b1
key: topic:python/memory-model
subject: python
topic: memory-model
title: Memory, Mutability & Garbage Collection
slug: memory-mutability-garbage-collection
order: 1
---

Variables are references, objects live on the heap, and CPython frees them with reference counting plus a cycle collector. Mutability explains most “weird” Python bugs.

# Names point to objects

```python filename:Python
a = [1, 2]
b = a                    # b refers to the SAME list
b.append(3)
print(a, a is b)         # [1, 2, 3] True

x = 5
y = x
y += 1                   # ints are immutable: y now points to a new object
print(x, y)              # 5 6
```

| Immutable (can't change in place) | Mutable (can change in place) |
| --- | --- |
| `int`, `float`, `bool`, `str`, `bytes` | `list`, `dict`, `set`, `bytearray` |
| `tuple`, `frozenset`, `None` | Most user-defined objects |

> [!NOTE] Key point
>
> A tuple is immutable, but if it <em>contains</em> a list, that list can still change: `t = ([1],); t[0].append(2)` works.

# `+=` differs for mutable and immutable types

```python filename:Python
nums = [1]
alias = nums
nums += [2]              # list: extends in place
print(alias)             # [1, 2]

s = "a"
alias_s = s
s += "b"                 # str: builds a new object
print(alias_s, s)        # a ab
```

# Reference counting &amp; the cycle collector

1. <strong>Reference counting</strong>

   Every object tracks how many references point to it. When the count hits 0, it is freed immediately.

2. <strong>Cycle detection</strong>

   Objects that reference each other (a ↔ b) never reach 0. The `gc` module periodically finds and frees such unreachable cycles.

3. <strong>Generations</strong>

   New objects are checked often; objects that survive are promoted and checked less — most objects die young.

```python filename:Python
import sys, gc

data = []
# getrefcount's own argument adds a temporary reference:
print(sys.getrefcount(data) >= 2)   # True

class Node:
    def __init__(self):
        self.other = None
a, b = Node(), Node()
a.other, b.other = b, a             # a reference cycle
del a, b
print(gc.collect() >= 2)            # True
```

# Memory tips

> [!NOTE] Generators over lists
>
> Stream data instead of materialising it: `sum(x for x in …)`.

> [!NOTE] __slots__
>
> Drop per-instance `__dict__`s when creating millions of objects.

> [!NOTE] sys.getsizeof
>
> Shallow size of one object in bytes — it doesn't include what it references.

> [!NOTE] Interning
>
> Short identifier-like strings and small ints are reused. Never depend on it; compare with `==`.
