---
id: b9920f00-016a-750e-bd9f-3c9416a64a9b
key: topic:python/lists-tuples
subject: python
topic: lists-tuples
title: Lists & Tuples
slug: lists-tuples
order: 1
---

`list` is a mutable, ordered, dynamic array. `tuple` is its immutable sibling — lighter, hashable, and used for fixed records.

> [!INFO]
>
> <strong>list</strong> — a dynamic array of <em>references</em> to objects. Indexing is O(1); appending is amortised O(1) because Python over-allocates capacity.

# Core operations &amp; complexity

| Operation | Example | Time |
| --- | --- | --- |
| Index / assign | `xs[i]`, `xs[i] = v` | O(1) |
| Append / pop from end | `xs.append(v)`, `xs.pop()` | O(1) amortised |
| Insert / pop at front | `xs.insert(0, v)`, `xs.pop(0)` | <strong>O(n)</strong> — use `deque` |
| Search | `v in xs`, `xs.index(v)` | O(n) |
| Slice | `xs[a:b]` | O(b − a) |
| Sort | `xs.sort()`, `sorted(xs)` | O(n log n) — Timsort, stable |
| Extend | `xs.extend(ys)`, `xs + ys` | O(len(ys)) |

```python filename:Python
xs = [5, 2, 9]
xs.append(1)
xs.extend([7, 3])
xs.insert(1, 4)
print(xs)                       # [5, 4, 2, 9, 1, 7, 3]
print(xs.pop(), xs.pop(0))      # 3 5
xs.remove(9)                    # removes the first 9 (ValueError if absent)
print(sorted(xs), xs[::-1])     # [1, 2, 4, 7] [7, 1, 2, 4]
```

# `sort()` vs `sorted()`

> [!NOTE] xs.sort()
>
> Sorts <strong>in place</strong> and returns `None`. Only for lists.

> [!NOTE] sorted(it)
>
> Returns a <strong>new</strong> list from any iterable. The original is untouched.

```python filename:Python
people = [("Ravi", 30), ("Asha", 25), ("Kiran", 30)]
print(sorted(people, key=lambda p: p[1]))
# [('Asha', 25), ('Ravi', 30), ('Kiran', 30)]   ← stable: Ravi stays before Kiran
print(sorted(people, key=lambda p: (-p[1], p[0])))
# [('Kiran', 30), ('Ravi', 30), ('Asha', 25)]   ← age desc, then name asc
```

# Copies: aliasing, shallow, deep

```python filename:Python
import copy
grid = [[0, 0], [0, 0]]
alias = grid                 # same list
shallow = grid[:]            # new outer list, same inner lists
deep = copy.deepcopy(grid)   # everything copied
grid[0][0] = 9
print(alias[0][0], shallow[0][0], deep[0][0])   # 9 9 0
```

> [!WARNING] Classic bug
>
> `[[0] * 3] * 3` creates <strong>three references to the same inner list</strong> — changing one row changes all. Build 2-D lists with a comprehension: `[[0] * 3 for _ in range(3)]`.

```python filename:Python
bad = [[0] * 3] * 3
bad[0][0] = 1
print(bad)                              # [[1, 0, 0], [1, 0, 0], [1, 0, 0]]
good = [[0] * 3 for _ in range(3)]
good[0][0] = 1
print(good)                             # [[1, 0, 0], [0, 0, 0], [0, 0, 0]]
```

# Tuples, packing &amp; unpacking

```python filename:Python
point = (3, 4)
x, y = point                    # unpacking
a, b = 1, 2
a, b = b, a                     # swap without a temp variable
first, *middle, last = [1, 2, 3, 4, 5]
print(x, y, a, b)               # 3 4 2 1
print(first, middle, last)      # 1 [2, 3, 4] 5
single = (42,)                  # the comma makes the tuple, not the parentheses
print(type(single).__name__)    # tuple
```

|  | `list` | `tuple` |
| --- | --- | --- |
| Mutable | Yes | No |
| Hashable (dict key / set item) | No | Yes, if its items are hashable |
| Memory / speed | Slightly larger | Smaller, slightly faster to create |
| Use for | Collections that grow and change | Fixed records: coordinates, DB rows, dict keys |

# Named tuples

```python filename:Python
from collections import namedtuple
Point = namedtuple("Point", ["x", "y"])
p = Point(3, 4)
print(p.x + p.y, p)          # 7 Point(x=3, y=4)
```
