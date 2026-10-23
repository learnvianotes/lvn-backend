---
id: 5ece1f24-31e5-7af2-aa47-777becea6e56
key: topic:python/inheritance
subject: python
topic: inheritance
title: Inheritance, MRO & super()
slug: inheritance-mro-super
order: 1
---

A subclass reuses and specialises its parent. Python supports multiple inheritance and resolves methods with a predictable order — the MRO.

# Inheritance &amp; overriding

```python filename:Python
class Animal:
    def __init__(self, name):
        self.name = name
    def speak(self):
        return "..."
    def describe(self):
        return f"{self.name} says {self.speak()}"

class Dog(Animal):
    def __init__(self, name, breed):
        super().__init__(name)           # let the parent set up its part
        self.breed = breed
    def speak(self):                     # override
        return "Woof"

d = Dog("Rex", "lab")
print(d.describe())                              # Rex says Woof
print(isinstance(d, Animal), issubclass(Dog, Animal))   # True True
```

> [!NOTE] Key point
>
> `describe` lives in `Animal` but calls `self.speak()` — Python looks it up on the actual object, so the `Dog` version runs. That's polymorphism.

# Multiple inheritance &amp; the MRO

> [!INFO]
>
> <strong>MRO (Method Resolution Order)</strong> — the order in which classes are searched for an attribute, computed with <em>C3 linearization</em>. See it with `Class.__mro__` or `Class.mro()`.

```python filename:Python
class A:
    def hello(self): return "A"
class B(A):
    def hello(self): return "B→" + super().hello()
class C(A):
    def hello(self): return "C→" + super().hello()
class D(B, C):
    def hello(self): return "D→" + super().hello()

print(D().hello())                          # D→B→C→A
print([k.__name__ for k in D.__mro__])      # ['D', 'B', 'C', 'A', 'object']
```

> [!WARNING] Watch out
>
> `super()` means “the <strong>next class in the MRO</strong>”, not “my parent”. In `D(B, C)`, `B`'s `super()` goes to `C`, not `A` — that's what makes cooperative multiple inheritance work.

# Abstract base classes

```python filename:Python
from abc import ABC, abstractmethod

class Shape(ABC):
    @abstractmethod
    def area(self) -> float: ...

class Square(Shape):
    def __init__(self, side):
        self.side = side
    def area(self):
        return self.side ** 2

print(Square(3).area())          # 9
try:
    Shape()
except TypeError:
    print("can't instantiate")   # can't instantiate
```

# Duck typing &amp; composition

> [!NOTE] Duck typing
>
> “If it walks like a duck…” — code relies on <em>what an object can do</em> (has `read()`, is iterable) rather than its class.

> [!NOTE] Composition over inheritance
>
> Hold other objects as attributes (`self.engine = Engine()`) instead of building deep class trees.

> [!NOTE] Mixins
>
> Small classes adding one capability (e.g. `JsonMixin.to_json`) combined through multiple inheritance.

> [!NOTE] Protocols
>
> `typing.Protocol` describes the methods a type needs — static duck typing for type checkers.
