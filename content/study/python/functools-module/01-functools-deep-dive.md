---
id: c508aaed-775f-75f6-a4f7-4cde5312cef2
key: topic:python/functools-module
subject: python
topic: functools-module
title: functools Deep Dive
slug: functools-deep-dive
order: 1
---

`functools` is the standard library's toolbox for working <em>with functions</em>: caching, pre-filling arguments, building decorators, generic dispatch and ordering.

# At a glance

| Tool | What it does |
| --- | --- |
| `partial(f, *a, **kw)` | New callable with some arguments pre-filled |
| `partialmethod` | `partial` for methods defined in a class body |
| `reduce(f, it, init)` | Fold an iterable into a single value |
| `cache` / `lru_cache(maxsize)` | Memoize results by arguments |
| `cached_property` | Compute an attribute once per instance, then store it |
| `wraps` / `update_wrapper` | Copy name, docstring, etc. onto a wrapper |
| `total_ordering` | Fill in `<=`, `>`, `>=` from `__eq__` + one comparison |
| `singledispatch` | Choose an implementation by the <strong>type</strong> of the first argument |
| `cmp_to_key` | Turn an old-style comparator into a `key=` function |

# partial &amp; partialmethod

```python filename:Python
from functools import partial, partialmethod

def power(base, exp):
    return base ** exp

square = partial(power, exp=2)
cube = partial(power, exp=3)
print(square(7), cube(2))                    # 49 8
print(square.func.__name__, square.keywords) # power {'exp': 2}

parse_hex = partial(int, base=16)
print(list(map(parse_hex, ["ff", "10"])))    # [255, 16]

class Light:
    def set(self, state):
        self.state = state
        return state
    on = partialmethod(set, "on")
    off = partialmethod(set, "off")

print(Light().on())                          # on
```

> [!NOTE] Key point
>
> `partial` beats a lambda when you want an inspectable, picklable callable (e.g. passing work to a process pool) — lambdas can't be pickled.

# reduce

```python filename:Python
from functools import reduce
import operator

print(reduce(operator.add, [1, 2, 3, 4]))           # 10
print(reduce(operator.mul, range(1, 6), 1))         # 120
print(reduce(lambda acc, d: {**acc, **d}, [{"a": 1}, {"b": 2}, {"a": 3}], {}))   # {'a': 3, 'b': 2}
print(reduce(max, [3, 9, 2]))                       # 9
```

> [!WARNING] Watch out
>
> `reduce` on an empty iterable without an initial value raises `TypeError`. Prefer `sum`, `math.prod`, `max`, `any`/`all` or a loop when they express the intent better.

# cache &amp; lru\_cache

```python filename:Python
from functools import lru_cache, cache

@lru_cache(maxsize=2)
def square(x):
    return x * x

square(1); square(2); square(1)      # hit for 1
square(3)                            # evicts 2 (least recently used)
square(2)                            # miss again
info = square.cache_info()
print(info.hits, info.misses, info.currsize)   # 1 4 2
square.cache_clear()
print(square.cache_info().currsize)            # 0

@lru_cache(typed=True)
def kind(x):
    return type(x).__name__
print(kind(1), kind(1.0))            # int float   ← typed: 1 and 1.0 cached separately

@cache
def total(xs):
    return sum(xs)
try:
    total([1, 2])                    # arguments are dict keys → must be hashable
except TypeError as e:
    print(e)                         # unhashable type: 'list'
print(total((1, 2)))                 # 3
```

|  | `@cache` | `@lru_cache(maxsize=128)` |
| --- | --- | --- |
| Size | Unbounded | Bounded; evicts least-recently-used |
| Speed | Slightly faster (no bookkeeping) | Small LRU overhead |
| Use for | Recursion / DP with a bounded input space | Long-running services with unbounded inputs |

> [!WARNING] Method caching pitfall
>
> Decorating a <strong>method</strong> with `@cache` caches on `self` too: every instance stays alive as long as the cache does (a memory leak), and instances must be hashable. Prefer `cached_property`, a module-level cached function, or a per-instance dict.

# cached\_property

```python filename:Python
from functools import cached_property

class Report:
    def __init__(self, rows):
        self.rows = rows
        self.computed = 0

    @cached_property
    def total(self):
        self.computed += 1           # expensive work, done once
        return sum(self.rows)

r = Report([5, 10, 20])
print(r.total, r.total, r.computed)  # 35 35 1
del r.total                          # invalidate: the next access recomputes
print(r.total, r.computed)           # 35 2
```

> [!NOTE] Key point
>
> `cached_property` stores the value in the instance `__dict__` under the same name, so later lookups never call the function. It needs a `__dict__` (not compatible with `__slots__` alone). Unlike `property`, it is writable.

# wraps &amp; update\_wrapper

```python filename:Python
from functools import wraps, update_wrapper

def plain(f):
    def wrapper(*a, **kw):
        return f(*a, **kw)
    return wrapper

def proper(f):
    @wraps(f)                         # = update_wrapper(wrapper, f)
    def wrapper(*a, **kw):
        return f(*a, **kw)
    return wrapper

@plain
def area(r):
    """Circle area."""
@proper
def volume(r):
    """Sphere volume."""

print(area.__name__, area.__doc__)        # wrapper None
print(volume.__name__, volume.__doc__)    # volume Sphere volume.
print(volume.__wrapped__.__name__)        # volume   ← the original, for introspection
```

# total\_ordering

```python filename:Python
from functools import total_ordering

@total_ordering
class Grade:
    order = "FDCBA"
    def __init__(self, letter):
        self.letter = letter
    def __eq__(self, other):
        return self.letter == other.letter
    def __lt__(self, other):
        return self.order.index(self.letter) < self.order.index(other.letter)
    def __repr__(self):
        return self.letter

print(Grade("B") > Grade("C"), Grade("A") <= Grade("A"))   # True True
print(sorted([Grade("C"), Grade("A"), Grade("F")]))        # [F, C, A]
```

# singledispatch — overloading by type

```python filename:Python
from functools import singledispatch, singledispatchmethod

@singledispatch
def to_json(value):
    raise TypeError(f"can't serialise {type(value).__name__}")

@to_json.register
def _(value: int):
    return str(value)

@to_json.register
def _(value: str):
    return f'"{value}"'

@to_json.register(list)
def _(value):
    return "[" + ", ".join(to_json(v) for v in value) + "]"

print(to_json([1, "a", [2]]))       # [1, "a", [2]]
print(to_json(True))                # True   ← bool is a subclass of int
try:
    to_json(1.5)
except TypeError as e:
    print(e)                        # can't serialise float

class Area:
    @singledispatchmethod
    def of(self, shape):
        raise NotImplementedError
    @of.register
    def _(self, side: int):
        return side * side
    @of.register
    def _(self, dims: tuple):
        return dims[0] * dims[1]

print(Area().of(3), Area().of((2, 5)))   # 9 10
```

> [!NOTE] Key point
>
> Dispatch looks only at the <strong>first</strong> argument's type and follows the MRO, so a handler for `int` also handles `bool`. It's the standard-library answer to “function overloading”.

# cmp\_to\_key &amp; the operator module

```python filename:Python
from functools import cmp_to_key
from operator import itemgetter, attrgetter, methodcaller

def by_length_then_reverse_alpha(a, b):
    if len(a) != len(b):
        return len(a) - len(b)
    return (a < b) - (a > b)          # reverse alphabetical

words = ["bb", "a", "cc", "c"]
print(sorted(words, key=cmp_to_key(by_length_then_reverse_alpha)))   # ['c', 'a', 'cc', 'bb']

print(itemgetter(0, 2)("xyz"))                     # ('x', 'z')
print(attrgetter("real")(3 + 4j))                  # 3.0
print(list(map(methodcaller("upper"), ["a", "b"])))   # ['A', 'B']
```

> [!NOTE] operator.add, mul, …
>
> Function versions of operators — pass to `reduce`, `map`, `accumulate`.

> [!NOTE] itemgetter(k)
>
> `lambda x: x[k]` — faster, and accepts several keys.

> [!NOTE] attrgetter('a.b')
>
> `lambda x: x.a.b` — dotted paths allowed.

> [!NOTE] methodcaller('m', arg)
>
> `lambda x: x.m(arg)`.

```question
How does lru\_cache work?

---

It stores results in a dict keyed by the call's arguments (so they must be hashable) and keeps a doubly linked list of recency. On a hit it returns the stored value and marks it recent; when the cache exceeds `maxsize`, it evicts the least recently used entry. `cache_info()` reports hits and misses.
```

```question
partial vs lambda?

---

Both pre-fill arguments. `partial` is introspectable (`.func`, `.args`, `.keywords`), picklable when the wrapped function is, and binds values immediately — no late-binding surprise in loops. A lambda is more flexible (can reorder or transform arguments).
```

```question
How do you get function overloading in Python?

---

Python has no signature-based overloading — a later `def` replaces the earlier one. Use default/keyword arguments, or `functools.singledispatch` to dispatch on the first argument's type (`singledispatchmethod` for methods).
```
