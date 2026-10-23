---
id: 7062cf45-dbfa-7fc9-b789-1ad8ccb3b833
key: topic:python/object-model
subject: python
topic: object-model
title: Identity, Mutability & Copying
slug: identity-mutability-copying
order: 1
---

Every Python value is an object with an <strong>identity</strong>, a <strong>type</strong> and a <strong>value</strong>. Knowing which objects are shared, which can change, and how copies work explains most “spooky action at a distance” bugs.

> [!INFO]
>
> <strong>Object</strong> — a chunk of memory with an identity (`id(x)` — fixed for its lifetime), a type (`type(x)` — decides what it can do) and a value (which may or may not be allowed to change).

# Identity, type, value

```python filename:Python
a = [1, 2, 3]
b = a                      # a second name for the SAME object
c = [1, 2, 3]              # a different object with an equal value

print(a == c, a is c)      # True False
print(a is b, id(a) == id(b))   # True True
print(type(a) is list)     # True
```

| Question | Operator / function | Calls |
| --- | --- | --- |
| Same value? | `a == b` | `a.__eq__(b)` — can be customised |
| Same object? | `a is b` | compares identities — can't be overridden |
| Which object? | `id(a)` | an integer unique among <em>live</em> objects (the address in CPython) |
| What kind? | `type(a)`, `isinstance(a, T)` | `isinstance` also accepts subclasses |

> [!NOTE] Key point
>
> Use `is` only for singletons: `x is None`, `x is True`, sentinel objects. For everything else, compare values with `==`.

# Small-int cache &amp; string interning

CPython pre-creates the integers −5…256 and reuses (<em>interns</em>) many identifier-like strings, so equal values may <em>happen</em> to be the same object. That is an implementation detail — never write code whose result depends on it.

```python filename:Python
import sys

x = 256
y = int("256")             # built at run time, still the cached object
print(x is y)              # True

big1 = int("1000")
big2 = int("1000")
print(big1 == big2, big1 is big2)   # True False

s1 = "".join(["hello", " ", "world"])     # built at run time: not interned
s2 = sys.intern("hello world")
s3 = sys.intern(s1)                       # returns the canonical copy
print(s1 == s2, s3 is s2)                 # True True
```

> [!WARNING] Classic bug
>
> `if name is "admin":` may work in a REPL test and fail in production. Python 3.8+ even emits a `SyntaxWarning` for `is` with a literal.

# Mutable vs immutable

| Immutable — value can never change | Mutable — can change in place |
| --- | --- |
| `int`, `float`, `complex`, `bool`, `str`, `bytes` | `list`, `dict`, `set`, `bytearray` |
| `tuple`, `frozenset`, `range`, `None` | most user-defined class instances |

“Changing” an immutable object really creates a <strong>new</strong> object and rebinds the name. Mutating a mutable object is visible through <strong>every</strong> name that refers to it.

```python filename:Python
s = "hi"
before = id(s)
s += "!"                        # new str object, name rebound
print(id(s) == before)          # False

nums = [1]
before = id(nums)
nums += [2]                     # list.__iadd__ mutates in place
print(id(nums) == before)       # True
```

> [!NOTE] Key point
>
> Hashability follows immutability: `dict` keys and `set` items must be hashable, and a hash is only safe if the value can't change. That's why `tuple` and `frozenset` can be keys but `list` and `set` can't.

# Aliasing through function calls

```python filename:Python
def add_tax(prices):
    for i in range(len(prices)):
        prices[i] = round(prices[i] * 1.18, 2)     # mutates the caller's list!

cart = [100, 50]
add_tax(cart)
print(cart)                     # [118.0, 59.0]

def add_tax_safe(prices):
    return [round(p * 1.18, 2) for p in prices]   # new list, input untouched

cart = [100, 50]
print(add_tax_safe(cart), cart) # [118.0, 59.0] [100, 50]
```

> [!TIP] Do
>
> Return a new object from functions by default; if you must mutate an argument, say so in the name/docstring (`sort_in_place`) and return `None` like `list.sort`.

> [!DANGER] Avoid
>
> Silently mutating arguments the caller still uses — or storing a caller's list inside an object without copying it.

# Shallow vs deep copy

| Way | Result |
| --- | --- |
| `b = a` | No copy — just another name |
| `a[:]`, `list(a)`, `a.copy()`, `dict(d)`, `d.copy()`, `set(s)` | <strong>Shallow</strong>: new outer container, same inner objects |
| `copy.copy(x)` | Shallow copy of any object |
| `copy.deepcopy(x)` | <strong>Deep</strong>: recursively copies everything reachable |

```python filename:Python
import copy

config = {"name": "app", "ports": [80, 443]}
shallow = config.copy()
deep = copy.deepcopy(config)

config["name"] = "renamed"          # rebinding a key: only config changes
config["ports"].append(8080)        # mutating a shared inner list

print(shallow["name"], shallow["ports"])   # app [80, 443, 8080]
print(deep["name"], deep["ports"])         # app [80, 443]
```

> [!NOTE] Key point
>
> Immutable leaves (`int`, `str`, `tuple` of immutables) are never really copied — sharing them is safe, so `deepcopy` reuses them.

# deepcopy handles cycles; `__copy__` / `__deepcopy__`

`deepcopy` keeps a <em>memo</em> dict of objects already copied, so shared references stay shared and cycles don't recurse forever. Classes can customise copying with `__copy__` and `__deepcopy__(self, memo)`.

```python filename:Python
import copy

node = {"name": "a"}
node["self"] = node                 # a cycle
clone = copy.deepcopy(node)
print(clone["self"] is clone, clone is node)   # True False

shared = [0]
pair = [shared, shared]
pair_copy = copy.deepcopy(pair)
print(pair_copy[0] is pair_copy[1])            # True   ← sharing preserved

class Session:
    def __init__(self, user, cache):
        self.user, self.cache = user, cache
    def __deepcopy__(self, memo):
        # copy the user data, but share the (expensive) cache
        return Session(copy.deepcopy(self.user, memo), self.cache)

s = Session({"id": 1}, cache={"big": "data"})
t = copy.deepcopy(s)
print(t.user == s.user, t.user is s.user, t.cache is s.cache)   # True False True
```

# Puzzle: a tuple that changes

```python filename:Python
t = ([1, 2], "x")
try:
    t[0] += [3]                    # list.__iadd__ runs, THEN tuple item assignment fails
except TypeError as e:
    print(type(e).__name__)        # TypeError
print(t)                           # ([1, 2, 3], 'x')
```

`t[0] += [3]` is `t[0] = t[0].__iadd__([3])`: the list is extended in place first, then storing it back into the tuple raises. The error is real — and so is the mutation.

```question
What is the difference between is and ==?

---

`==` asks whether two objects have equal <strong>values</strong> (it calls `__eq__`). `is` asks whether two names refer to the <strong>same object</strong> (identical `id`). Use `is` for `None` and other singletons, `==` for everything else.
```

```question
Why does a is b return True for 256 but False for 1000?

---

CPython caches small integers from −5 to 256, so every 256 is the same object. Larger ints created at run time are separate objects. It's an implementation detail — compare numbers with `==`.
```

```question
When do you need a deep copy?

---

When the object contains <strong>mutable</strong> inner objects (lists of lists, dicts of lists, objects holding lists) and you want the copy to be fully independent. A shallow copy is enough for a flat list of immutable values.
```
