---
id: 87d02882-134f-7c6e-a7b5-e3e8d25d3ed4
key: topic:python/stdlib-ds
subject: python
topic: stdlib-ds
title: collections, heapq & bisect
slug: collections-heapq-bisect
order: 1
---

The standard-library data structures that turn O(n) interview solutions into O(1) or O(log n) ones.

# deque — double-ended queue

O(1) appends and pops at <strong>both</strong> ends. Use it for queues (BFS) and sliding windows; a list's `pop(0)` is O(n).

```python filename:Python
from collections import deque
q = deque([1, 2, 3])
q.appendleft(0); q.append(4)
print(q.popleft(), q.pop(), list(q))    # 0 4 [1, 2, 3]
window = deque(maxlen=3)                # keeps only the last 3 items
for x in range(6):
    window.append(x)
print(list(window))                     # [3, 4, 5]
```

# Counter &amp; defaultdict

```python filename:Python
from collections import Counter, defaultdict
c = Counter("mississippi")
print(c.most_common(2))                  # [('i', 4), ('s', 4)]
# Missing keys count as zero instead of raising KeyError:
print(c["z"])                            # 0

graph = defaultdict(list)                # missing key → new empty list
for u, v in [("a", "b"), ("a", "c"), ("b", "c")]:
    graph[u].append(v)
print(dict(graph))                       # {'a': ['b', 'c'], 'b': ['c']}

groups = defaultdict(list)
for w in ["eat", "tea", "tan", "ate"]:
    groups["".join(sorted(w))].append(w)
print(list(groups.values()))             # [['eat', 'tea', 'ate'], ['tan']]
```

# heapq — priority queue

A <strong>min-heap</strong> stored in a plain list: `heappush` / `heappop` are O(log n), `heap[0]` is the minimum in O(1).

```python filename:Python
import heapq
nums = [5, 1, 8, 3, 2]
heapq.heapify(nums)                       # O(n)
heapq.heappush(nums, 0)
print(heapq.heappop(nums), nums[0])       # 0 1
print(heapq.nlargest(2, [5, 1, 8, 3]))    # [8, 5]

max_heap = []                             # no max-heap: store negatives
for x in [5, 1, 8]:
    heapq.heappush(max_heap, -x)
print(-heapq.heappop(max_heap))           # 8

tasks = [(2, "write"), (1, "plan"), (3, "ship")]
heapq.heapify(tasks)                      # tuples compare by first item
print(heapq.heappop(tasks))               # (1, 'plan')
```

> [!WARNING] Watch out
>
> If priorities tie, tuples fall back to comparing the next item — which may not be comparable. Add a counter: `(priority, count, item)`.

# bisect — binary search on sorted lists

```python filename:Python
import bisect
xs = [1, 3, 3, 5, 8]
print(bisect.bisect_left(xs, 3), bisect.bisect_right(xs, 3))   # 1 3
bisect.insort(xs, 4)                                          # insert, keep sorted
print(xs)                                                     # [1, 3, 3, 4, 5, 8]
```

| Need | Use | Key operations |
| --- | --- | --- |
| FIFO queue / BFS | `deque` | `append`, `popleft` — O(1) |
| Counting | `Counter` | `most_common(k)`, arithmetic between counters |
| Grouping / adjacency list | `defaultdict(list)` | auto-creates missing keys |
| k smallest / Dijkstra / scheduling | `heapq` | `heappush`, `heappop` — O(log n) |
| Search in sorted data | `bisect` | `bisect_left` — O(log n) |
| LRU-style ordering | `OrderedDict` | `move_to_end`, `popitem(last=False)` |
