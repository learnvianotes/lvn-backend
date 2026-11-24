---
id: ab7dcf53-c778-7cd0-b2ec-e5a46fc1d19e
key: topic:python/dataclasses-typing
subject: python
topic: dataclasses-typing
title: Dataclasses & __slots__
slug: dataclasses-slots
order: 1
---

`@dataclass` writes the boring methods (`__init__`, `__repr__`, `__eq__`…) from type-annotated fields. `__slots__` trims per-object memory. Together they make compact, readable data classes.

# @dataclass basics

```python filename:Python
from dataclasses import dataclass, field

@dataclass(order=True)
class Student:
    name: str
    marks: int = 0
    tags: list[str] = field(default_factory=list)   # never a bare [] default

s = Student("Asha", 91)
print(s)                                    # Student(name='Asha', marks=91, tags=[])
print(s == Student("Asha", 91))             # True
print(sorted([Student("b", 2), Student("a", 5)])[0].name)   # a
```

| Option | Effect |
| --- | --- |
| `@dataclass` | Generates `__init__`, `__repr__`, `__eq__` |
| `order=True` | Adds `<`, `<=`, `>`, `>=` comparing fields as a tuple, in order |
| `frozen=True` | Assigning a field raises `FrozenInstanceError`; instances become hashable |
| `slots=True` | Uses `__slots__` — less memory, faster attribute access (3.10+) |
| `kw_only=True` | Every field must be passed by keyword (3.10+) |
| `field(default_factory=…)` | A fresh mutable default per instance |

```python filename:Python
from dataclasses import dataclass

try:
    @dataclass
    class Bad:
        items: list = []
except ValueError as e:
    print(e)   # mutable default <class 'list'> for field items is not allowed: use default_factory
```

# \_\_post\_init\_\_: validate and derive

```python filename:Python
from dataclasses import dataclass, field

@dataclass
class Rectangle:
    w: float
    h: float
    area: float = field(init=False)      # computed — not an __init__ parameter

    def __post_init__(self):             # runs right after the generated __init__
        if self.w <= 0 or self.h <= 0:
            raise ValueError("sides must be positive")
        self.area = self.w * self.h

print(Rectangle(3, 4))                   # Rectangle(w=3, h=4, area=12)
try:
    Rectangle(0, 4)
except ValueError as e:
    print(e)                             # sides must be positive
```

# Frozen dataclasses &amp; helpers

```python filename:Python
from dataclasses import dataclass, replace, asdict, astuple, FrozenInstanceError

@dataclass(frozen=True)
class Point:
    x: int
    y: int

p = Point(1, 2)
try:
    p.x = 5
except FrozenInstanceError:
    print("frozen")                        # frozen
q = replace(p, y=9)                        # copy with some fields changed
print(q, len({p, Point(1, 2)}))            # Point(x=1, y=9) 1
print(asdict(q), astuple(q))               # {'x': 1, 'y': 9} (1, 9)
```

> [!NOTE] Key point
>
> `asdict()` recurses into nested dataclasses, lists and dicts — handy right before `json.dumps`.

# Field options, keyword-only fields &amp; InitVar

```python filename:Python
from dataclasses import dataclass, field, KW_ONLY, InitVar

@dataclass
class User:
    name: str
    password: str = field(repr=False)                     # hidden from repr
    login_count: int = field(default=0, compare=False)    # ignored by ==
    _: KW_ONLY                                            # everything below is keyword-only
    admin: bool = False

a = User("asha", "s3cret", 5)
print(a)                                  # User(name='asha', login_count=5, admin=False)
print(a == User("asha", "s3cret", 1, admin=False))   # True

@dataclass
class Account:
    owner: str
    raw_pin: InitVar[str]                 # passed to __init__ and __post_init__, never stored
    pin_len: int = field(init=False)

    def __post_init__(self, raw_pin):
        self.pin_len = len(raw_pin)

acc = Account("ravi", "1234")
print(acc, hasattr(acc, "raw_pin"))       # Account(owner='ravi', pin_len=4) False
```

| `field(...)` argument | Meaning |
| --- | --- |
| `default` / `default_factory` | Default value / zero-argument callable producing one |
| `init=False` | Not an `__init__` parameter (set it in `__post_init__`) |
| `repr=False` | Left out of `__repr__` (secrets, huge blobs) |
| `compare=False` | Ignored by `==` and ordering |
| `hash=None` | Follows `compare` for hashing |
| `kw_only=True` | This one field is keyword-only |

# dataclass vs the alternatives

| Tool | Mutable | Validation | Best for |
| --- | --- | --- | --- |
| `@dataclass` | Yes (or `frozen=True`) | Manual, in `__post_init__` | Plain internal records with behaviour |
| `typing.NamedTuple` | No | None | Lightweight immutable records that also behave as tuples |
| `TypedDict` | Yes (it's a `dict`) | Static only | Typing JSON-like dicts you receive |
| `attrs` (3rd-party) | Yes | Validators &amp; converters | Everything dataclasses do, plus more |
| `pydantic` (3rd-party) | Yes | Full runtime parsing &amp; coercion | API payloads, configs, untrusted input |

# \_\_slots\_\_

```python filename:Python
from dataclasses import dataclass

class Point:
    __slots__ = ("x", "y")      # fixed attributes, no per-instance __dict__
    def __init__(self, x, y):
        self.x, self.y = x, y

p = Point(1, 2)
try:
    p.z = 3
except AttributeError:
    print("no new attributes")  # no new attributes
print(hasattr(p, "__dict__"))   # False

@dataclass(slots=True)
class Pixel:
    x: int
    y: int
print(Pixel.__slots__)          # ('x', 'y')
```

> [!NOTE] Key point
>
> `__slots__` saves memory when you create millions of small objects, at the cost of not being able to add attributes dynamically (and no `cached_property`). Subclasses need their own `__slots__` to keep the benefit.

# Enums &amp; type hints in brief

```python filename:Python
from enum import Enum, auto
from typing import Optional

class Status(Enum):
    TODO = auto()
    DONE = auto()

def find(names: list[str], target: str) -> Optional[int]:
    return names.index(target) if target in names else None

print(Status.DONE, Status.DONE.value)       # Status.DONE 2
print(find(["a", "b"], "b"), find([], "x")) # 1 None
```

Both get their own topics: see <strong>Enums in Depth</strong> and <strong>Type Hints &amp; mypy</strong>.

```question
Why does a dataclass refuse items: list = \[\]?

---

Defaults are evaluated once, so every instance would share one list — the same bug as a mutable default argument. `dataclasses` detects `list`, `dict` and `set` defaults and raises `ValueError`; use `field(default_factory=list)`.
```

```question
When is a dataclass hashable?

---

With the default `eq=True`, `__hash__` is set to `None` (unhashable), because mutable objects that compare by value must not be hashed. Use `frozen=True` (or `unsafe_hash=True` if you know what you're doing) to get a field-based `__hash__`.
```
