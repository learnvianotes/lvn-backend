---
id: 64b5c855-2b83-7de6-a4ac-caaf08ff268d
key: topic:python/sets
subject: python
topic: sets
title: Sets
slug: sets
order: 1
---

A `set` is an unordered collection of unique, hashable items with O(1) membership tests — and real set algebra.

```python filename:Python
a = {1, 2, 3, 4}
b = {3, 4, 5}
print(a | b)          # {1, 2, 3, 4, 5}
print(a & b)          # {3, 4}
print(a - b)          # {1, 2}
print(a ^ b)          # {1, 2, 5}
print({1, 2} <= a)    # True
```

| Operator | Method | Meaning |
| --- | --- | --- |
| `a &#124; b` | `a.union(b)` | In either |
| `a & b` | `a.intersection(b)` | In both |
| `a - b` | `a.difference(b)` | In `a` but not `b` |
| `a ^ b` | `a.symmetric_difference(b)` | In exactly one |
| `a <= b` | `a.issubset(b)` | Every item of `a` is in `b` |

# Adding &amp; removing

```python filename:Python
s = set()                  # {} would be an empty *dict*
s.add(3); s.add(3); s.add(1)
s.discard(99)              # no error if missing
print(sorted(s), len(s))   # [1, 3] 2
```

> [!WARNING] Watch out
>
> `remove(x)` raises `KeyError` if `x` is missing; `discard(x)` doesn't. And `{}` is an empty <strong>dict</strong> — write `set()`.

# When to reach for a set

> [!NOTE] De-duplicate
>
> `list(set(xs))` — order is lost; use `list(dict.fromkeys(xs))` to keep first-seen order.

> [!NOTE] Fast membership
>
> `x in big_set` is O(1) vs O(n) for a list — the difference between TLE and AC.

> [!NOTE] Visited nodes
>
> BFS / DFS keep a `visited` set of states or coordinates.

> [!NOTE] frozenset
>
> An immutable, hashable set — usable as a dict key or inside another set.

```python filename:Python
xs = [3, 1, 3, 2, 1]
print(list(dict.fromkeys(xs)))                   # [3, 1, 2]
def has_duplicate(nums):
    return len(set(nums)) != len(nums)
print(has_duplicate(xs), has_duplicate([1, 2]))  # True False
```
