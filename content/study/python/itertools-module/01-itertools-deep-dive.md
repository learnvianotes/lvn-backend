---
id: a8dd076f-d889-754a-a4d7-899757214fc3
key: topic:python/itertools-module
subject: python
topic: itertools-module
title: itertools Deep Dive
slug: itertools-deep-dive
order: 1
---

`itertools` is a toolkit of fast, memory-efficient iterator building blocks written in C. Combine them to express loops as pipelines.

# Infinite iterators

```python filename:Python
from itertools import count, cycle, repeat, islice

print(list(islice(count(10, 5), 4)))          # [10, 15, 20, 25]
print(list(islice(cycle("AB"), 5)))           # ['A', 'B', 'A', 'B', 'A']
print(list(repeat("x", 3)))                   # ['x', 'x', 'x']
print(list(map(pow, [2, 3, 4], repeat(2))))   # [4, 9, 16]
```

> [!WARNING] Watch out
>
> `count()` and `cycle()` never stop — always bound them with `islice`, `zip`, `takewhile` or a `break`.

# Slicing &amp; filtering

```python filename:Python
from itertools import islice, takewhile, dropwhile, filterfalse, compress

nums = [1, 4, 6, 3, 8, 2]
print(list(islice(nums, 1, 5, 2)))                  # [4, 3]
print(list(takewhile(lambda n: n < 5, nums)))       # [1, 4]
print(list(dropwhile(lambda n: n < 5, nums)))       # [6, 3, 8, 2]
print(list(filterfalse(lambda n: n % 2, nums)))     # [4, 6, 8, 2]
print(list(compress("abcdef", [1, 0, 1, 0, 0, 1]))) # ['a', 'c', 'f']
```

# Combining &amp; reshaping

```python filename:Python
from itertools import chain, zip_longest, pairwise, batched, starmap, accumulate
import operator

print(list(chain.from_iterable([[1, 2], [3], []])))       # [1, 2, 3]
print(list(zip_longest("abc", [1], fillvalue=0)))          # [('a', 1), ('b', 0), ('c', 0)]
print(list(pairwise([1, 4, 9, 16])))                       # [(1, 4), (4, 9), (9, 16)]
print(list(batched(range(7), 3)))                          # [(0, 1, 2), (3, 4, 5), (6,)]
print(list(starmap(operator.mul, [(2, 3), (4, 5)])))       # [6, 20]
print(list(accumulate([3, 1, 4, 1, 5], max)))              # [3, 3, 4, 4, 5]
print(list(accumulate([1, 2, 3], initial=100)))            # [100, 101, 103, 106]
```

| Function | Since | Use it for |
| --- | --- | --- |
| `chain.from_iterable(xss)` | — | Flatten one level lazily |
| `zip_longest(a, b, fillvalue=…)` | — | Zip without truncating to the shortest |
| `pairwise(it)` | 3.10 | Consecutive pairs — differences, gaps, edges of a path |
| `batched(it, n)` | 3.12 | Fixed-size chunks (`strict=True` in 3.13 demands full batches) |
| `accumulate(it, func)` | — | Running totals / max / products (prefix sums) |
| `starmap(f, pairs)` | — | `f(*args)` for each tuple of args |
| `tee(it, n)` | — | Split one iterator into `n` independent ones (buffers items) |

# Combinatorics

```python filename:Python
from itertools import product, permutations, combinations, combinations_with_replacement
from math import comb, perm

print(list(product("ab", repeat=2)))               # [('a', 'a'), ('a', 'b'), ('b', 'a'), ('b', 'b')]
print(list(permutations("abc", 2)))                # [('a', 'b'), ('a', 'c'), ('b', 'a'), ('b', 'c'), ('c', 'a'), ('c', 'b')]
print(list(combinations([1, 2, 3], 2)))            # [(1, 2), (1, 3), (2, 3)]
print(list(combinations_with_replacement("ab", 2)))  # [('a', 'a'), ('a', 'b'), ('b', 'b')]
print(len(list(permutations(range(5), 3))), perm(5, 3), comb(5, 3))   # 60 60 10
```

| Function | Order matters? | Repeats? | Count for n items, size r |
| --- | --- | --- | --- |
| `product(xs, repeat=r)` | Yes | Yes | nʳ |
| `permutations(xs, r)` | Yes | No | n! / (n−r)! |
| `combinations(xs, r)` | No | No | n! / (r!(n−r)!) |
| `combinations_with_replacement(xs, r)` | No | Yes | (n+r−1)! / (r!(n−1)!) |

# groupby — done right

```python filename:Python
from itertools import groupby
from operator import itemgetter

sales = [("fruit", "apple"), ("veg", "kale"), ("fruit", "kiwi"), ("veg", "leek")]
print([k for k, _ in groupby(sales, key=itemgetter(0))])   # ['fruit', 'veg', 'fruit', 'veg']

sales.sort(key=itemgetter(0))                               # sort by the SAME key first
grouped = {k: [name for _, name in g] for k, g in groupby(sales, key=itemgetter(0))}
print(grouped)                                              # {'fruit': ['apple', 'kiwi'], 'veg': ['kale', 'leek']}

# Run-length encoding: the classic groupby interview question
print("".join(f"{ch}{len(list(g))}" for ch, g in groupby("aaabccdd")))   # a3b1c2d2
```

> [!WARNING] Watch out
>
> Each group is an iterator tied to the parent `groupby`. Advancing to the next group invalidates the previous one — consume (e.g. `list(g)`) before moving on.

# Recipes

```python filename:Python
from itertools import islice, chain, cycle
from collections import deque

def sliding_window(it, n):
    it = iter(it)
    window = deque(islice(it, n - 1), maxlen=n)
    for x in it:
        window.append(x)
        yield tuple(window)

def unique_everseen(it):
    seen = set()
    for x in it:
        if x not in seen:
            seen.add(x)
            yield x

def roundrobin(*its):
    iterators = cycle(iter(i) for i in its)
    pending = len(its)
    while pending:
        try:
            yield next(next(iterators))
        except StopIteration:
            pending -= 1
            iterators = cycle(list(islice(iterators, pending)))

print(list(sliding_window([1, 2, 3, 4, 5], 3)))   # [(1, 2, 3), (2, 3, 4), (3, 4, 5)]
print(list(unique_everseen("abracadabra")))       # ['a', 'b', 'r', 'c', 'd']
print(list(roundrobin("ABC", "D", "EF")))         # ['A', 'D', 'E', 'B', 'F', 'C']
```

> [!NOTE] Key point
>
> The official docs end with an <em>Itertools Recipes</em> section; the third-party `more-itertools` package ships all of them (and many more) ready to import.

```question
How would you generate all subsets of a list?

---

`chain.from_iterable(combinations(xs, r) for r in range(len(xs) + 1))` — 2ⁿ subsets, produced lazily. Alternatively, loop a bitmask from `0` to `2**n - 1`.
```

```question
Why does groupby return the same key more than once?

---

It only groups <strong>consecutive</strong> items with equal keys, like the Unix `uniq` command. Sort by the same key first, or use a `defaultdict(list)` if order doesn't matter.
```

```question
What is the benefit of itertools over writing loops?

---

They are implemented in C and lazy: less memory (items are produced on demand), often faster, composable into pipelines, and they express intent (`pairwise`, `batched`) instead of index arithmetic.
```
