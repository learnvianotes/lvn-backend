---
id: 9e73f0f8-8a32-717b-853a-2669f40dc852
key: topic:python/dictionaries
subject: python
topic: dictionaries
title: Dictionaries
slug: dictionaries
order: 1
---

`dict` maps hashable keys to values with average O(1) lookup, insert and delete — the workhorse of Python.

> [!INFO]
>
> <strong>Hash table</strong> — each key's `hash()` picks a slot; collisions are resolved by open addressing. Since Python 3.7, dicts <strong>preserve insertion order</strong>.

# Create, read, update

```python filename:Python
ages = {"asha": 25, "ravi": 30}
ages["kiran"] = 28                    # insert / update
print(ages["asha"])                   # 25
print(ages.get("zoe"), ages.get("zoe", 0))   # None 0
print("ravi" in ages, len(ages))      # True 3
del ages["ravi"]
print(ages.pop("kiran"), ages)        # 28 {'asha': 25}
```

> [!WARNING] Watch out
>
> `d[key]` raises `KeyError` for a missing key. Use `d.get(key, default)`, `key in d`, `setdefault`, or a `defaultdict`.

# Iterating

```python filename:Python
scores = {"math": 90, "cs": 95}
for subject, score in scores.items():
    print(subject, score, end="; ")   # math 90; cs 95;
print()
print(list(scores), list(scores.values()))   # ['math', 'cs'] [90, 95]
```

> [!NOTE] Key point
>
> Don't add or remove keys while iterating over a dict (`RuntimeError`). Iterate over `list(d)` if you must modify it.

# Useful methods

| Method | Does |
| --- | --- |
| `d.get(k, default)` | Value or default — never raises |
| `d.setdefault(k, v)` | Insert `v` if `k` is missing, then return `d[k]` |
| `d.update(other)` / `d &#124; other` | Merge (the right-hand side wins); `&#124;` returns a new dict (3.9+) |
| `d.pop(k, default)` | Remove and return |
| `d.items()` / `keys()` / `values()` | Live <em>views</em> that reflect later changes |
| `dict.fromkeys(keys, v)` | New dict with every key set to `v` |

```python filename:Python
base = {"theme": "light", "font": 14}
user = {"theme": "dark"}
print(base | user)                        # {'theme': 'dark', 'font': 14}
counts = {}
for ch in "banana":
    counts[ch] = counts.get(ch, 0) + 1
print(counts)                             # {'b': 1, 'a': 3, 'n': 2}
print(max(counts, key=counts.get))        # a
```

# What can be a key?

Keys must be <strong>hashable</strong>: their hash never changes during their lifetime. Immutable built-ins (`int`, `str`, `tuple` of hashables, `frozenset`) are hashable; `list`, `dict` and `set` are not.

```python filename:Python
grid = {(0, 0): "start", (2, 3): "goal"}     # tuples make great coordinate keys
print(grid[(2, 3)])                          # goal
try:
    {[1, 2]: "x"}                            # lists are unhashable
except TypeError as e:
    print(type(e).__name__)                  # TypeError
```

# Dictionary patterns

> [!NOTE] Frequency count
>
> `Counter(items)` or `d[x] = d.get(x, 0) + 1`.

> [!NOTE] Grouping
>
> `defaultdict(list)` then `groups[key].append(item)`.

> [!NOTE] Two-sum lookup
>
> Store `value → index` while scanning; check `target - x in seen`.

> [!NOTE] Memoization
>
> Cache results: `memo[args] = result` — or use `functools.cache`.

```python filename:Python
def two_sum(nums, target):
    seen = {}                      # value → index
    for i, x in enumerate(nums):
        if target - x in seen:
            return [seen[target - x], i]
        seen[x] = i
    return []

print(two_sum([2, 7, 11, 15], 9))   # [0, 1]
```
