---
id: 4f2074fc-b6fe-781c-adb7-f585ee33d871
key: topic:python/interview-questions
subject: python
topic: interview-questions
title: Interview Questions
slug: interview-questions
order: 1
---

The Python questions that come up again and again — with short, precise answers you can say out loud.

# Core language

```question
What is the difference between a list and a tuple?

---

A list is <strong>mutable</strong> (append, remove, assign by index); a tuple is <strong>immutable</strong>. Tuples are hashable (if their items are), so they can be dict keys or set items, and they're slightly smaller and faster. Use tuples for fixed records and lists for collections that change.
```

```question
How is a Python dict implemented, and why are lookups O(1)?

---

It's a hash table. The key's `hash()` picks a slot; collisions are resolved with open addressing (probing). Average lookup, insert and delete are O(1); the worst case is O(n) with many collisions. Since 3.7 dicts preserve insertion order.
```

```question
What is the GIL?

---

The Global Interpreter Lock in CPython lets only one thread run Python bytecode at a time. Threads still help for <strong>I/O-bound</strong> work (the lock is released while waiting), but for <strong>CPU-bound</strong> work you use `multiprocessing` (separate processes, each with its own GIL) or native extensions.
```

```question
is vs ==?

---

`==` compares <strong>values</strong> (calls `__eq__`); `is` compares <strong>identity</strong> (same object in memory). Use `is` only for singletons such as `None`.
```

```question
What happens with a mutable default argument?

---

Defaults are evaluated once, when the function is defined, so `def f(x, items=[])` shares one list across calls. Use `items=None` and create the list inside the function.
```

```question
Shallow copy vs deep copy?

---

A shallow copy (`xs[:]`, `copy.copy`, `list(xs)`) creates a new container holding <strong>the same</strong> inner objects. A deep copy (`copy.deepcopy`) recursively copies the inner objects too, so nested changes don't leak between them.
```

# Functions &amp; objects

```question
What are \*args and \*\*kwargs?

---

`*args` collects extra positional arguments into a tuple; `**kwargs` collects extra keyword arguments into a dict. At the call site, `*` and `**` unpack a sequence or mapping into arguments.
```

```question
What is a decorator?

---

A callable that takes a function and returns a new one wrapping it. `@d` above `def f` means `f = d(f)`. Used for logging, timing, caching (`@cache`), access checks and registering routes. Use `functools.wraps` to keep the original name and docstring.
```

```question
Generator vs list — when would you use each?

---

A list stores every item in memory and can be iterated many times. A generator produces items lazily on demand, uses O(1) memory and can be iterated <strong>once</strong>. Use generators for large or infinite streams and pipelines; lists when you need indexing, `len` or repeated passes.
```

# Runtime, memory &amp; concurrency

```question
How does Python manage memory?

---

Objects live on a private heap. CPython frees an object as soon as its <strong>reference count</strong> drops to zero, and a generational <strong>garbage collector</strong> (`gc`) cleans up reference cycles that refcounting can't.
```

```question
What are @staticmethod and @classmethod?

---

An instance method receives `self`. A `@classmethod` receives the class (`cls`) — typically used for alternative constructors like `from_json`. A `@staticmethod` receives neither; it's a plain function grouped inside the class.
```

```question
Explain the MRO and super().

---

The Method Resolution Order is the sequence Python searches for attributes in a class hierarchy, computed by C3 linearization (`Class.__mro__`). `super()` delegates to the <strong>next</strong> class in that order, not necessarily the direct parent — enabling cooperative multiple inheritance.
```

```question
What does if \_\_name\_\_ == "\_\_main\_\_": do?

---

`__name__` is `"__main__"` only when the file is run directly. Code under the guard runs for `python file.py` but not when the module is imported — keeping imports free of side effects.
```

```question
How do you handle exceptions properly?

---

Catch specific exceptions, keep `try` blocks small, use `else` for code that should run only on success and `finally` (or `with`) for cleanup. Chain with `raise NewError(...) from e` to keep the cause, and never silence errors with a bare `except:`.
```

# Predict the output

```question
What is the output? (lists vs tuples with +=)

---

`x = [1, 2, 3]`<br>`y = x`<br>`y += [4]`<br>`print(x)          # [1, 2, 3, 4]`<br>`a = (1, 2)`<br>`b = a`<br>`b += (3,)`<br>`print(a, b)       # (1, 2) (1, 2, 3)`

Lists are mutable, so `+=` extends the shared list in place. Tuples are immutable, so `+=` builds a new tuple and rebinds only `b`.
```

```question
What is the output? (lambdas in a loop)

---

`funcs = [lambda: i * 10 for i in range(3)]`<br>`print([f() for f in funcs])     # [20, 20, 20]`

Closures look up `i` when called, after the loop ended with `i == 2`. Capture the current value with a default argument: `lambda i=i: i * 10`.
```

# Quick-fire checklist

Mutable vs immutable · List vs tuple vs set vs dict · Hashing &amp; dict keys · Comprehensions · Generators &amp; `yield` · Decorators · Closures &amp; LEGB · `*args` / `**kwargs` · Shallow vs deep copy · GIL &amp; concurrency · MRO &amp; `super()` · Dunder methods · Exceptions &amp; `with` · `@dataclass` · Big-O of built-ins · Descriptors &amp; `property` · `__new__` vs `__init__` · Metaclasses · Iterator protocol · `asyncio` vs threads · Type hints · `functools.cache` · Testing &amp; mocking

> [!NOTE] Next
>
> Go deeper with <em>Advanced Interview Questions</em> and test yourself with <em>Predict the Output</em>.
