---
id: 8613da61-36b5-79b2-a199-2d46ecea6bf9
key: topic:python/sorting
subject: python
topic: sorting
title: Sorting & Custom Ordering
slug: sorting-custom-ordering
order: 1
---

Python's sort is fast (Timsort), <strong>stable</strong>, and customised with a `key` function — rarely with a comparator. Master `key=` and most ordering problems become one line.

# `sorted()` vs `list.sort()`

```python filename:Python
nums = [5, 2, 9, 1]
print(sorted(nums), nums)          # [1, 2, 5, 9] [5, 2, 9, 1]
result = nums.sort(reverse=True)   # in place
print(result, nums)                # None [9, 5, 2, 1]
print(sorted("hello"))             # ['e', 'h', 'l', 'l', 'o']
print(sorted({"b": 1, "a": 2}))    # ['a', 'b']   ← iterating a dict gives keys
```

|  | `sorted(iterable)` | `lst.sort()` |
| --- | --- | --- |
| Works on | Any iterable (str, dict, set, generator…) | Lists only |
| Returns | A <strong>new</strong> list | `None` — sorts in place |
| Memory | Copies the data | No extra list |
| Options | `key=`, `reverse=` | `key=`, `reverse=` |

> [!WARNING] Watch out
>
> `xs = xs.sort()` sets `xs` to `None`. Either `xs.sort()` or `xs = sorted(xs)`.

# The `key` function

`key` is called <strong>once per item</strong>; items are ordered by those computed keys. Any callable works: a built-in, a method, a lambda, an `operator` helper.

```python filename:Python
words = ["banana", "Apple", "fig", "cherry"]
print(sorted(words))                           # ['Apple', 'banana', 'cherry', 'fig']
print(sorted(words, key=str.lower))            # ['Apple', 'banana', 'cherry', 'fig']
print(sorted(words, key=len))                  # ['fig', 'Apple', 'banana', 'cherry']
print(sorted(words, key=lambda w: w[-1]))      # ['banana', 'Apple', 'fig', 'cherry']
print(sorted([-4, 1, -2, 3], key=abs))         # [1, -2, 3, -4]
```

> [!NOTE] Key point
>
> Uppercase letters sort before lowercase (`'Z' < 'a'`) because strings compare by code point. Use `key=str.lower` (or `str.casefold` for full Unicode) for human order.

# Multi-level ordering

Return a <strong>tuple</strong> from the key: ties on the first element fall through to the second. Negate numbers to flip one level to descending.

```python filename:Python
students = [("asha", 90, 21), ("ravi", 85, 22), ("kiran", 90, 20), ("meera", 85, 20)]

# marks descending, then name ascending
print([s[0] for s in sorted(students, key=lambda s: (-s[1], s[0]))])
# ['asha', 'kiran', 'meera', 'ravi']
```

```text filename:Output
['asha', 'kiran', 'meera', 'ravi']
```

Can't negate a string? Use <strong>stability</strong>: sort by the secondary key first, then by the primary key. Each pass keeps the previous order among ties.

```python filename:Python
people = [("asha", "dev"), ("ravi", "ops"), ("kiran", "dev"), ("meera", "ops")]
by_name_desc = sorted(people, key=lambda p: p[0], reverse=True)   # secondary first
result = sorted(by_name_desc, key=lambda p: p[1])                 # then primary
print(result)   # [('kiran', 'dev'), ('asha', 'dev'), ('ravi', 'ops'), ('meera', 'ops')]
```

> [!INFO]
>
> <strong>Stable sort</strong> — items with equal keys keep their original relative order. Python's sort is guaranteed stable, which makes multi-pass sorting correct.

# `operator.itemgetter` &amp; `attrgetter`

```python filename:Python
from operator import itemgetter, attrgetter
from dataclasses import dataclass

rows = [{"name": "ravi", "age": 30}, {"name": "asha", "age": 25}]
print([r["name"] for r in sorted(rows, key=itemgetter("age"))])   # ['asha', 'ravi']

pairs = [(2, "b"), (1, "z"), (2, "a")]
print(sorted(pairs, key=itemgetter(0, 1)))    # [(1, 'z'), (2, 'a'), (2, 'b')]

@dataclass
class Emp:
    name: str
    salary: int

staff = [Emp("a", 50), Emp("b", 70), Emp("c", 60)]
print([e.name for e in sorted(staff, key=attrgetter("salary"), reverse=True)])   # ['b', 'c', 'a']
```

# Sorting dict items

```python filename:Python
scores = {"asha": 91, "ravi": 78, "kiran": 91, "zoe": 85}

top = sorted(scores.items(), key=lambda kv: (-kv[1], kv[0]))
print(top[:3])                        # [('asha', 91), ('kiran', 91), ('zoe', 85)]
print(dict(sorted(scores.items())))   # {'asha': 91, 'kiran': 91, 'ravi': 78, 'zoe': 85}
print(max(scores, key=scores.get))    # asha   ← first max wins
```

# Comparators with `cmp_to_key`

When the order can't be expressed as a key — it depends on <em>both</em> items together — write a comparator returning negative / zero / positive and wrap it with `functools.cmp_to_key`.

```python filename:Python
from functools import cmp_to_key

def largest_number(nums):
    """Arrange numbers to form the largest possible number."""
    strs = [str(n) for n in nums]
    def cmp(a, b):
        if a + b > b + a:
            return -1          # a goes first
        if a + b < b + a:
            return 1
        return 0
    strs.sort(key=cmp_to_key(cmp))
    result = "".join(strs)
    return "0" if result[0] == "0" else result

print(largest_number([3, 30, 34, 5, 9]))   # 9534330
print(largest_number([0, 0]))              # 0
```

# Natural sort &amp; custom objects

```python filename:Python
import re

files = ["file10.txt", "file2.txt", "file1.txt"]
print(sorted(files))     # ['file1.txt', 'file10.txt', 'file2.txt']

def natural_key(s):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", s)]

print(sorted(files, key=natural_key))   # ['file1.txt', 'file2.txt', 'file10.txt']

class Task:
    def __init__(self, pri, name):
        self.pri, self.name = pri, name
    def __lt__(self, other):             # sort() only needs <
        return self.pri < other.pri
    def __repr__(self):
        return self.name

print(sorted([Task(3, "c"), Task(1, "a"), Task(2, "b")]))   # [a, b, c]
```

# min, max, heapq &amp; bisect take a key too

```python filename:Python
import heapq, bisect

words = ["kiwi", "banana", "fig", "apple"]
print(min(words, key=len), max(words, key=len))       # fig banana
print(heapq.nsmallest(2, words, key=len))             # ['fig', 'kiwi']
print(max([], default="empty"))                       # empty

records = [(1, "a"), (4, "b"), (9, "c")]              # sorted by first field
print(bisect.bisect_left(records, 5, key=lambda r: r[0]))   # 2   ← key= needs 3.10+
```

| Need | Best tool | Cost |
| --- | --- | --- |
| Full order | `sorted` / `.sort` | O(n log n) |
| Just the min or max | `min` / `max` | O(n) |
| Top k (k small) | `heapq.nsmallest` / `nlargest` | O(n log k) |
| Keep a list sorted while inserting | `bisect.insort` | O(log n) search + O(n) insert |

# Timsort facts &amp; pitfalls

> [!NOTE] Timsort
>
> Hybrid merge + insertion sort. O(n log n) worst case, <strong>O(n)</strong> on already-sorted or reversed data — it detects natural runs.

> [!NOTE] Stable
>
> Guaranteed. Equal keys keep their input order.

> [!NOTE] Mixed types
>
> `sorted([1, 'a'])` raises `TypeError` — Python 3 won't compare unrelated types.

> [!NOTE] Key once
>
> Keys are computed once per item (decorate-sort-undecorate), so an expensive key is still only n calls.

```python filename:Python
try:
    sorted([3, "a", 1])
except TypeError as e:
    print(e)   # '<' not supported between instances of 'str' and 'int'
print(sorted([3, None, 1], key=lambda x: (x is None, x or 0)))   # [1, 3, None]
```

```question
How do you sort by one field descending and another ascending?

---

Use a tuple key and negate the numeric field: `key=lambda r: (-r.score, r.name)`. If the descending field isn't numeric, rely on stability: sort by the secondary key first, then by the primary key with `reverse=True`.
```

```question
Is Python's sort stable, and why does it matter?

---

Yes — Timsort is stable. Equal elements keep their relative order, which lets you sort in multiple passes (secondary key first) and get a correct multi-key ordering.
```

```question
When would you use cmp\_to\_key?

---

When ordering depends on comparing two items together and can't be turned into a per-item key — e.g. "largest number" (compare `a+b` with `b+a`). Otherwise a key function is simpler and faster.
```
