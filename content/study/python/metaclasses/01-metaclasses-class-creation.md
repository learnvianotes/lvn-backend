---
id: 343ab22f-da61-753e-a55f-c1328db40de3
key: topic:python/metaclasses
subject: python
topic: metaclasses
title: Metaclasses & Class Creation
slug: metaclasses-class-creation
order: 1
---

Classes are objects too — created at runtime by a <em>metaclass</em>, which is `type` by default. Knowing how class creation works explains `__new__`, `__init_subclass__`, `ABC` and how frameworks like Django build models.

# Classes are objects created by type

```python filename:Python
class Dog:
    sound = "woof"

print(type(Dog), type(type))          # <class 'type'> <class 'type'>
print(isinstance(Dog, object))        # True

# The class statement is sugar for calling type(name, bases, namespace):
Cat = type("Cat", (), {"sound": "meow", "speak": lambda self: self.sound})
print(Cat().speak(), Cat.__name__)    # meow Cat
```

> [!INFO]
>
> <strong>Metaclass</strong> — the class of a class. `type(obj)` gives an object's class; `type(SomeClass)` gives its metaclass. Instances are made by classes; classes are made by metaclasses.

# What happens when `class` runs

1. <strong>Pick the metaclass</strong>

   The explicit `metaclass=` keyword, else the most derived metaclass of the bases, else `type`.

2. <strong>Prepare the namespace</strong>

   `metaclass.__prepare__(name, bases)` returns the mapping the body will fill (a plain `dict` by default).

3. <strong>Run the body</strong>

   The class body executes like a function body; every assignment and `def` lands in that namespace.

4. <strong>Create the class</strong>

   `metaclass(name, bases, namespace)` → `__new__` builds the class object, `__init__` initialises it.

5. <strong>Notify</strong>

   `type.__new__` calls `__set_name__` on each attribute (descriptors) and `__init_subclass__` on the parent.

6. <strong>Decorate</strong>

   Finally, class decorators are applied (`@dataclass` runs here).

# \_\_new\_\_ vs \_\_init\_\_

`__new__(cls, …)` <strong>creates</strong> and returns the instance; `__init__(self, …)` <strong>initialises</strong> it. You rarely override `__new__` — except for immutable types (whose value must be fixed at creation) and instance control such as singletons or caching.

```python filename:Python
class Singleton:
    _instance = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self, value):
        self.value = value            # NOTE: still runs on every call

a = Singleton(1)
b = Singleton(2)
print(a is b, a.value)                # True 2

class Celsius(float):                 # float is immutable → customise __new__, not __init__
    def __new__(cls, degrees):
        if degrees < -273.15:
            raise ValueError("below absolute zero")
        return super().__new__(cls, round(degrees, 1))

print(Celsius(21.456), Celsius(10) + 5)   # 21.5 15.0
```

> [!WARNING] Watch out
>
> If `__new__` returns an instance of the class, `__init__` is called on it <strong>every time</strong> — which is why `a.value` became 2 above. For a real singleton, a module-level instance is usually simpler.

# \_\_init\_subclass\_\_: the easy hook (preferred)

Most metaclass use cases are really “do something whenever a subclass is defined”. `__init_subclass__` (3.6+) does exactly that with an ordinary classmethod — no metaclass needed.

```python filename:Python
class Plugin:
    registry = {}

    def __init_subclass__(cls, /, name=None, **kwargs):
        super().__init_subclass__(**kwargs)
        Plugin.registry[name or cls.__name__.lower()] = cls

class CsvLoader(Plugin, name="csv"):     # class keyword arguments reach __init_subclass__
    pass

class JsonLoader(Plugin):
    pass

print(list(Plugin.registry))             # ['csv', 'jsonloader']
print(Plugin.registry["csv"] is CsvLoader)   # True
```

# Writing a metaclass

```python filename:Python
class RequireDocs(type):
    """Reject public methods without a docstring — checked when the class is defined."""
    def __new__(mcls, name, bases, ns):
        for attr, value in ns.items():
            if callable(value) and not attr.startswith("_") and not value.__doc__:
                raise TypeError(f"{name}.{attr} needs a docstring")
        return super().__new__(mcls, name, bases, ns)

class Service(metaclass=RequireDocs):
    def run(self):
        """Run the service."""

print(type(Service).__name__)            # RequireDocs
try:
    class Worker(Service):               # the metaclass is inherited by subclasses
        def stop(self):
            pass
except TypeError as e:
    print(e)                             # Worker.stop needs a docstring

class SingletonMeta(type):
    _instances = {}
    def __call__(cls, *args, **kwargs):  # runs on Config(...) — before __new__/__init__
        if cls not in cls._instances:
            cls._instances[cls] = super().__call__(*args, **kwargs)
        return cls._instances[cls]

class Config(metaclass=SingletonMeta):
    pass

print(Config() is Config())              # True
```

| Metaclass method | Runs when | Used for |
| --- | --- | --- |
| `__prepare__` | Before the class body | Custom namespace (e.g. record definition order, forbid duplicates) |
| `__new__` | Class object is created | Inspect / modify the namespace, validate, register |
| `__init__` | After `__new__` | Post-creation setup |
| `__call__` | `MyClass(...)` is called | Control instance creation: singletons, caching, pooling |

# Lighter alternatives

```python filename:Python
class Box:
    def __class_getitem__(cls, item):    # powers Box[int] without a metaclass
        return f"Box of {item.__name__}"

def add_repr(cls):                        # a class decorator: receives the finished class
    cls.__repr__ = lambda self: f"<{cls.__name__} {vars(self)}>"
    return cls

@add_repr
class Point:
    def __init__(self, x):
        self.x = x

from abc import ABC
print(Box[int], Point(3))                 # Box of int <Point {'x': 3}>
print(type(ABC).__name__)                 # ABCMeta
```

| Need | Reach for |
| --- | --- |
| Modify or register one class after it's built | Class decorator |
| React to every subclass being defined | `__init_subclass__` |
| Know the attribute name a field was assigned to | Descriptor `__set_name__` |
| Make `MyClass[...]` work | `__class_getitem__` |
| Change how the class namespace or `MyClass()` itself behaves | Metaclass |

> [!NOTE] Rule of thumb
>
> “Metaclasses are deeper magic than 99% of users should ever worry about. If you wonder whether you need them, you don't.” — Tim Peters

> [!WARNING] Watch out
>
> A class can have only one metaclass. Inheriting from two bases with unrelated metaclasses (e.g. an `ABC` and a Django model) raises `TypeError: metaclass conflict`.

# Interview angle

```question
What is a metaclass?

---

The class of a class — the object that creates class objects. The default is `type`. Defining `__new__`/`__init__`/`__call__` on a custom metaclass lets you customise class creation and instantiation. `ABCMeta`, Django's `ModelBase` and `EnumType` are real examples.
```

```question
What is the difference between \_\_new\_\_ and \_\_init\_\_?

---

`__new__` is a static method that creates and returns the new object; `__init__` receives that object and sets it up, returning `None`. Override `__new__` for immutable subclasses (`int`, `str`, `tuple`), singletons or instance caching.
```

```question
How would you auto-register every subclass of a base class?

---

Define `__init_subclass__` on the base and add `cls` to a registry dict. It's simpler and composes better than a metaclass, and it can take class keyword arguments (`class A(Base, name='a')`).
```
