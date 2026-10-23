---
id: 273a4920-7367-7788-884a-d333f608fcd8
key: topic:python/scope-closures
subject: python
topic: scope-closures
title: Scope & Closures
slug: scope-closures
order: 1
---

Python resolves names with the LEGB rule, and inner functions can <em>close over</em> variables from the function that created them.

# LEGB: where a name is looked up

1. <strong>Local</strong>

   Names assigned inside the current function.

2. <strong>Enclosing</strong>

   Locals of any enclosing (outer) functions.

3. <strong>Global</strong>

   Names at the top level of the module.

4. <strong>Built-in</strong>

   `len`, `print`, `range`, … from the `builtins` module.

```python filename:Python
x = "global"

def outer():
    x = "enclosing"
    def inner():
        return x              # found in the enclosing scope
    return inner()

print(outer(), x)             # enclosing global
```

# `global` and `nonlocal`

Assigning to a name makes it local to that function. To rebind an outer name, declare it first.

```python filename:Python
count = 0

def bump():
    global count
    count += 1

def make_counter():
    n = 0
    def inc():
        nonlocal n            # rebinding the enclosing variable
        n += 1
        return n
    return inc

bump(); bump()
c = make_counter()
c(); c()
print(count, c())             # 2 3
```

> [!WARNING] Watch out
>
> Without `nonlocal`, `n += 1` inside `inc` raises `UnboundLocalError`: the assignment makes `n` local, so reading it before assigning fails.

# Closures

> [!INFO]
>
> <strong>Closure</strong> — a function object that remembers variables from the scope where it was defined, even after that scope has finished running.

```python filename:Python
def multiplier(k):
    def times(x):
        return x * k          # k is captured
    return times

double, triple = multiplier(2), multiplier(3)
print(double(5), triple(5))                       # 10 15
print(double.__closure__[0].cell_contents)        # 2
```

# Late binding in loops

```python filename:Python
# Every lambda sees the final value of i:
fns = [lambda: i for i in range(3)]
print([f() for f in fns])          # [2, 2, 2]

# A default argument captures each value at definition time:
fns = [lambda i=i: i for i in range(3)]
print([f() for f in fns])          # [0, 1, 2]
```

> [!NOTE] Key point
>
> Closures capture <em>variables</em>, not values. The value is read when the function is <strong>called</strong>.
