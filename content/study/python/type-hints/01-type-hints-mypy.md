---
id: d34a9e14-259d-7561-98cb-eea63fe9f76e
key: topic:python/type-hints
subject: python
topic: type-hints
title: Type Hints & mypy
slug: type-hints-mypy
order: 1
---

Type hints describe what a function expects and returns. Python ignores them at runtime; static checkers (mypy, pyright) and IDEs use them to catch bugs before the code runs.

> [!INFO]
>
> <strong>Gradual typing</strong> — you can add hints a little at a time. Unannotated code is treated as `Any` (anything goes), so a codebase can move from untyped to fully typed one module at a time.

# Annotation basics

```python filename:Python
def greet(name: str, times: int = 1) -> str:
    return ", ".join([f"hi {name}"] * times)

count: int = 0
scores: dict[str, list[float]] = {"asha": [9.5, 8.0]}
point: tuple[int, int] = (3, 4)
ids: tuple[int, ...] = (1, 2, 3)      # variable-length tuple

print(greet("ravi", 2))               # hi ravi, hi ravi
print(greet.__annotations__)          # {'name': <class 'str'>, 'times': <class 'int'>, 'return': <class 'str'>}
print(greet(42))                      # hi 42   ← runs fine: hints are NOT enforced at runtime
```

# The vocabulary

| Hint | Meaning |
| --- | --- |
| `list[int]`, `dict[str, int]`, `set[str]` | Built-in generics (3.9+) — no `typing.List` needed |
| `int &#124; None` / `Optional[int]` | May be `None` (the `&#124;` form is 3.10+) |
| `int &#124; str` / `Union[int, str]` | One of several types |
| `Any` | Opt out of checking for this value |
| `object` | Any value, but you may only use what every object supports — safer than `Any` |
| `Callable[[int, str], bool]` | A function taking `(int, str)` and returning `bool` |
| `Iterable[T]`, `Sequence[T]`, `Mapping[K, V]` | Accept the <em>abstract</em> type (from `collections.abc`) in parameters |
| `Literal["r", "w"]` | Only these exact values |
| `Final` | Must not be reassigned |
| `ClassVar[int]` | A class-level attribute, not an instance field |
| `Self` | The type of the current class — for fluent methods (3.11+) |
| `Never` / `NoReturn` | Function never returns normally (always raises) |

```python filename:Python
from collections.abc import Iterable, Callable
from typing import Literal

def total(xs: Iterable[float]) -> float:              # accepts list, tuple, generator…
    return sum(xs)

def apply(f: Callable[[int], int], x: int) -> int:
    return f(x)

def open_mode(mode: Literal["r", "w"]) -> str:
    return f"mode={mode}"

print(total([1.5, 2.5]), total(x / 2 for x in range(3)))   # 4.0 1.5
print(apply(lambda n: n * n, 7), open_mode("w"))           # 49 mode=w
```

> [!NOTE] Key point
>
> Be liberal in what you accept, specific in what you return: take `Iterable[str]` or `Mapping[str, int]` as parameters, return concrete `list[str]` / `dict[str, int]`.

# Structured data: TypedDict, NamedTuple, Protocol

```python filename:Python
from typing import TypedDict, NotRequired, NamedTuple, Protocol

class Movie(TypedDict):
    title: str
    year: int
    rating: NotRequired[float]      # key may be absent

class Point(NamedTuple):
    x: float
    y: float

class SupportsClose(Protocol):      # structural: anything with close() matches
    def close(self) -> None: ...

def shutdown(things: list[SupportsClose]) -> int:
    for t in things:
        t.close()
    return len(things)

class Socket:
    def close(self) -> None:
        pass

m: Movie = {"title": "Dune", "year": 2021}
print(m["title"], Point(1, 2).x, shutdown([Socket(), Socket()]))   # Dune 1 2
```

# Generics: TypeVar and the 3.12 syntax

```python filename:Python
from typing import TypeVar

T = TypeVar("T")                          # pre-3.12 style
def first_old(xs: list[T]) -> T:
    return xs[0]

def first[T](xs: list[T]) -> T:           # 3.12+ style: same meaning
    return xs[0]

def largest[N: (int, float)](a: N, b: N) -> N:   # constrained type parameter
    return a if a > b else b

class Box[T]:
    def __init__(self, item: T) -> None:
        self.item = item
    def get(self) -> T:
        return self.item

type Matrix = list[list[float]]           # type alias statement (3.12+)

print(first_old(["a"]), first([1, 2]), largest(2.5, 1.0), Box("x").get())   # a 1 2.5 x
print(Matrix.__value__)                    # list[list[float]]
```

# Overloads, `Self`, `cast` and `TYPE_CHECKING`

```python filename:Python
from typing import overload, Self, cast, TYPE_CHECKING

if TYPE_CHECKING:                   # only True for the type checker — avoids import cycles
    from decimal import Decimal

@overload
def parse(x: str) -> int: ...
@overload
def parse(x: bytes) -> str: ...
def parse(x):                       # the one real implementation
    return int(x) if isinstance(x, str) else x.decode()

class Query:
    def __init__(self) -> None:
        self.parts: list[str] = []
    def where(self, cond: str) -> Self:   # subclasses get their own type back
        self.parts.append(cond)
        return self

def to_money(x: object) -> "Decimal":
    return cast("Decimal", x)       # tells the checker "trust me" — no runtime effect

print(parse("42"), parse(b"hi"), Query().where("a").where("b").parts)   # 42 hi ['a', 'b']
```

# Running a type checker

```filename:Terminal
$ pip install mypy
$ mypy app.py                     # or: pyright app.py
$ mypy --strict src/              # require annotations everywhere
```

```python filename:Python
# app.py
def average(xs: list[float]) -> float:
    return sum(xs) / len(xs)

average(["1", "2"])            # a bug mypy finds without running anything
```

```text filename:mypy%20output
app.py:5: error: List item 0 has incompatible type "str"; expected "float"  [list-item]
app.py:5: error: List item 1 has incompatible type "str"; expected "float"  [list-item]
Found 2 errors in 1 file (checked 1 source file)
```

# Annotations at runtime

```python filename:Python
import typing

def make() -> Widget:          # Widget doesn't exist yet
    return Widget()

class Widget:
    size: int = 3

print(typing.get_type_hints(make))            # {'return': <class '__main__.Widget'>}
print(typing.get_type_hints(Widget))          # {'size': <class 'int'>}
```

> [!NOTE] Version
>
> Since <strong>3.14</strong> annotations are evaluated lazily (PEP 649), so forward references like `-> Widget` work without quotes or `from __future__ import annotations`. On 3.13 and older, write `-> "Widget"` or add the `__future__` import.

> [!NOTE] Runtime validation
>
> Hints aren't enforced. Libraries like <strong>pydantic</strong> and <strong>beartype</strong> read them to validate data at runtime.

> [!NOTE] Stubs
>
> `.pyi` files give types to untyped libraries; many live in `types-*` packages (`pip install types-requests`).

> [!NOTE] py.typed
>
> An empty marker file that tells checkers your package ships inline types.

> [!NOTE] Gradual rollout
>
> Start with public function signatures, run mypy in CI, then tighten with `--strict` module by module.

> [!WARNING] Watch out
>
> `list[int]` as a parameter type is <em>invariant</em>: a `list[bool]` is not accepted even though `bool` is a subclass of `int`, because the function could append a plain `int`. Accept `Sequence[int]` (read-only, covariant) instead.

```question
Does Python enforce type hints?

---

No. The interpreter stores them in `__annotations__` and otherwise ignores them. Static checkers (mypy, pyright), IDEs and runtime libraries such as pydantic are what give them teeth.
```

```question
Optional\[int\] vs a default of None?

---

`Optional[int]` (or `int | None`) says the <em>value</em> may be `None`. It does not make the parameter optional — that's what a default value does. `def f(x: int | None)` still requires an argument.
```

```question
What is a Protocol and how does it differ from an ABC?

---

A `Protocol` describes required methods and is matched <strong>structurally</strong> — any class with those methods qualifies, without inheriting. An ABC is <strong>nominal</strong>: a class must inherit from it (or be registered). Protocols suit duck typing; ABCs suit shared implementation and runtime `isinstance` checks.
```
