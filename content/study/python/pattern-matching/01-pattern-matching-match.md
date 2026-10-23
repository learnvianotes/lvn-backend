---
id: 0932c5a9-c785-707f-9d75-db209293e872
key: topic:python/pattern-matching
subject: python
topic: pattern-matching
title: Pattern Matching (match)
slug: pattern-matching-match
order: 1
---

`match` (Python 3.10+) compares a value against a series of <em>patterns</em> — shapes, not just values — and binds the pieces it finds to names.

> [!INFO]
>
> <strong>Structural pattern matching</strong> — `match subject:` followed by `case pattern:` blocks. Cases are tried top to bottom; the <strong>first</strong> one that matches runs, and there is no fall-through.

# Literals, OR-patterns, `as` and the wildcard

```python filename:Python
def http_status(code):
    match code:
        case 200 | 201 | 204:            # OR-pattern
            return "success"
        case 301 | 302 as r:             # bind the matched value with as
            return f"redirect {r}"
        case 404:
            return "not found"
        case _:                          # wildcard: matches anything, binds nothing
            return "other"

print(http_status(201), http_status(302))   # success redirect 302
print(http_status(404), http_status(500))   # not found other
```

# Sequence patterns

```python filename:Python
def summarize(seq):
    match seq:
        case []:
            return "empty"
        case [x]:
            return f"one item: {x}"
        case [x, y]:
            return f"pair: {x}, {y}"
        case [first, *rest]:             # star captures the remainder as a list
            return f"{first} and {len(rest)} more"

print(summarize([]))              # empty
print(summarize([7]))             # one item: 7
print(summarize((1, 2)))          # pair: 1, 2   ← tuples match list patterns too
print(summarize([1, 2, 3, 4]))    # 1 and 3 more
print(summarize("ab"))            # None   ← str is NOT treated as a sequence here
```

```python filename:Python
def fizzbuzz(n):
    match (n % 3, n % 5):                # match a tuple built on the spot
        case (0, 0): return "FizzBuzz"
        case (0, _): return "Fizz"
        case (_, 0): return "Buzz"
        case _: return str(n)

print(" ".join(fizzbuzz(i) for i in range(1, 16)))   # 1 2 Fizz 4 Buzz Fizz 7 8 Fizz Buzz 11 Fizz 13 14 FizzBuzz
```

# Mapping patterns

```python filename:Python
def handle(event):
    match event:
        case {"type": "click", "x": x, "y": y}:
            return f"click at ({x}, {y})"
        case {"type": "key", "key": str(k)} if len(k) == 1:
            return f"key {k!r}"
        case {"type": "resize", **rest}:
            return f"resize {rest}"
        case {"type": t}:
            return f"unhandled {t}"

print(handle({"type": "click", "x": 3, "y": 4, "ts": 99}))   # click at (3, 4)   ← extra keys are ignored
print(handle({"type": "key", "key": "q"}))                  # key 'q'
print(handle({"type": "resize", "w": 800, "h": 600}))       # resize {'w': 800, 'h': 600}
print(handle({"type": "scroll"}))                           # unhandled scroll
```

> [!NOTE] Key point
>
> Mapping patterns match if the listed keys are present — other keys are allowed. Sequence patterns are the opposite: the length must match exactly unless you use `*rest`.

# Class patterns

```python filename:Python
from dataclasses import dataclass

@dataclass
class Point:
    x: int
    y: int

@dataclass
class Circle:
    center: Point
    r: float

def where(shape):
    match shape:
        case Point(x=0, y=0):
            return "origin"
        case Point(0, y):                # positional → uses Point.__match_args__
            return f"on the y-axis at {y}"
        case Point(x, y) if x == y:      # guard
            return "on the diagonal"
        case Circle(Point(0, 0), r):     # patterns nest
            return f"circle of radius {r} at the origin"
        case Point() | Circle():         # just an isinstance check
            return "somewhere else"
        case _:
            return "not a shape"

print(where(Point(0, 0)), "|", where(Point(0, 5)))        # origin | on the y-axis at 5
print(where(Point(3, 3)), "|", where(Circle(Point(0, 0), 2)))   # on the diagonal | circle of radius 2 at the origin
print(where(Point(1, 2)), "|", where("hi"))               # somewhere else | not a shape
print(Point.__match_args__)                               # ('x', 'y')
```

```python filename:Python
def kind(value):
    match value:
        case bool():                     # check bool before int — bool is a subclass of int
            return "bool"
        case int(n) if n < 0:            # built-ins match the whole value positionally
            return "negative int"
        case int() | float():
            return "number"
        case str() as s:
            return f"string of {len(s)}"
        case _:
            return type(value).__name__

print(kind(True), kind(-4), kind(2.5), kind("abc"), kind(None))   # bool negative int number string of 3 NoneType
```

A class pattern `Cls(...)` first checks `isinstance(subject, Cls)`, then matches attributes: keyword sub-patterns by name, positional ones via the class's `__match_args__` tuple (generated automatically by `@dataclass` and `namedtuple`).

# Guards

`case pattern if condition:` — the pattern must match <strong>and</strong> the condition must be truthy. Names bound by the pattern are available in the guard.

```python filename:Python
def classify(pair):
    match pair:
        case (a, b) if a == b:
            return "equal"
        case (a, b) if a > b:
            return "descending"
        case (_, _):
            return "ascending"

print(classify((2, 2)), classify((5, 1)), classify((1, 5)))   # equal descending ascending
```

# The capture-pattern trap

A <strong>bare name</strong> in a pattern is a <em>capture</em>: it matches anything and assigns to that name. To compare against a constant, use a <strong>dotted name</strong> (a value pattern) such as `Color.RED` or `http.HTTPStatus.OK`.

```python filename:Python
RED = "red"

def is_red(color):
    match color:
        case RED:                        # captures! binds a local RED = color
            return True
    return False

print(is_red("blue"))                    # True   ← oops

from enum import Enum
class Color(Enum):
    RED = "red"
    BLUE = "blue"

def is_red_fixed(color):
    match color:
        case Color.RED:                  # dotted name → compared with ==
            return True
        case _:
            return False

print(is_red_fixed(Color.BLUE), is_red_fixed(Color.RED))   # False True
```

```python filename:Python
src = "match x:\n    case y:\n        pass\n    case 1:\n        pass\n"
try:
    compile(src, "<demo>", "exec")
except SyntaxError as e:
    print(e.msg)          # name capture 'y' makes remaining patterns unreachable
```

# Pattern kinds cheat sheet

| Pattern | Example | Matches |
| --- | --- | --- |
| Literal | `case 0:` `case "quit":` `case None:` | Equal value (`None`/`True`/`False` compared with `is`) |
| Capture | `case x:` | Anything; binds `x` |
| Wildcard | `case _:` | Anything; binds nothing |
| Value | `case Color.RED:` | Equal to a dotted constant |
| OR | `case 1 &#124; 2 &#124; 3:` | Any alternative |
| AS | `case [x, y] as pair:` | The inner pattern; binds the whole subject too |
| Sequence | `case [x, *rest]:` | Lists/tuples (not `str`/`bytes`) of the right length |
| Mapping | `case {"id": i}:` | Dicts containing those keys; `**rest` collects the others |
| Class | `case Point(x, y=0):` | `isinstance` + attribute patterns |

# When to use `match`

> [!TIP] Do
>
> Use `match` to branch on the <strong>shape</strong> of data: parsed commands, JSON events, AST nodes, tuples of states.

> [!DANGER] Avoid
>
> Using it as a glorified `switch` for simple value → value mapping — a `dict` lookup is shorter and faster.

```question
How is match different from a C/Java switch?

---

`switch` compares one value against constants. `match` tests <em>structure</em>: it can destructure lists, dicts and objects, bind variables, combine alternatives with `|`, and filter with guards. There is no fall-through and no `break` — the first matching case runs and the statement ends.
```

```question
Why does case RED: match every value?

---

A bare name is a capture pattern: it always matches and binds the subject to `RED`. Constants must be referenced with a dotted name (`Color.RED`, `module.RED`) so Python treats them as value patterns compared with `==`.
```

```question
How do positional class patterns like Point(0, y) work?

---

Python checks `isinstance(subject, Point)`, then maps positional sub-patterns to attribute names using `Point.__match_args__` — here `('x', 'y')` — and matches `subject.x` against `0` and binds `subject.y` to `y`. Dataclasses and named tuples define `__match_args__` automatically.
```
