---
id: a3be7d02-03e5-7feb-9c56-389f93e0defd
key: topic:python/dunder-methods
subject: python
topic: dunder-methods
title: Magic (Dunder) Methods
slug: magic-dunder-methods
order: 1
---

Double-underscore methods let your objects plug into Python's syntax: printing, `==`, `len()`, `[]`, `for`, `+`, `with` and more.

# Representation

```python filename:Python
class Money:
    def __init__(self, amount, cur="INR"):
        self.amount, self.cur = amount, cur
    def __repr__(self):                  # unambiguous, for developers
        return f"Money({self.amount!r}, {self.cur!r})"
    def __str__(self):                   # readable, for users
        return f"{self.amount:.2f} {self.cur}"

m = Money(250)
print(repr(m))        # Money(250, 'INR')
print(m)              # 250.00 INR
print([m])            # [Money(250, 'INR')]
```

> [!NOTE] Key point
>
> Containers show their items with `repr()`. Always define `__repr__`; add `__str__` when a friendlier form helps.

# Equality, hashing &amp; ordering

```python filename:Python
from functools import total_ordering

@total_ordering
class Version:
    def __init__(self, major, minor):
        self.key = (major, minor)
    def __eq__(self, other):
        return isinstance(other, Version) and self.key == other.key
    def __hash__(self):                   # equal objects must hash equally
        return hash(self.key)
    def __lt__(self, other):
        return self.key < other.key

v1, v2 = Version(1, 2), Version(1, 10)
print(v1 < v2, v1 >= v2, v1 == Version(1, 2))   # True False True
print(len({v1, Version(1, 2)}))                  # 1
```

> [!WARNING] Watch out
>
> Defining `__eq__` without `__hash__` makes instances <strong>unhashable</strong> (Python sets `__hash__ = None`). If objects can change, don't make them hashable.

# Container &amp; iteration protocols

```python filename:Python
class Playlist:
    def __init__(self, *songs):
        self._songs = list(songs)
    def __len__(self):
        return len(self._songs)
    def __getitem__(self, i):             # enables p[i], slicing and iteration
        return self._songs[i]
    def __contains__(self, song):
        return song in self._songs

p = Playlist("a", "b", "c")
print(len(p), p[0], p[-1], "b" in p)      # 3 a c True
print(list(p), p[1:])                     # ['a', 'b', 'c'] ['b', 'c']
```

# Operators &amp; callables

```python filename:Python
class Vec:
    def __init__(self, x, y):
        self.x, self.y = x, y
    def __add__(self, o):
        return Vec(self.x + o.x, self.y + o.y)
    def __mul__(self, k):
        return Vec(self.x * k, self.y * k)
    def __abs__(self):
        return (self.x ** 2 + self.y ** 2) ** 0.5
    def __repr__(self):
        return f"Vec({self.x}, {self.y})"

class Adder:
    def __init__(self, n):
        self.n = n
    def __call__(self, x):                # instances become callable
        return x + self.n

print(Vec(1, 2) + Vec(3, 4), Vec(3, 4) * 2, abs(Vec(3, 4)))   # Vec(4, 6) Vec(6, 8) 5.0
print(Adder(10)(5))                                            # 15
```

| Syntax | Calls |
| --- | --- |
| `str(x)`, `repr(x)` | `__str__`, `__repr__` |
| `x == y`, `x < y` | `__eq__`, `__lt__` (+ `__le__`, `__gt__`, `__ge__`) |
| `len(x)`, `x[i]`, `v in x` | `__len__`, `__getitem__`, `__contains__` |
| `for v in x` | `__iter__` (then `__next__` on the iterator) |
| `x + y`, `x * y` | `__add__`, `__mul__` (`__radd__` for `y + x`) |
| `x()` | `__call__` |
| `with x:` | `__enter__`, `__exit__` |
| `bool(x)` | `__bool__`, falling back to `__len__` |
