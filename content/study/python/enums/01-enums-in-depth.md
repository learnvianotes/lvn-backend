---
id: 329c7bf2-1c4c-77df-96b0-1b08bc46c0d5
key: topic:python/enums
subject: python
topic: enums
title: Enums in Depth
slug: enums-in-depth
order: 1
---

An `Enum` is a fixed set of named, unique constants. Members are singletons, are iterable in definition order, and make invalid states unrepresentable — no more magic strings and numbers.

# Basics: names, values, lookup

```python filename:Python
from enum import Enum

class Color(Enum):
    RED = 1
    GREEN = 2
    BLUE = 3

print(Color.RED, repr(Color.RED))            # Color.RED <Color.RED: 1>
print(Color(2), Color["BLUE"])               # Color.GREEN Color.BLUE
print(Color.RED.name, Color.RED.value)       # RED 1
print(len(Color), [c.name for c in Color])   # 3 ['RED', 'GREEN', 'BLUE']
print(Color.RED == 1, Color.RED is Color(1)) # False True
try:
    Color(7)
except ValueError as e:
    print(e)                                 # 7 is not a valid Color
```

| You have | You want | Write |
| --- | --- | --- |
| a value (e.g. from a DB) | the member | `Color(2)` |
| a name (e.g. from config) | the member | `Color['GREEN']` |
| a member | its name / value | `m.name` / `m.value` |
| the class | all members | `list(Color)` or `Color.__members__` |

> [!NOTE] Key point
>
> Members are <strong>singletons</strong>, so compare them with `is` (or `==`). A plain `Enum` member never equals its raw value: `Color.RED == 1` is `False`.

# auto() and generated values

```python filename:Python
from enum import Enum, auto

class Status(Enum):
    TODO = auto()
    DOING = auto()
    DONE = auto()

class Method(Enum):
    @staticmethod
    def _generate_next_value_(name, start, count, last_values):
        return name.lower()                # customise what auto() produces
    GET = auto()
    POST = auto()

print([s.value for s in Status])           # [1, 2, 3]
print(Method.POST.value)                   # post
```

# Aliases and @unique

```python filename:Python
from enum import Enum, unique

class Shape(Enum):
    SQUARE = 2
    CIRCLE = 3
    BOX = 2                                  # same value → an alias of SQUARE

print(Shape.BOX, Shape(2))                   # Shape.SQUARE Shape.SQUARE
print([s.name for s in Shape], list(Shape.__members__))   # ['SQUARE', 'CIRCLE'] ['SQUARE', 'CIRCLE', 'BOX']

try:
    @unique
    class Bad(Enum):
        A = 1
        B = 1
except ValueError as e:
    print(e)                                 # duplicate values found in <enum 'Bad'>: B -> A
```

# IntEnum, StrEnum &amp; Flag

```python filename:Python
from enum import IntEnum, StrEnum, auto

class Priority(IntEnum):
    LOW = 1
    HIGH = 3

class Env(StrEnum):                          # 3.11+
    DEV = auto()                             # StrEnum's auto() → the lower-cased name
    PROD = auto()

print(Priority.HIGH > Priority.LOW, Priority.HIGH + 1)   # True 4
print(sorted([3, Priority.LOW]))                         # [<Priority.LOW: 1>, 3]
print(Env.PROD, Env.PROD == "prod", Env.DEV.upper())     # prod True DEV
print(f"api-{Env.DEV}.example.com")                     # api-dev.example.com
```

```python filename:Python
from enum import Flag, auto

class Perm(Flag):
    READ = auto()        # 1
    WRITE = auto()       # 2
    EXEC = auto()        # 4
    RW = READ | WRITE    # a named combination

p = Perm.READ | Perm.EXEC
print(p)                                         # Perm.READ|EXEC
print(Perm.READ in p, Perm.WRITE in p)           # True False
print(Perm.RW.value, [m.name for m in Perm.RW])  # 3 ['READ', 'WRITE']
print(p & ~Perm.EXEC, bool(Perm(0)))             # Perm.READ False
```

| Type | Members are also… | Use when |
| --- | --- | --- |
| `Enum` | nothing else | Default choice — strict, can't be mixed up with ints/strings |
| `IntEnum` | `int`s | Interop with code/protocols that expect integers (HTTP status, DB codes) |
| `StrEnum` | `str`s | Values go into JSON, URLs, logs, config files |
| `Flag` / `IntFlag` | bit flags | Combinable options: permissions, feature toggles |

> [!WARNING] Watch out
>
> `IntEnum`/`StrEnum` members compare equal to raw ints/strings — convenient, but it gives up some of the type safety that makes enums useful. Prefer plain `Enum` unless you need the interop.

# Methods, properties &amp; data on members

```python filename:Python
from enum import Enum

class Planet(Enum):
    MERCURY = (3.303e23, 2.4397e6)
    EARTH = (5.976e24, 6.37814e6)

    def __init__(self, mass, radius):       # the tuple value is unpacked into __init__
        self.mass, self.radius = mass, radius

    @property
    def gravity(self):
        return round(6.673e-11 * self.mass / self.radius ** 2, 2)

    @classmethod
    def heaviest(cls):
        return max(cls, key=lambda p: p.mass)

print(Planet.EARTH.gravity, Planet.heaviest().name)   # 9.8 EARTH
```

# Enums in match &amp; JSON

```python filename:Python
import json
from enum import Enum, StrEnum

class Light(Enum):
    RED = "stop"
    YELLOW = "slow"
    GREEN = "go"

def action(light):
    match light:
        case Light.RED | Light.YELLOW:        # dotted names are value patterns
            return "brake"
        case Light.GREEN:
            return "drive"

print(action(Light.YELLOW), action(Light("go")))              # brake drive

class Role(StrEnum):
    ADMIN = "admin"

print(json.dumps({"role": Role.ADMIN}))                       # {"role": "admin"}
try:
    json.dumps({"light": Light.RED})
except TypeError:
    print("plain Enum is not JSON serializable")              # plain Enum is not JSON serializable
print(json.dumps({"light": Light.RED}, default=lambda e: e.value))   # {"light": "stop"}
print(Light(json.loads('{"light": "stop"}')["light"]))       # Light.RED
```

# Interview angle

```question
Why use an Enum instead of string or int constants?

---

Typos become `AttributeError`s instead of silent bugs, the set of valid values is explicit and iterable, members carry a readable name in logs and reprs, and type checkers can verify that a function only receives valid members (and that a `match` handles all of them).
```

```question
How do you convert between an enum and its stored value?

---

`Member.value` to store it (DB/JSON), `EnumClass(value)` to get the member back (raises `ValueError` for unknown values), and `EnumClass[name]` to look up by name.
```

```question
What is an enum alias?

---

A second name defined with the same value. It resolves to the first member (`Shape.BOX is Shape.SQUARE`) and is skipped during iteration. Decorate the class with `@unique` to forbid aliases.
```
