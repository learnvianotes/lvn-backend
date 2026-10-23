---
id: da469c6a-e38b-7694-989d-5be7b378f77f
key: topic:python/collections-more
subject: python
topic: collections-more
title: "More collections: namedtuple, OrderedDict, ChainMap"
slug: more-collections-namedtuple-ordereddict-chainmap
order: 1
---

The rest of the `collections` toolbox — lightweight records, counting arithmetic, order-aware dicts, layered lookups — plus when to use each.

# namedtuple — a tuple with field names

```python filename:Python
from collections import namedtuple

Point = namedtuple("Point", ["x", "y"])
p = Point(3, 4)
x, y = p                             # still a tuple: unpacking, indexing, hashing
print(p.x, p[1], x + y)              # 3 4 7
print(p._replace(x=10), p)           # Point(x=10, y=4) Point(x=3, y=4)
print(p._asdict())                   # {'x': 3, 'y': 4}
print(Point._fields)                 # ('x', 'y')
print(Point._make([5, 6]))           # Point(x=5, y=6)

Conn = namedtuple("Conn", "host port timeout", defaults=[30])
print(Conn("db", 5432))              # Conn(host='db', port=5432, timeout=30)
```

`typing.NamedTuple` is the class-syntax version — same runtime behaviour, but with type hints, docstrings and methods.

```python filename:Python
from typing import NamedTuple

class Employee(NamedTuple):
    name: str
    dept: str = "eng"

    def badge(self) -> str:
        return f"{self.name}@{self.dept}"

e = Employee("asha")
print(e, e.badge())          # Employee(name='asha', dept='eng') asha@eng
try:
    e.name = "ravi"
except AttributeError:
    print("immutable")       # immutable
```

|  | `namedtuple` / `NamedTuple` | `@dataclass` | `dict` |
| --- | --- | --- | --- |
| Mutable | No | Yes (or `frozen=True`) | Yes |
| Access | `p.x` and `p[0]` | `p.x` | `p['x']` |
| Hashable | Yes | Only if frozen | No |
| Best for | Small immutable records, returning several values | Rich objects with defaults &amp; methods | Dynamic / JSON-like data |

# Counter — counting with arithmetic

```python filename:Python
from collections import Counter

inventory = Counter(apple=3, pear=1)
inventory.update(["apple", "kiwi"])          # add counts
print(inventory)                             # Counter({'apple': 4, 'pear': 1, 'kiwi': 1})
inventory.subtract({"pear": 2})              # can go negative
print(inventory["pear"], inventory.total())  # -1 4

a, b = Counter("aabbc"), Counter("abd")
print(a + b)          # Counter({'a': 3, 'b': 3, 'c': 1, 'd': 1})
print(a - b)          # Counter({'a': 1, 'b': 1, 'c': 1})   ← drops counts <= 0
print(a & b)          # Counter({'a': 1, 'b': 1})           ← min of each
print(sorted(Counter(x=2, y=1).elements()))   # ['x', 'x', 'y']
```

> [!NOTE] Key point
>
> A `Counter` is a `dict` subclass: missing keys read as `0`, and `+`, `-`, `&`, `|` combine counters. `most_common(k)` gives the top k.

# defaultdict variations

```python filename:Python
from collections import defaultdict

seen_first = defaultdict(lambda: "unknown")     # any zero-arg callable
print(seen_first["x"])                          # unknown

def tree():
    return defaultdict(tree)                    # infinitely nested dict
t = tree()
t["india"]["ts"]["hyd"] = 1
print(t["india"]["ts"]["hyd"], "ap" in t["india"])   # 1 False

totals = defaultdict(int)
for dept, amount in [("eng", 5), ("ops", 2), ("eng", 3)]:
    totals[dept] += amount
print(dict(totals))                              # {'eng': 8, 'ops': 2}
```

> [!WARNING] Watch out
>
> Merely <em>reading</em> `d[missing]` on a `defaultdict` inserts the key. Use `key in d` or `d.get(key)` when you only want to check.

# OrderedDict — order you can manipulate

Plain dicts keep insertion order since 3.7, so `OrderedDict` is now for its extras: `move_to_end`, `popitem(last=False)`, and order-sensitive equality.

```python filename:Python
from collections import OrderedDict

a = OrderedDict(x=1, y=2)
b = OrderedDict(y=2, x=1)
print(a == b, dict(a) == dict(b))     # False True   ← OrderedDict compares order

a.move_to_end("x")                    # x becomes the newest
print(list(a))                        # ['y', 'x']
print(a.popitem(last=False))          # ('y', 2)   ← FIFO pop of the oldest
```

```python filename:Python%20%E2%80%94%20LRU%20cache%20(a%20classic%20interview%20question)
from collections import OrderedDict

class LRUCache:
    def __init__(self, capacity):
        self.capacity = capacity
        self.data = OrderedDict()

    def get(self, key):
        if key not in self.data:
            return -1
        self.data.move_to_end(key)            # mark as recently used
        return self.data[key]

    def put(self, key, value):
        self.data[key] = value
        self.data.move_to_end(key)
        if len(self.data) > self.capacity:
            self.data.popitem(last=False)     # evict least recently used

cache = LRUCache(2)
cache.put(1, "a"); cache.put(2, "b")
cache.get(1)                                  # 1 is now most recent
cache.put(3, "c")                             # evicts 2
print(list(cache.data), cache.get(2))         # [1, 3] -1
```

# ChainMap — layered lookups

`ChainMap(a, b, c)` searches several dicts in order <strong>without copying</strong> them. Writes go to the first map. Perfect for defaults → config file → environment → command-line layering, or nested scopes.

```python filename:Python
from collections import ChainMap

defaults = {"theme": "light", "lang": "en", "debug": False}
user = {"theme": "dark"}
cli = {"debug": True}

settings = ChainMap(cli, user, defaults)
print(settings["theme"], settings["lang"], settings["debug"])   # dark en True

settings["lang"] = "te"                  # written to the first map (cli)
print(cli, defaults["lang"])             # {'debug': True, 'lang': 'te'} en

scope = ChainMap({"x": 1})
inner = scope.new_child({"x": 2})        # push a new scope
print(inner["x"], inner.parents["x"])    # 2 1
```

# UserDict &amp; UserList — safe subclassing

Subclassing `dict` directly is tricky: `update()` and the constructor bypass your overridden `__setitem__`. `UserDict` stores the data in `self.data` and routes every write through your methods.

```python filename:Python
from collections import UserDict

class LowerDict(dict):
    def __setitem__(self, k, v):
        super().__setitem__(k.lower(), v)

class LowerUserDict(UserDict):
    def __setitem__(self, k, v):
        super().__setitem__(k.lower(), v)

print(LowerDict({"A": 1}))                    # {'A': 1}   ← override bypassed!
print(LowerUserDict({"A": 1}).data)           # {'a': 1}
```

# Two more handy containers

```python filename:Python
from array import array
from types import SimpleNamespace

nums = array("i", [1, 2, 3])        # compact typed array of C ints
nums.append(4)
print(nums.tolist(), nums.itemsize) # [1, 2, 3, 4] 4

cfg = SimpleNamespace(host="localhost", port=8000)   # attribute bag
cfg.debug = True
print(cfg.port, cfg)   # 8000 namespace(host='localhost', port=8000, debug=True)
```

# Choosing the right container

| Need | Use |
| --- | --- |
| Immutable record with named fields | `namedtuple` / `typing.NamedTuple` |
| Count things, combine counts | `Counter` |
| Group values / auto-create missing entries | `defaultdict` |
| Reorder keys, LRU cache, FIFO dict | `OrderedDict` |
| Look up through several dicts in priority order | `ChainMap` |
| Queue / sliding window | `deque` |
| Custom dict/list behaviour | `UserDict` / `UserList` |
| Millions of numbers, low memory | `array` (or NumPy) |
| Quick attribute bag | `types.SimpleNamespace` |

```question
Why use OrderedDict now that dict preserves insertion order?

---

For its extra behaviour: `move_to_end`, `popitem(last=False)` (FIFO) and equality that takes order into account. It's the idiomatic base for an LRU cache.
```

```question
Implement an LRU cache in O(1) per operation.

---

Use an `OrderedDict`: on `get`, `move_to_end(key)`; on `put`, insert, `move_to_end`, and if over capacity `popitem(last=False)`. Under the hood this is a hash map plus a doubly linked list — the same design you'd write by hand in Java or C++. For caching function results, `functools.lru_cache` does it for you.
```

```question
namedtuple or dataclass?

---

`namedtuple` for small, immutable, tuple-compatible records (unpacking, hashing, low memory). `dataclass` when you need mutability, default factories, validation in `__post_init__` or many methods.
```
