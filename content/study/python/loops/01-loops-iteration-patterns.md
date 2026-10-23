---
id: 756a6e7a-52ec-7741-b100-3ab91dc646e3
key: topic:python/loops
subject: python
topic: loops
title: Loops & Iteration Patterns
slug: loops-iteration-patterns
order: 1
---

Python's `for` walks over <em>any iterable</em> — there is no C-style `for (i = 0; …)`. This topic collects the loop patterns, helpers and pitfalls you meet every day.

# `range` in detail

```python filename:Python
print(list(range(5)))                 # [0, 1, 2, 3, 4]
print(list(range(2, 12, 3)))          # [2, 5, 8, 11]
print(list(range(5, 0, -1)))          # [5, 4, 3, 2, 1]
print(list(range(3, 0)))              # []   ← empty: a negative step is needed to count down
r = range(0, 10**12, 2)               # no list is built — O(1) memory
print(len(r), r[10], r[-1])           # 500000000000 20 999999999998
print(999_999 in r, 1_000 in r)       # False True   ← O(1) arithmetic check
```

| Goal | Loop header |
| --- | --- |
| 0 … n−1 | `for i in range(n)` |
| 1 … n inclusive | `for i in range(1, n + 1)` |
| n−1 down to 0 | `for i in range(n - 1, -1, -1)` or `reversed(range(n))` |
| Every other index | `for i in range(0, n, 2)` |
| Items and their index | `for i, x in enumerate(xs)` |
| Two lists in step | `for a, b in zip(xs, ys)` |
| Neighbouring pairs | `for a, b in zip(xs, xs[1:])` or `itertools.pairwise(xs)` |

# `while` loops and `while … else`

Use `while` when you don't know the number of iterations in advance. Like `for`, it takes an `else` that runs only if the loop ended <strong>without</strong> `break`.

```python filename:Python
n, steps = 27, 0
while n != 1:                         # Collatz sequence
    n = n // 2 if n % 2 == 0 else 3 * n + 1
    steps += 1
print(steps)                          # 111

def is_prime(n):
    if n < 2:
        return False
    d = 2
    while d * d <= n:
        if n % d == 0:
            break                     # found a divisor
        d += 1
    else:
        return True                   # no break → no divisor found
    return False

print([k for k in range(20) if is_prime(k)])   # [2, 3, 5, 7, 11, 13, 17, 19]
```

```python filename:Python
attempts = 0
while True:                           # the do-while idiom: body runs at least once
    attempts += 1
    if attempts * attempts > 20:
        break
print(attempts)                       # 5
```

# Breaking out of nested loops

`break` only leaves the innermost loop. Three ways out of two:

```python filename:Python
grid = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]

# 1. A flag checked by the outer loop
found = None
for r, row in enumerate(grid):
    for c, val in enumerate(row):
        if val == 5:
            found = (r, c)
            break
    if found:
        break
print(found)                          # (1, 1)

# 2. Put the loops in a function and return (usually the cleanest)
def find(grid, target):
    for r, row in enumerate(grid):
        for c, val in enumerate(row):
            if val == target:
                return r, c
    return None
print(find(grid, 8), find(grid, 0))   # (2, 1) None

# 3. One flat loop over all coordinates
from itertools import product
hit = next(((r, c) for r, c in product(range(3), range(3)) if grid[r][c] == 9), None)
print(hit)                            # (2, 2)
```

# Iterating dicts, in order, in reverse, in parallel

```python filename:Python
prices = {"tea": 20, "coffee": 35, "juice": 50}
print([k for k in prices])                        # ['tea', 'coffee', 'juice']
print([f"{k}={v}" for k, v in prices.items()])    # ['tea=20', 'coffee=35', 'juice=50']
print(sorted(prices, key=prices.get, reverse=True))   # ['juice', 'coffee', 'tea']

names = ["asha", "ravi", "kiran"]
scores = [91, 84, 77]
print(list(enumerate(names, start=1)))    # [(1, 'asha'), (2, 'ravi'), (3, 'kiran')]
print(dict(zip(names, scores)))           # {'asha': 91, 'ravi': 84, 'kiran': 77}
print(list(zip(names, [1, 2])))           # [('asha', 1), ('ravi', 2)]   ← stops at the shortest
try:
    list(zip(names, [1, 2], strict=True)) # 3.10+: insist on equal lengths
except ValueError as e:
    print(e)                              # zip() argument 2 is shorter than argument 1
print(list(reversed(names)))              # ['kiran', 'ravi', 'asha']

pairs = [("a", 1), ("b", 2)]
letters, numbers = zip(*pairs)            # "unzip"
print(letters, numbers)                   # ('a', 'b') (1, 2)
```

# Don't modify a collection while looping over it

```python filename:Python
nums = [1, 2, 2, 3, 4]
for x in nums:
    if x % 2 == 0:
        nums.remove(x)        # shifts later items left → the loop skips one
print(nums)                   # [1, 2, 3]   ← a 2 survived!

nums = [1, 2, 2, 3, 4]
print([x for x in nums if x % 2])       # [1, 3]   ← build a new list instead

d = {"a": 1, "b": 2}
try:
    for k in d:
        if d[k] == 1:
            del d[k]
except RuntimeError as e:
    print(e)                  # dictionary changed size during iteration
d = {k: v for k, v in d.items() if v != 1}
print(d)                      # {'b': 2}
```

> [!NOTE] Build a new collection
>
> A comprehension that keeps what you want — the idiomatic fix.

> [!NOTE] Loop over a copy
>
> `for x in nums[:]:` or `for k in list(d):` — then mutating the original is safe.

> [!NOTE] Loop backwards by index
>
> `for i in range(len(xs) - 1, -1, -1): del xs[i]` — deletions don't shift unvisited items.

# Sentinel loops &amp; `iter(callable, sentinel)`

```python filename:Python
import io
from functools import partial

stream = io.StringIO("alpha\nbeta\n\ngamma\n")
lines = []
while (line := stream.readline().rstrip("\n")):   # stop at the first empty line
    lines.append(line)
print(lines)                                      # ['alpha', 'beta']

f = io.StringIO("abcdefgh")
chunks = list(iter(partial(f.read, 3), ""))       # call f.read(3) until it returns ""
print(chunks)                                     # ['abc', 'def', 'gh']
```

> [!NOTE] Key point
>
> The two-argument `iter(func, sentinel)` calls `func()` repeatedly and stops when it returns `sentinel` — perfect for reading fixed-size blocks from files and sockets.

# Loop variables &amp; scope

```python filename:Python
for i in range(3):
    pass
print(i)                      # 2   ← the loop variable survives the loop

squares = [j * j for j in range(3)]
print("j" in dir())           # False   ← comprehension variables don't leak
```

> [!WARNING] Watch out
>
> If the loop body never runs (empty iterable), the loop variable is never assigned — using it afterwards raises `NameError`.

# Faster loops

| Slower | Faster | Why |
| --- | --- | --- |
| `total = 0` + `for x in xs: total += x` | `sum(xs)` | Built-ins loop in C |
| Loop + `append` | List comprehension | No repeated `.append` lookup and call |
| `if x in big_list` inside a loop | Convert to a `set` once | O(1) instead of O(n) per check |
| `for i in range(len(xs)): xs[i]` | `for x in xs` | No indexing per step |
| `s += piece` in a loop | `''.join(pieces)` | Avoids O(n²) copying |
| `obj.method` looked up each time | `m = obj.method` before the loop | One attribute lookup instead of n |

```question
When would you use for … else?

---

For searches: the `else` runs only when the loop completed without `break`, i.e. when nothing was found. It replaces a separate `found = False` flag.
```

```question
How do you iterate over two lists at the same time?

---

`for a, b in zip(xs, ys)`. `zip` stops at the shortest input; use `zip(..., strict=True)` (3.10+) to raise on a length mismatch, or `itertools.zip_longest` to pad the shorter one.
```

```question
Why is removing items from a list while iterating over it a bug?

---

The list iterator walks by index. Removing an item shifts the rest left, so the item right after the removed one is skipped. Iterate over a copy, iterate backwards, or build a new list with a comprehension.
```
