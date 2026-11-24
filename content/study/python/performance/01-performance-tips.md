---
id: 16fb2b70-d919-76a9-a97e-6e44ad9edf79
key: topic:python/performance
subject: python
topic: performance
title: Performance Tips
slug: performance-tips
order: 1
---

Fast Python comes from choosing the right algorithm and data structure, then letting C-implemented built-ins do the looping. Measure before and after every change.

> [!NOTE] Rule zero
>
> “Premature optimisation is the root of all evil.” Write clear code first, profile (<em>Debugging &amp; Profiling</em>), then optimise the hotspot the profiler shows you.

# 1. Algorithms and data structures first

```python filename:Python
emails = [f"user{i}@x.com" for i in range(5_000)]
blocked = [f"user{i}@x.com" for i in range(0, 5_000, 7)]

# O(n·m): "in list" scans the whole list every time
slow = [e for e in emails if e not in blocked]

# O(n + m): build a set once, then O(1) lookups
blocked_set = set(blocked)
fast = [e for e in emails if e not in blocked_set]

print(slow == fast, len(fast))       # True 4285
```

| Instead of | Use | Why |
| --- | --- | --- |
| `x in list` inside a loop | `x in set` / `dict` | O(n) → O(1) |
| `list.pop(0)` / `insert(0, x)` | `collections.deque` | O(n) → O(1) at both ends |
| Repeated `min()` of a changing list | `heapq` | O(n) → O(log n) |
| Linear search in sorted data | `bisect` | O(n) → O(log n) |
| Recomputing the same results | `functools.cache` | Exponential → linear for DP-style recursion |
| Counting with a manual dict | `collections.Counter` | Written in C, clearer |

# 2. Let built-ins do the looping

```python filename:Python
nums = list(range(1, 100_001))

total = 0
for n in nums:                        # interpreted, one bytecode loop per item
    total += n * n

fast_total = sum(n * n for n in nums)   # sum() runs in C
print(total == fast_total)              # True

words = ["b", "a", "c"] * 3
print("".join(sorted(set(words))))      # abc   ← set, sorted, join: all C
print(max(nums), any(n > 99_999 for n in nums))   # 100000 True
```

> [!NOTE] Comprehensions
>
> Faster than `for` + `append` — the loop runs with less bytecode overhead.

> [!NOTE] str.join
>
> Build strings from a list of parts; `+=` in a loop can copy repeatedly.

> [!NOTE] map with built-ins
>
> `list(map(int, parts))` avoids a Python-level lambda call per item.

> [!NOTE] Batch operations
>
> `list.extend`, `dict.update`, `set.update` instead of item-by-item loops.

# 3. Reduce work inside hot loops

```python filename:Python
import math

def distances_slow(points):
    result = []
    for x, y in points:
        result.append(math.sqrt(x * x + y * y))    # attribute lookups every iteration
    return result

def distances_fast(points):
    hypot = math.hypot                               # hoist the lookup into a local
    return [hypot(x, y) for x, y in points]          # comprehension + a specialised C function

pts = [(3, 4), (6, 8), (5, 12)]
print(distances_slow(pts) == distances_fast(pts), distances_fast(pts))   # True [5.0, 10.0, 13.0]
```

- Local variables are faster than globals and attribute lookups (`self.x`, `module.func`) — hoist them out of tight loops.
- Move invariant work (compiling a regex, building a set) outside the loop.
- Avoid exceptions for normal control flow inside very hot loops — but `try` itself is free when nothing is raised (3.11+).
- Use generators to stream large data instead of building huge lists: less memory means fewer cache misses and GC pauses.

# 4. Memory: slots, generators, arrays

```python filename:Python
import sys
from array import array

class PointDict:
    def __init__(self, x, y):
        self.x, self.y = x, y

class PointSlots:
    __slots__ = ("x", "y")
    def __init__(self, x, y):
        self.x, self.y = x, y

a, b = PointDict(1, 2), PointSlots(1, 2)
print(hasattr(a, "__dict__"), hasattr(b, "__dict__"))   # True False

as_list = list(range(100_000))
as_array = array("i", range(100_000))                    # packed 4-byte C ints
print(sys.getsizeof(as_array) < sys.getsizeof(as_list))  # True
```

# 5. Cache and precompute

```python filename:Python
from functools import cache

@cache
def ways(n):                  # count paths — exponential without the cache
    return 1 if n < 2 else ways(n - 1) + ways(n - 2)

print(ways(200))              # 453973694165307953197296969697410619233826
print(ways.cache_info().hits > 0)   # True
```

# 6. When pure Python isn't enough

| Tool | How it helps | Best for |
| --- | --- | --- |
| NumPy / pandas | Vectorised operations run in C over whole arrays | Numeric and tabular data |
| `multiprocessing` / `ProcessPoolExecutor` | Use every CPU core | CPU-bound, parallelisable work |
| `asyncio` / threads | Overlap waiting time | I/O-bound work |
| PyPy | A JIT-compiled Python implementation | Long-running pure-Python code |
| Cython / mypyc | Compile (typed) Python to C extensions | Hot inner loops in libraries |
| Numba | JIT-compile numeric functions with a decorator | Loops over NumPy arrays |
| Rust / C extensions (PyO3) | Write the hot core natively | Maximum speed, bigger effort |

> [!NOTE] Free speed
>
> Upgrading Python is the cheapest optimisation: 3.11 was 10–60% faster than 3.10, and later releases continue the work (an experimental JIT arrived in 3.13).

> [!TIP] Do
>
> Profile, fix the top hotspot, re-measure, and keep a benchmark or test that proves the result is still correct.

> [!DANGER] Avoid
>
> Micro-optimising code that runs once, or sacrificing readability for a 2% gain the profiler never pointed at.

```question
Why is a list comprehension usually faster than a for loop with append?

---

The comprehension is compiled into a specialised loop that appends via a dedicated bytecode instead of looking up and calling the `append` method on each iteration, so there's less interpreter overhead per item.
```

```question
How do you speed up CPU-bound Python code?

---

Better algorithm first; then vectorise with NumPy or move hot loops into C (built-ins, Cython, Numba); then parallelise across cores with `multiprocessing`, since threads don't run Python bytecode in parallel under the GIL.
```
