---
id: 8677e733-5ef6-791d-8adc-2efb51425732
key: topic:python/properties-descriptors
subject: python
topic: properties-descriptors
title: Properties & Descriptors
slug: properties-descriptors
order: 1
---

`@property` turns method calls into plain attribute access. Underneath it sits the <em>descriptor protocol</em> — the same mechanism that powers methods, `classmethod`, `staticmethod`, `__slots__` and `cached_property`.

# property recap: getter, setter, deleter

Start with plain public attributes. When you later need validation or a computed value, swap in a `property` — callers keep writing `obj.attr` and nothing breaks. That is why Python code has no `getX()`/`setX()` boilerplate.

```python filename:Python
class Temperature:
    def __init__(self, celsius):
        self.celsius = celsius            # goes through the setter → validated from the start

    @property
    def celsius(self):                    # getter
        return self._celsius

    @celsius.setter
    def celsius(self, value):             # setter: validation lives here
        if value < -273.15:
            raise ValueError("below absolute zero")
        self._celsius = value

    @celsius.deleter
    def celsius(self):                    # deleter: runs on `del t.celsius`
        del self._celsius

    @property
    def fahrenheit(self):                 # computed and read-only (no setter)
        return self._celsius * 9 / 5 + 32

t = Temperature(100)
print(t.celsius, t.fahrenheit)            # 100 212.0
t.celsius = 0
print(t.fahrenheit)                       # 32.0
try:
    t.fahrenheit = 50
except AttributeError as e:
    print(type(e).__name__)               # AttributeError
del t.celsius
print(hasattr(t, "_celsius"))             # False
```

| Pattern | How |
| --- | --- |
| Read-only attribute | `@property` with no setter — assignment raises `AttributeError` |
| Validated attribute | Setter checks the value, stores it in `self._name` |
| Computed attribute | Getter derives it from other fields — never goes stale |
| Lazy + cached | `@functools.cached_property` — computed once, then stored |

> [!WARNING] Watch out
>
> Inside the getter, return `self._celsius`, not `self.celsius` — the latter calls the getter again and recurses until `RecursionError`.

# How `obj.attr` is looked up

> [!INFO]
>
> <strong>Descriptor</strong> — any object whose class defines `__get__`, `__set__` or `__delete__`, stored as a <strong>class</strong> attribute. Accessing it through an instance calls those methods instead of returning the object itself.

| Kind | Defines | Priority vs the instance `__dict__` | Examples |
| --- | --- | --- | --- |
| <strong>Data</strong> descriptor | `__get__` + `__set__` (or `__delete__`) | Wins over `obj.__dict__` | `property`, `__slots__` members |
| <strong>Non-data</strong> descriptor | only `__get__` | Loses to `obj.__dict__` | functions (methods), `classmethod`, `staticmethod`, `cached_property` |

1. <strong>Data descriptor on the class?</strong>

   Search `type(obj).__mro__`. If the attribute found there is a data descriptor, call its `__get__` and stop.

2. <strong>Instance dictionary</strong>

   Otherwise, if the name is in `obj.__dict__`, return that value.

3. <strong>Non-data descriptor or class attribute</strong>

   Otherwise use what was found on the class: call `__get__` if it has one, else return it as is.

4. <strong>`__getattr__`</strong><strong> fallback</strong>

   Still nothing? Call `__getattr__(name)` if the class defines it, else raise `AttributeError`.

```python filename:Python
class Demo:
    @property
    def p(self):
        return "property"
    def m(self):
        return "method"

d = Demo()
d.__dict__["p"] = "instance value"       # sneak values straight into the instance dict
d.__dict__["m"] = lambda: "instance value"
print(d.p)       # property        ← data descriptor beats the instance dict
print(d.m())     # instance value  ← the instance dict beats a non-data descriptor
```

> [!NOTE] Key point
>
> All of this is implemented in `object.__getattribute__`, which runs for <strong>every</strong> attribute access.

# Writing a reusable descriptor

A property is tied to one attribute of one class. When many attributes need the same rule, write the rule once as a descriptor class and reuse it.

```python filename:Python
class Positive:
    """A validated numeric field, reusable across classes."""
    def __set_name__(self, owner, name):      # called when the owning class is created
        self.name = name
        self.private = "_" + name

    def __get__(self, obj, objtype=None):
        if obj is None:                        # accessed on the class, not an instance
            return self
        return getattr(obj, self.private)

    def __set__(self, obj, value):
        if not isinstance(value, (int, float)) or value <= 0:
            raise ValueError(f"{self.name} must be a positive number, got {value!r}")
        setattr(obj, self.private, value)

class Product:
    price = Positive()
    qty = Positive()

    def __init__(self, name, price, qty):
        self.name, self.price, self.qty = name, price, qty

p = Product("pen", 20, 3)
print(p.price * p.qty)            # 60
try:
    p.qty = -1
except ValueError as e:
    print(e)                      # qty must be a positive number, got -1
print(Product.price.name)         # price
print(sorted(vars(p)))            # ['_price', '_qty', 'name']
```

> [!NOTE] __set_name__(owner, name)
>
> Tells the descriptor which attribute name it was assigned to (3.6+) — no need to repeat the name.

> [!NOTE] __get__(obj, objtype)
>
> `obj` is the instance, or `None` when accessed on the class — return `self` then.

> [!NOTE] __set__(obj, value)
>
> Having it makes this a <em>data</em> descriptor, so it always intercepts assignment.

> [!NOTE] Where to store the value
>
> On the instance (`obj._name`) — storing on the descriptor would share one value across all instances.

# Methods are descriptors too

A function in a class body is a non-data descriptor. `obj.method` calls `function.__get__(obj, type(obj))`, which returns a <strong>bound method</strong> with `obj` pre-filled as `self`.

```python filename:Python
class Greeter:
    def hello(self, name):
        return f"hi {name}"

g = Greeter()
f = Greeter.__dict__["hello"]           # the plain function stored in the class
bound = f.__get__(g, Greeter)           # exactly what `g.hello` does
print(bound("asha"))                    # hi asha
print(bound.__self__ is g)              # True
print(type(g.hello).__name__, type(Greeter.hello).__name__)   # method function
print(hasattr(property, "__set__"), hasattr(f, "__set__"))    # True False
```

| Built-in | Descriptor kind | `__get__` returns |
| --- | --- | --- |
| function | non-data | a bound method (instance) or the function (class) |
| `classmethod` | non-data | a method bound to the <strong>class</strong> |
| `staticmethod` | non-data | the underlying function, unbound |
| `property` | data | the getter's result |
| `__slots__` entry | data (`member_descriptor`) | the value in the object's fixed slot |

# `__getattr__`, `__getattribute__` &amp; `__setattr__`

```python filename:Python
class Config:
    def __init__(self, **values):
        object.__setattr__(self, "_values", values)   # bypass our own __setattr__

    def __getattr__(self, name):          # only called when normal lookup FAILS
        try:
            return self._values[name]
        except KeyError:
            raise AttributeError(name) from None

    def __setattr__(self, name, value):   # called for EVERY assignment
        raise AttributeError(f"Config is read-only ({name})")

c = Config(debug=True, level=3)
print(c.debug, c.level)                   # True 3
print(getattr(c, "missing", "n/a"))       # n/a
try:
    c.level = 5
except AttributeError as e:
    print(e)                              # Config is read-only (level)
```

| Hook | Runs | Typical use |
| --- | --- | --- |
| `__getattr__` | Only when the attribute is <strong>not found</strong> normally | Proxies, dynamic attributes, lazy loading |
| `__getattribute__` | On <strong>every</strong> attribute read | Rarely — access logging, very special proxies |
| `__setattr__` / `__delattr__` | On every assignment / deletion | Immutability, change tracking |

> [!WARNING] Watch out
>
> Inside `__getattribute__` or `__setattr__`, never use `self.x` for your own storage — it re-enters the hook and recurses. Call `object.__getattribute__(self, name)` / `super().__setattr__(name, value)`.

# cached\_property

```python filename:Python
from functools import cached_property

class Report:
    def __init__(self, rows):
        self.rows = rows
        self.calls = 0

    @cached_property
    def total(self):                 # expensive work, done once per instance
        self.calls += 1
        return sum(self.rows)

r = Report([1, 2, 3])
print(r.total, r.total, r.calls)     # 6 6 1
print("total" in r.__dict__)         # True  ← the result now lives in the instance dict
del r.total                          # invalidate the cache
print(r.total, r.calls)              # 6 2
```

> [!NOTE] Key point
>
> `cached_property` is a <em>non-data</em> descriptor: after the first call the value sits in `obj.__dict__` and shadows it, so later reads cost nothing. It needs a per-instance `__dict__`, so it doesn't work with `__slots__`.

# Interview angle

```question
What is a descriptor?

---

An object stored as a class attribute whose class implements `__get__`, `__set__` and/or `__delete__`. Attribute access on instances is routed through those methods. Properties, methods, `classmethod`, `staticmethod` and `__slots__` are all built on descriptors.
```

```question
Data vs non-data descriptor?

---

A data descriptor defines `__set__` or `__delete__` and takes priority over the instance `__dict__`. A non-data descriptor defines only `__get__` and can be shadowed by a value in the instance `__dict__` — that's how `cached_property` caches, and why you can monkey-patch a method on one instance.
```

```question
\_\_getattr\_\_ vs \_\_getattribute\_\_?

---

`__getattribute__` is called for every attribute access; `__getattr__` is called only after normal lookup fails. Override `__getattr__` for fallbacks and proxies; override `__getattribute__` only if you really must intercept everything.
```

```question
When would you write a descriptor instead of a property?

---

When the same logic (validation, type conversion, lazy loading, ORM columns) must apply to many attributes or many classes. A property is one-off; a descriptor is a reusable attribute type — like Django model fields or SQLAlchemy columns.
```
