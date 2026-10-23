---
id: 9c7edc76-9fc9-70ce-b7dd-ef0c3788a451
key: topic:python/variables-types
subject: python
topic: variables-types
title: Variables, Types & Operators
slug: variables-types-operators
order: 1
---

A variable is a <em>name bound to an object</em>. Every object has an identity, a type and a value.

> [!INFO]
>
> <strong>Name binding</strong> — `x = 10` creates an `int` object and binds the name `x` to it. Assignment never copies — it only attaches another name to the same object.

# Built-in types

| Type | Example | Mutable? |
| --- | --- | --- |
| `int` | `42`, `-7`, `10**100` (unlimited size) | No |
| `float` | `3.14`, `1e-9` (64-bit IEEE 754) | No |
| `complex` | `2 + 3j` | No |
| `bool` | `True`, `False` (a subclass of `int`) | No |
| `str` | `'hi'`, `"hi"`, `'''multi'''` | No |
| `NoneType` | `None` — the single “no value” object | No |
| `list` / `dict` / `set` | `[1, 2]`, `{'a': 1}`, `{1, 2}` | <strong>Yes</strong> |
| `tuple` / `frozenset` | `(1, 2)`, `frozenset({1})` | No |

```python filename:Python
x = 10
print(type(x))                    # <class 'int'>
x = "now a string"                # same name, different object and type
print(isinstance(x, str))         # True
print(True + True)                # 2
```

# Operators at a glance

Arithmetic `+ - * / // % **`, comparison `== != < <= > >=` (chainable), logical `and or not`, identity `is`, membership `in`, bitwise `& | ^ ~ << >>` and the walrus `:=`. The next topic, <strong>Operators &amp; Precedence</strong>, covers each one in depth.

```python filename:Python
print(7 / 2, 7 // 2, 7 % 2, -7 // 2)   # 3.5 3 1 -4
print(2 ** 10, divmod(17, 5))          # 1024 (3, 2)
print(0 < 5 < 10)                      # True
print("" or "default", 0 and 99)       # default 0
if (n := len("hello")) > 3:
    print(n)                           # 5
```

# `==` vs `is`

> [!NOTE] == — equality
>
> Calls `__eq__`: do the two objects have the <em>same value</em>?

> [!NOTE] is — identity
>
> Are they the <em>same object</em> in memory (same `id`)? Use only for singletons: `None`, `True`, `False`.

```python filename:Python
a = [1, 2, 3]
b = [1, 2, 3]
c = a
print(a == b, a is b, a is c)   # True False True
```

> [!WARNING] Watch out
>
> CPython caches small integers (−5…256) and some strings, so `a is b` may be `True` for them by accident. Never rely on it — compare values with `==`.

# Truthiness

In a condition, every object is truthy except these <strong>falsy</strong> values:

`False` · `None` · `0`, `0.0`, `0j` · `''` · `[]` · `()` · `{}` · `set()` · `range(0)`

```python filename:Python
items = []
if not items:              # idiomatic emptiness check
    print("empty")         # empty
print(bool("0"), bool(0))  # True False
```

# Type conversion

```python filename:Python
print(int("42") + 1, float("2.5"), str(99) + "!")   # 43 2.5 99!
print(int(3.99), round(2.5), round(3.5))            # 3 2 4
print(int("ff", 16), bin(10), hex(255))             # 255 0b1010 0xff
```

> [!NOTE] Key point
>
> `round()` uses <em>banker's rounding</em>: halves go to the nearest even number, so `round(2.5) == 2`.
