---
id: aaaf4b48-5454-75be-82c7-56e4574286aa
key: topic:python/functions
subject: python
topic: functions
title: Functions & Arguments
slug: functions-arguments
order: 1
---

Functions are first-class objects: you can pass them around, return them, and store them — and Python's argument system is unusually flexible.

# Defining &amp; returning

```python filename:Python
def area(w: float, h: float = 1.0) -> float:
    """Return the area of a w × h rectangle."""
    return w * h

def min_max(xs):
    return min(xs), max(xs)          # "multiple" return = one tuple

lo, hi = min_max([4, 1, 9])
print(area(3, 2), area(5), lo, hi)   # 6 5.0 1 9
print(area.__doc__)                  # Return the area of a w × h rectangle.
```

> [!NOTE] Key point
>
> A function with no `return` (or a bare `return`) returns `None`. Type hints are documentation — Python does not enforce them at runtime.

# Kinds of parameters

| Kind | Syntax | Call as |
| --- | --- | --- |
| Positional or keyword | `def f(a, b)` | `f(1, 2)` or `f(b=2, a=1)` |
| Default value | `def f(a, b=10)` | `f(1)` |
| Variadic positional | `def f(*args)` | `f(1, 2, 3)` → `args == (1, 2, 3)` |
| Variadic keyword | `def f(**kwargs)` | `f(x=1)` → `kwargs == {'x': 1}` |
| Keyword-only | `def f(a, *, key)` | `f(1, key=2)` — `key` must be named |
| Positional-only | `def f(a, /, b)` | `f(1, 2)` — `a` can't be named |

```python filename:Python
def report(title, *items, sep=", ", **meta):
    line = f"{title}: {sep.join(items)}"
    if meta:
        line += f" {meta}"
    return line

print(report("fruits", "apple", "kiwi"))             # fruits: apple, kiwi
print(report("ids", "1", "2", sep="|", source="db"))  # ids: 1|2 {'source': 'db'}

opts = {"sep": "-"}
print(report("unpacked", *["a", "b"], **opts))       # unpacked: a-b
```

# The mutable default trap

Default values are evaluated <strong>once</strong>, when `def` runs — not on each call. A mutable default is shared by every call.

```python filename:Python
def add_bad(item, bucket=[]):
    bucket.append(item)
    return bucket

print(add_bad(1), add_bad(2))     # [1, 2] [1, 2]

def add_good(item, bucket=None):
    if bucket is None:
        bucket = []
    bucket.append(item)
    return bucket

print(add_good(1), add_good(2))   # [1] [2]
```

> [!WARNING] Rule
>
> Use `None` as the default for lists, dicts and sets, and create the object inside the function.

# How arguments are passed

> [!INFO]
>
> <strong>Pass by object reference</strong> — the function receives a reference to the <em>same object</em>. Mutating it is visible to the caller; rebinding the parameter name is not.

```python filename:Python
def mutate(xs):
    xs.append(99)      # changes the caller's list

def rebind(xs):
    xs = [0]           # only changes the local name

data = [1]
mutate(data); rebind(data)
print(data)            # [1, 99]
```

> [!NOTE] Next
>
> Argument kinds (`/`, `*`, `*args`, `**kwargs`) and recursion each have their own topic next — this one covers the essentials.
