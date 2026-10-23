---
id: bd9e0cc5-f008-7ee6-a7ed-0c55266db740
key: topic:python/advanced-decorators
subject: python
topic: advanced-decorators
title: Advanced Decorators
slug: advanced-decorators
order: 1
---

Beyond the basic wrapper: decorators with optional arguments, decorators that are classes, decorators <em>for</em> classes, registries, and the traps to avoid.

# Recap: the three shapes

| Usage | What Python calls | Your decorator must be |
| --- | --- | --- |
| `@d` | `f = d(f)` | a callable taking the function |
| `@d(3)` | `f = d(3)(f)` | a factory returning a decorator |
| `@d` on a class | `C = d(C)` | a callable taking the class |

# Optional arguments: `@d` and `@d(…)`

Make the function the first, optional positional parameter and the options keyword-only. If a function arrives, decorate it now; otherwise return a decorator.

```python filename:Python
import functools

def repeat(func=None, *, times=2):
    def decorator(f):
        @functools.wraps(f)
        def wrapper(*args, **kwargs):
            return [f(*args, **kwargs) for _ in range(times)]
        return wrapper
    if func is None:            # used as @repeat(times=3)
        return decorator
    return decorator(func)      # used as bare @repeat

@repeat
def hi():
    return "hi"

@repeat(times=3)
def yo():
    return "yo"

print(hi(), yo())   # ['hi', 'hi'] ['yo', 'yo', 'yo']
```

# Class-based decorators with state

Any callable can be a decorator. A class whose `__init__` takes the function and whose `__call__` runs it keeps state naturally in attributes.

```python filename:Python
import functools

class CountCalls:
    def __init__(self, func):
        functools.update_wrapper(self, func)   # copy __name__, __doc__
        self.func = func
        self.calls = 0

    def __call__(self, *args, **kwargs):
        self.calls += 1
        return self.func(*args, **kwargs)

@CountCalls
def add(a, b):
    """Add two numbers."""
    return a + b

add(1, 2); add(3, 4)
print(add.calls, add.__name__, add(5, 5))   # 2 add 10
```

> [!WARNING] Watch out
>
> A class-based decorator applied to a <strong>method</strong> breaks `self`: instances of `CountCalls` aren't descriptors, so `obj.method` doesn't bind. Add a `__get__` returning `functools.partial(self.__call__, obj)`, or use a function-based decorator for methods.

# Decorating methods

Function-based decorators work on methods unchanged — `self` simply arrives as the first element of `*args`.

```python filename:Python
import functools

def require_login(method):
    @functools.wraps(method)
    def wrapper(self, *args, **kwargs):
        if not self.logged_in:
            raise PermissionError(f"{method.__name__} needs login")
        return method(self, *args, **kwargs)
    return wrapper

class Account:
    def __init__(self):
        self.logged_in = False
    @require_login
    def balance(self):
        return 100

acc = Account()
try:
    acc.balance()
except PermissionError as e:
    print(e)                  # balance needs login
acc.logged_in = True
print(acc.balance())          # 100
```

# Class decorators

A class decorator receives the finished class and returns it (modified) or a replacement. `@dataclass` is the famous one — it reads the annotations and generates `__init__`, `__repr__` and `__eq__`.

```python filename:Python
def add_repr(cls):
    def __repr__(self):
        fields = ", ".join(f"{k}={v!r}" for k, v in vars(self).items())
        return f"{cls.__name__}({fields})"
    cls.__repr__ = __repr__
    return cls

def singleton(cls):
    instances = {}
    def get(*args, **kwargs):
        if cls not in instances:
            instances[cls] = cls(*args, **kwargs)
        return instances[cls]
    return get

@add_repr
class User:
    def __init__(self, name, age):
        self.name, self.age = name, age

@singleton
class Config:
    pass

print(User("asha", 30))           # User(name='asha', age=30)
print(Config() is Config())       # True
```

> [!WARNING] Watch out
>
> The `singleton` above replaces the class with a function, so `isinstance(x, Config)` no longer works. Decorators that <em>return the class</em> are safer than ones that replace it.

# Registries &amp; plugins

A decorator doesn't have to wrap anything — it can just <strong>record</strong> the function and return it unchanged. This is how Flask routes, pytest fixtures and CLI command groups work.

```python filename:Python
HANDLERS = {}

def on(event):
    def register(func):
        HANDLERS[event] = func
        return func               # unchanged
    return register

@on("signup")
def welcome(user):
    return f"welcome {user}"

@on("delete")
def goodbye(user):
    return f"bye {user}"

def dispatch(event, user):
    return HANDLERS[event](user)

print(sorted(HANDLERS))           # ['delete', 'signup']
print(dispatch("signup", "asha")) # welcome asha
```

# Stacking order

Decorators are <strong>applied</strong> bottom-up (closest to `def` first) but the wrappers <strong>run</strong> top-down, like layers of an onion.

```python filename:Python
import functools

def layer(name):
    def deco(f):
        print(f"apply {name}")
        @functools.wraps(f)
        def wrapper():
            print(f"enter {name}")
            result = f()
            print(f"exit {name}")
            return result
        return wrapper
    return deco

@layer("outer")
@layer("inner")
def work():
    print("work")

work()
```

```text filename:Output
apply inner
apply outer
enter outer
enter inner
work
exit inner
exit outer
```

> [!NOTE] Key point
>
> Order matters: `@app.route` above `@login_required` protects the route; the other way round registers the <em>unprotected</em> function. Similarly put `@cache` where you want the cache to sit relative to logging or timing.

# Validation from type hints

```python filename:Python
import functools, inspect

def enforce_types(func):
    sig = inspect.signature(func)
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        bound = sig.bind(*args, **kwargs)
        for name, value in bound.arguments.items():
            expected = func.__annotations__.get(name)
            if isinstance(expected, type) and not isinstance(value, expected):
                raise TypeError(f"{name} must be {expected.__name__}")
        return func(*args, **kwargs)
    return wrapper

@enforce_types
def repeat_text(text: str, n: int) -> str:
    return text * n

print(repeat_text("ab", 2))           # abab
try:
    repeat_text("ab", "2")
except TypeError as e:
    print(e)                          # n must be int
print(inspect.signature(repeat_text)) # (text: str, n: int) -> str
```

> [!NOTE] Key point
>
> `functools.wraps` sets `__wrapped__`, which `inspect.signature` follows — so the decorated function still shows its real signature in help, IDEs and docs.

# Decorators that are also context managers

```python filename:Python
from contextlib import ContextDecorator

class traced(ContextDecorator):
    def __init__(self, label):
        self.label = label
    def __enter__(self):
        print(f"start {self.label}")
        return self
    def __exit__(self, *exc):
        print(f"end {self.label}")
        return False

@traced("job")                    # as a decorator
def job():
    print("working")

job()
with traced("block"):             # as a with-statement
    print("inline")
```

```text filename:Output
start job
working
end job
start block
inline
end block
```

# Pitfalls

> [!NOTE] Forgetting wraps
>
> Name, docstring and signature are lost — confusing tracebacks, broken introspection.

> [!NOTE] Forgetting to return
>
> The wrapper must `return func(...)`, and the decorator must `return wrapper` — otherwise the function becomes `None`.

> [!NOTE] @d vs @d()
>
> A factory used without parentheses receives the function as its option argument — support both forms or be consistent.

> [!NOTE] Import-time side effects
>
> Decorator bodies run when the module is imported. Keep them cheap; do the work inside the wrapper.

```question
How do you write a decorator that accepts arguments?

---

Add a level: an outer function takes the arguments and returns the actual decorator, which takes the function and returns the wrapper. `@retry(times=3)` means `f = retry(times=3)(f)`.
```

```question
What is a class decorator? Give an example.

---

A callable that receives a class and returns a class (usually the same one, modified). `@dataclass` inspects the annotations and adds `__init__`, `__repr__` and `__eq__`; `@functools.total_ordering` adds comparison methods.
```

```question
In what order are stacked decorators applied?

---

Bottom-up: `@a @b def f` is `f = a(b(f))`. At call time the outermost wrapper (`a`) runs first and calls into `b`'s wrapper, which calls `f`.
```
