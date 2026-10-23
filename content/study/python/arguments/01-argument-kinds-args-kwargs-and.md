---
id: 6cd2372f-91ef-7d4b-ba4a-b6ecfbb0863e
key: topic:python/arguments
subject: python
topic: arguments
title: "Argument Kinds: *args, **kwargs, / and *"
slug: argument-kinds-args-kwargs-and
order: 1
---

A Python signature can say exactly how each parameter may be passed — by position, by name, or either — and can soak up any number of extras with `*args` and `**kwargs`.

# The full signature, in order

`def f(pos_only, /, pos_or_kw, *args, kw_only, **kwargs)`

| Part | Syntax | How callers pass it |
| --- | --- | --- |
| Positional-only | before `/` | Only by position: `f(1)` — `f(a=1)` is an error |
| Positional-or-keyword | between `/` and `*` | Either: `f(1)` or `f(b=1)` — the default kind |
| Variadic positional | `*args` | Extra positional values, collected into a <strong>tuple</strong> |
| Keyword-only | after `*` or `*args` | Only by name: `f(key=1)` |
| Variadic keyword | `**kwargs` | Extra named values, collected into a <strong>dict</strong> (must be last) |

```python filename:Python
def f(a, b=1, /, c=2, *args, d, e=5, **kwargs):
    return f"a={a} b={b} c={c} args={args} d={d} e={e} kwargs={kwargs}"

print(f(10, d=4))
# a=10 b=1 c=2 args=() d=4 e=5 kwargs={}
print(f(10, 20, 30, 40, 50, d=4, z=9))
# a=10 b=20 c=30 args=(40, 50) d=4 e=5 kwargs={'z': 9}
```

```text filename:Output
a=10 b=1 c=2 args=() d=4 e=5 kwargs={}
a=10 b=20 c=30 args=(40, 50) d=4 e=5 kwargs={'z': 9}
```

> [!NOTE] Key point
>
> Once a parameter has a default, every later <em>positional</em> parameter needs one too. Keyword-only parameters are exempt — `d` above has no default even though `c` does.

# Keyword-only parameters (`*`)

A bare `*` ends the positional parameters. Everything after it must be named at the call site — ideal for flags and options that would be unreadable as bare `True`/`False`.

```python filename:Python
def connect(host, port, *, timeout=10, retries=3):
    return f"{host}:{port} t={timeout} r={retries}"

print(connect("db", 5432, timeout=2))     # db:5432 t=2 r=3
try:
    connect("db", 5432, 2)                # which option is 2? Python refuses to guess
except TypeError as e:
    print(e)   # connect() takes 2 positional arguments but 3 were given
```

> [!TIP] Do
>
> `sort(items, reverse=True)` — boolean and option parameters keyword-only, so call sites explain themselves.

> [!DANGER] Avoid
>
> `process(data, True, False, 3)` — nobody can read that without opening the definition.

# Positional-only parameters (`/`, 3.8+)

Parameters before `/` can't be passed by name. Many built-ins work this way (`len(obj=…)` is an error). It lets a library rename parameters later without breaking callers, and frees the name for `**kwargs`.

```python filename:Python
def distance(x, y, /):
    return (x * x + y * y) ** 0.5

print(distance(3, 4))                  # 5.0
try:
    distance(x=3, y=4)
except TypeError as e:
    print(type(e).__name__)            # TypeError

def format_row(name, /, **fields):     # 'name' can ALSO appear as a field
    return f"{name}: {fields}"

print(format_row("user", name="asha"))  # user: {'name': 'asha'}
```

# `*args` and `**kwargs`

```python filename:Python
def total(*nums):
    return sum(nums)

def tag(name, **attrs):
    parts = " ".join(f'{k}="{v}"' for k, v in attrs.items())
    return f"<{name} {parts}>"

print(total(), total(1, 2, 3))                 # 0 6
print(tag("a", href="/home", id="nav"))        # <a href="/home" id="nav">
```

> [!NOTE] Key point
>
> The names `args` and `kwargs` are only convention — the `*` and `**` do the work. Use descriptive names when they help: `*paths`, `**options`.

# Unpacking at the call site

```python filename:Python
def point(x, y, z=0):
    return (x, y, z)

coords = [1, 2]
opts = {"z": 9}
print(point(*coords))                  # (1, 2, 0)
print(point(*coords, **opts))          # (1, 2, 9)
print(point(**{"x": 5, "y": 6}))       # (5, 6, 0)

defaults = {"z": 1}
overrides = {"z": 3}
print(point(0, 0, **{**defaults, **overrides}))   # (0, 0, 3)   ← merge first, later wins
print(max(*[4, 8, 2]), *"abc")         # 8 a b c
```

> [!WARNING] Watch out
>
> Passing the same keyword twice is an error, even through unpacking: `point(1, 2, z=0, **{"z": 9})` raises `TypeError: got multiple values for keyword argument 'z'`. Merge the dicts first.

```python filename:Python
def point(x, y, z=0):
    return (x, y, z)
try:
    point(1, 2, z=0, **{"z": 9})
except TypeError as e:
    print(type(e).__name__, "multiple values" in str(e))   # TypeError True
try:
    point(1, x=1)
except TypeError as e:
    print(e)   # point() got multiple values for argument 'x'
```

# Forwarding arguments

`*args, **kwargs` in a wrapper accepts <em>anything</em> and passes it on unchanged — the core trick behind decorators, proxies and subclass constructors.

```python filename:Python
import functools

def logged(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        shown = [repr(a) for a in args] + [f"{k}={v!r}" for k, v in kwargs.items()]
        print(f"{func.__name__}({', '.join(shown)})")
        return func(*args, **kwargs)
    return wrapper

@logged
def power(base, exp=2):
    return base ** exp

print(power(3, exp=3))
```

```text filename:Output
power(3, exp=3)
27
```

# Inspecting a signature

```python filename:Python
import inspect

def f(a, /, b, *args, c, d=1, **kw):
    pass

sig = inspect.signature(f)
print(str(sig))                  # (a, /, b, *args, c, d=1, **kw)
print([p.kind.name for p in sig.parameters.values()])
# ['POSITIONAL_ONLY', 'POSITIONAL_OR_KEYWORD', 'VAR_POSITIONAL', 'KEYWORD_ONLY', 'KEYWORD_ONLY', 'VAR_KEYWORD']
bound = sig.bind(1, 2, 3, c=4)
print(bound.arguments)           # {'a': 1, 'b': 2, 'args': (3,), 'c': 4}
```

```text filename:Output
(a, /, b, *args, c, d=1, **kw)
['POSITIONAL_ONLY', 'POSITIONAL_OR_KEYWORD', 'VAR_POSITIONAL', 'KEYWORD_ONLY', 'KEYWORD_ONLY', 'VAR_KEYWORD']
{'a': 1, 'b': 2, 'args': (3,), 'c': 4}
```

# Defaults are evaluated once

```python filename:Python
import time

def stamp(when=time.time()):      # evaluated ONCE, at def time
    return when

print(stamp() == stamp())         # True   ← same frozen value every call

def stamp_ok(when=None):
    return time.time() if when is None else when
```

> [!NOTE] Key point
>
> Same rule as the mutable-default trap: use `None` as a sentinel and compute the real default inside the function. If `None` is a valid value, use a private sentinel: `_MISSING = object()`.

```question
What are \*args and \*\*kwargs?

---

In a definition, `*args` collects extra positional arguments into a tuple and `**kwargs` collects extra keyword arguments into a dict. In a call, `*seq` and `**mapping` do the reverse — unpack into separate arguments.
```

```question
What do / and \* mean in a parameter list?

---

Parameters before `/` are positional-only; parameters after `*` (or after `*args`) are keyword-only. So in `def f(a, /, b, *, c)`, `a` must be positional, `c` must be named, and `b` can be either.
```

```question
Why make parameters keyword-only?

---

Readability and safety: `resize(img, 100, 200, True)` becomes `resize(img, width=100, height=200, keep_ratio=True)`, arguments can't be swapped by accident, and you can add or reorder options later without breaking callers.
```
