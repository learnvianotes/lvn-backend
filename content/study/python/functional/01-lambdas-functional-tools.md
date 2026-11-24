---
id: 20fa158c-02d1-7b9b-bcf7-16edc46aa5aa
key: topic:python/functional
subject: python
topic: functional
title: Lambdas & Functional Tools
slug: lambdas-functional-tools
order: 1
---

Small anonymous functions plus `map`, `filter`, `sorted(key=…)` and `functools` — Python's functional toolkit.

# lambda

`lambda args: expression` — a one-expression function with no name, no statements and no annotations. Best as a short `key=` or callback.

```python filename:Python
add = lambda a, b: a + b
print(add(2, 3))                                            # 5
words = ["banana", "Apple", "cherry"]
print(sorted(words, key=str.lower))                         # ['Apple', 'banana', 'cherry']
print(sorted(words, key=lambda w: (len(w), w)))             # ['Apple', 'banana', 'cherry']
print(max(["aa", "b", "cccc"], key=len))                    # cccc
```

# map, filter, zip

```python filename:Python
nums = [1, 2, 3, 4]
print(list(map(lambda x: x * 10, nums)))        # [10, 20, 30, 40]
print(list(filter(lambda x: x % 2, nums)))      # [1, 3]
print(list(map(int, "123")))                    # [1, 2, 3]
print(list(map(pow, [2, 3], [3, 2])))           # [8, 9]
```

> [!NOTE] Key point
>
> `map`, `filter` and `zip` return <strong>lazy iterators</strong>. Wrap them in `list()` to see the values — and remember they can be consumed only once.

# functools

```python filename:Python
from functools import reduce, partial, cache, lru_cache

print(reduce(lambda acc, x: acc * x, [1, 2, 3, 4], 1))   # 24

base2 = partial(int, base=2)
print(base2("1011"))                                      # 11

@cache
def fib(n):
    return n if n < 2 else fib(n - 1) + fib(n - 2)
print(fib(80))                                            # 23416728348467685

@lru_cache(maxsize=128)
def slow_square(x):
    return x * x
slow_square(4); slow_square(4)
print(slow_square.cache_info().hits)                      # 1
```

> [!NOTE] @cache / @lru_cache
>
> Memoize pure functions — the fastest way to turn a recursive solution into top-down DP.

> [!NOTE] partial
>
> Pre-fill some arguments to create a simpler function.

> [!NOTE] reduce
>
> Fold a sequence into one value. Often `sum`, `max`, `math.prod` or a loop is clearer.

> [!NOTE] operator module
>
> `itemgetter(1)`, `attrgetter('age')` — faster, named alternatives to small lambdas.

```python filename:Python
from operator import itemgetter
rows = [("b", 2), ("a", 3), ("c", 1)]
print(sorted(rows, key=itemgetter(1)))    # [('c', 1), ('b', 2), ('a', 3)]
```

> [!TIP] Do
>
> Prefer a comprehension over `map`/`filter` with a lambda — `[x * 2 for x in xs]` reads better than `list(map(lambda x: x * 2, xs))`.

> [!DANGER] Avoid
>
> Assigning lambdas to names (`f = lambda x: …`) in real code — use `def` so the function has a name in tracebacks.
