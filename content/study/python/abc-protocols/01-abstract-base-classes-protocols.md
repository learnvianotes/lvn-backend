---
id: 6233dcca-6feb-7907-9aab-b893b69b4a66
key: topic:python/abc-protocols
subject: python
topic: abc-protocols
title: Abstract Base Classes & Protocols
slug: abstract-base-classes-protocols
order: 1
---

Two ways to describe “what an object must be able to do”: <strong>ABCs</strong> check it by inheritance (nominal typing), <strong>Protocols</strong> by shape (structural typing — static duck typing).

# abc.ABC and @abstractmethod

An abstract base class can't be instantiated while it has abstract methods. Subclasses must implement every one of them — the error appears when you <em>create an object</em>, not when you call the missing method.

```python filename:Python
from abc import ABC, abstractmethod

class Exporter(ABC):
    """Template method pattern: export() fixes the algorithm, subclasses fill in the steps."""

    def export(self, rows):
        return [self.header()] + [self.format_row(r) for r in rows]

    @abstractmethod
    def header(self) -> str: ...

    @abstractmethod
    def format_row(self, row) -> str: ...

class CsvExporter(Exporter):
    def header(self):
        return "name,score"
    def format_row(self, row):
        return f"{row[0]},{row[1]}"

class Broken(Exporter):
    def header(self):
        return "x"

print(CsvExporter().export([("asha", 91), ("ravi", 84)]))   # ['name,score', 'asha,91', 'ravi,84']
try:
    Broken()
except TypeError as e:
    print(e)   # Can't instantiate abstract class Broken without an implementation for abstract method 'format_row'
print(sorted(Exporter.__abstractmethods__))                  # ['format_row', 'header']
```

# Abstract properties &amp; class methods

```python filename:Python
from abc import ABC, abstractmethod

class Shape(ABC):
    @property
    @abstractmethod                    # @abstractmethod must be the innermost decorator
    def sides(self) -> int: ...

    @classmethod
    @abstractmethod
    def unit(cls) -> "Shape": ...

    def describe(self):                # ABCs can hold ordinary, shared methods too
        return f"{type(self).__name__} with {self.sides} sides"

class Triangle(Shape):
    sides = 3                          # a plain class attribute satisfies the abstract property
    @classmethod
    def unit(cls):
        return cls()

print(Triangle.unit().describe())      # Triangle with 3 sides
```

> [!NOTE] Key point
>
> An abstract method may still have a body; subclasses can call it with `super().method()` — handy for shared default behaviour that must be consciously opted into.

# collections.abc: get methods for free

The ABCs in `collections.abc` are <em>mixins</em>: implement the few abstract methods and inherit the rest. Implement `__getitem__` + `__len__` and `Sequence` gives you `in`, iteration, `reversed`, `index` and `count`.

```python filename:Python
from collections.abc import Sequence

class Countdown(Sequence):
    def __init__(self, n):
        self.n = n
    def __len__(self):
        return self.n
    def __getitem__(self, i):
        if isinstance(i, slice):
            return [self[j] for j in range(*i.indices(len(self)))]
        if i < 0:
            i += self.n
        if not 0 <= i < self.n:
            raise IndexError(i)
        return self.n - i

c = Countdown(5)
print(list(c), c[-1], c[1:3])             # [5, 4, 3, 2, 1] 1 [4, 3]
print(3 in c, c.index(2), c.count(9))     # True 3 0
print(list(reversed(c)))                  # [1, 2, 3, 4, 5]
```

| ABC | You implement | You get for free |
| --- | --- | --- |
| `Iterable` | `__iter__` | — |
| `Iterator` | `__next__` | `__iter__` |
| `Sequence` | `__getitem__`, `__len__` | `__contains__`, `__iter__`, `__reversed__`, `index`, `count` |
| `MutableSequence` | + `__setitem__`, `__delitem__`, `insert` | `append`, `extend`, `pop`, `remove`, `+=`… |
| `Mapping` | `__getitem__`, `__iter__`, `__len__` | `get`, `keys`, `items`, `values`, `==`, `in` |
| `MutableMapping` | + `__setitem__`, `__delitem__` | `pop`, `setdefault`, `update`, `clear`… |
| `Set` | `__contains__`, `__iter__`, `__len__` | `<=`, `&#124;`, `&`, `-`, `^`, `isdisjoint` |

# isinstance with ABCs, register &amp; \_\_subclasshook\_\_

```python filename:Python
from collections.abc import Iterable, Mapping, Sized, Hashable, Callable

print(isinstance([1], Iterable), isinstance({}, Mapping))      # True True
print(isinstance("abc", Hashable), isinstance([], Hashable))   # True False

class Bag:                     # doesn't inherit from Sized...
    def __len__(self):
        return 0

print(isinstance(Bag(), Sized), isinstance(len, Callable))     # True True
```

Some ABCs (`Sized`, `Iterable`, `Hashable`, `Callable`…) check structurally through `__subclasshook__`: any class with the right method counts. You can also declare a <em>virtual subclass</em> with `register`.

```python filename:Python
from abc import ABC, abstractmethod
import io

class Drawable(ABC):
    pass

class LegacyWidget:                    # third-party class you can't modify
    def draw(self):
        return "drawn"

Drawable.register(LegacyWidget)        # a *virtual* subclass
print(isinstance(LegacyWidget(), Drawable), Drawable in LegacyWidget.__mro__)   # True False

class Closeable(ABC):
    @abstractmethod
    def close(self): ...

    @classmethod
    def __subclasshook__(cls, C):      # structural check: "has a close() method"
        if cls is Closeable:
            return any("close" in B.__dict__ for B in C.__mro__) or NotImplemented
        return NotImplemented

print(isinstance(io.StringIO(), Closeable), isinstance(42, Closeable))   # True False
```

> [!WARNING] Watch out
>
> `register` is a promise, not a check — Python never verifies that the registered class really implements the methods.

# typing.Protocol — structural typing

A `Protocol` lists the methods a type needs. Any class with those methods matches — no inheritance, no registration. Type checkers (mypy, pyright) verify it statically; `@runtime_checkable` also enables `isinstance`.

```python filename:Python
from typing import Protocol, runtime_checkable

@runtime_checkable
class SupportsArea(Protocol):
    def area(self) -> float: ...

class Square:                          # no mention of SupportsArea anywhere
    def __init__(self, s):
        self.s = s
    def area(self):
        return self.s ** 2

class Rect:
    def __init__(self, w, h):
        self.w, self.h = w, h
    def area(self):
        return self.w * self.h

def total_area(shapes: list[SupportsArea]) -> float:
    return sum(s.area() for s in shapes)

print(total_area([Square(2), Rect(2, 3)]))                     # 10
print(isinstance(Square(1), SupportsArea), isinstance("x", SupportsArea))   # True False
```

> [!WARNING] Watch out
>
> A runtime `isinstance` check against a Protocol only checks that the method <strong>names</strong> exist — not their signatures or return types. Signature checking happens only in the type checker.

# ABC or Protocol?

|  | ABC (`abc.ABC`) | Protocol (`typing.Protocol`) |
| --- | --- | --- |
| Typing style | Nominal — must inherit or `register` | Structural — just have the methods |
| Enforced | At instantiation (`TypeError`) | By the static type checker |
| Shared code | Yes — concrete methods, template methods | Possible, but only for explicit subclasses |
| Works with third-party classes | Only via `register` | Automatically |
| Best for | Frameworks and class hierarchies you own | Library APIs, callbacks, “anything with `.read()`” |

> [!TIP] Do
>
> Use an ABC when you own the hierarchy and want to share implementation; use a Protocol to describe what a function <em>accepts</em> from arbitrary callers.

> [!DANGER] Avoid
>
> Creating an ABC for every class “just in case” — in Python, plain duck typing is often enough.

# Interview angle

```question
Why can't you instantiate a class with abstract methods?

---

`ABCMeta` records unimplemented `@abstractmethod`s in `__abstractmethods__`; `object.__new__` refuses to create an instance while that set is non-empty. The subclass becomes concrete once it overrides all of them.
```

```question
Nominal vs structural typing?

---

Nominal: a type matches only if it <em>declares</em> the relationship (inherits from the ABC). Structural: a type matches if it <em>has the required members</em> (Protocol). Python's runtime is duck-typed; Protocols bring that duck typing to static type checkers.
```

```question
What does collections.abc give you beyond isinstance checks?

---

Mixin methods. Subclass `Sequence`, `Mapping` or `MutableSet`, implement the handful of abstract methods, and you inherit a full, consistent API — the safe way to build a custom container instead of subclassing `list` or `dict` directly.
```
