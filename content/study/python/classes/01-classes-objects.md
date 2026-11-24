---
id: 6c9d2eae-33ce-7795-abd1-b2cb701f247e
key: topic:python/classes
subject: python
topic: classes
title: Classes & Objects
slug: classes-objects
order: 1
---

A class bundles data (attributes) and behaviour (methods). In Python everything — even functions and classes themselves — is an object.

# Anatomy of a class

```python filename:Python
class Account:
    bank = "LVN Bank"                   # class attribute: shared by all instances

    def __init__(self, owner, balance=0):
        self.owner = owner              # instance attributes: one per object
        self.balance = balance

    def deposit(self, amount):
        if amount <= 0:
            raise ValueError("amount must be positive")
        self.balance += amount
        return self.balance

a = Account("Asha")
b = Account("Ravi", 100)
a.deposit(50)
print(a.balance, b.balance, a.bank)     # 50 100 LVN Bank
```

> [!NOTE] __init__
>
> The <em>initializer</em>: runs after the object is created (`__new__` creates it) to set up its state.

> [!NOTE] self
>
> The instance the method was called on. `a.deposit(50)` is really `Account.deposit(a, 50)`.

> [!NOTE] Class attribute
>
> Defined in the class body, shared by every instance. Great for constants and counters.

> [!NOTE] Instance attribute
>
> Set on `self`, stored in the object's own `__dict__`.

> [!WARNING] Watch out
>
> A mutable <strong>class</strong> attribute (e.g. `items = []` in the class body) is shared by all instances. Create per-object lists in `__init__`.

# Three kinds of methods

```python filename:Python
class Temperature:
    def __init__(self, celsius):
        self.celsius = celsius

    def to_f(self):                      # instance method: gets self
        return self.celsius * 9 / 5 + 32

    @classmethod
    def from_f(cls, f):                  # class method: gets the class → alternative constructors
        return cls((f - 32) * 5 / 9)

    @staticmethod
    def is_freezing(c):                  # static method: a plain function in the class namespace
        return c <= 0

t = Temperature.from_f(212)
print(t.celsius, t.to_f(), Temperature.is_freezing(-3))   # 100.0 212.0 True
```

# Properties: attributes with logic

```python filename:Python
class Circle:
    def __init__(self, radius):
        self.radius = radius             # goes through the setter below

    @property
    def radius(self):
        return self._radius

    @radius.setter
    def radius(self, value):
        if value < 0:
            raise ValueError("radius must be >= 0")
        self._radius = value

    @property
    def area(self):                      # computed, read-only
        return round(3.14159 * self._radius ** 2, 2)

c = Circle(2)
print(c.area)                            # 12.57
try:
    c.radius = -1
except ValueError as e:
    print(e)                             # radius must be >= 0
```

# Encapsulation by convention

| Name | Meaning |
| --- | --- |
| `name` | Public API |
| `_name` | Internal — “please don't touch” (not enforced) |
| `__name` | Name-mangled to `_ClassName__name` to avoid clashes in subclasses |
| `__name__` | Special (dunder) names reserved for Python |

> [!NOTE] Key point
>
> Python has no `private` keyword. The culture is “we're all consenting adults”: mark internals with `_` and use properties when you need validation.
