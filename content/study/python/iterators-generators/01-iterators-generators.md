---
id: f353ad08-959a-7d53-83c2-c572ed0d3192
key: topic:python/iterators-generators
subject: python
topic: iterators-generators
title: Iterators & Generators
slug: iterators-generators
order: 1
---

Iteration is a protocol: an <em>iterable</em> gives you an <em>iterator</em>, and an iterator hands out items with `next()` until it raises `StopIteration`. Generators make writing iterators trivial.

# The iterator protocol

```python filename:Python
nums = [10, 20]
it = iter(nums)               # calls nums.__iter__()
print(next(it), next(it))     # 10 20
try:
    next(it)
except StopIteration:
    print("exhausted")        # exhausted
```

> [!NOTE] Iterable
>
> Anything with `__iter__` (lists, strings, dicts, files). Can be looped over many times.

> [!NOTE] Iterator
>
> Has `__next__` and remembers its position. Single-use: once exhausted, it stays empty.

# Generators with `yield`

A function containing `yield` returns a <strong>generator</strong>. Each `next()` runs the body until the next `yield`, then pauses with all local state intact.

```python filename:Python
def countdown(n):
    while n > 0:
        yield n
        n -= 1

gen = countdown(3)
print(next(gen), list(gen))          # 3 [2, 1]

def fib():
    a, b = 0, 1
    while True:                      # infinite, but lazy
        yield a
        a, b = b, a + b

from itertools import islice
print(list(islice(fib(), 10)))       # [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]
```

> [!NOTE] Key point
>
> Generators use O(1) memory regardless of how many items they produce — the key to processing huge files or infinite streams.

# Pipelines &amp; `yield from`

```python filename:Python
def read_lines(text):
    yield from text.splitlines()        # delegate to another iterable

def non_empty(lines):
    return (l.strip() for l in lines if l.strip())

def numbers(lines):
    for l in lines:
        if l.isdigit():
            yield int(l)

data = "10\n\n  7 \nabc\n3"
print(sum(numbers(non_empty(read_lines(data)))))   # 20
```

# itertools essentials

```python filename:Python
from itertools import accumulate, chain, combinations, groupby, permutations, product, count

print(list(accumulate([1, 2, 3, 4])))                 # [1, 3, 6, 10]
print(list(chain([1, 2], (3,), "ab")))                # [1, 2, 3, 'a', 'b']
print(list(combinations("abc", 2)))                   # [('a', 'b'), ('a', 'c'), ('b', 'c')]
print(len(list(permutations(range(4)))))              # 24
print(list(product([0, 1], repeat=2)))                # [(0, 0), (0, 1), (1, 0), (1, 1)]
print([(k, len(list(g))) for k, g in groupby("aaabcc")])   # [('a', 3), ('b', 1), ('c', 2)]
print(next(x for x in count(1) if x * x > 50))        # 8
```

> [!WARNING] Watch out
>
> `groupby` only groups <strong>consecutive</strong> equal keys — sort by the same key first if the data isn't already grouped.
