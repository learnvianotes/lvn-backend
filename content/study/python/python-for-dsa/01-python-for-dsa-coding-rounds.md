---
id: 890ea73a-cab1-7376-a4a5-3e0480734872
key: topic:python/python-for-dsa
subject: python
topic: python-for-dsa
title: Python for DSA & Coding Rounds
slug: python-for-dsa-coding-rounds
order: 1
---

The complexities, templates and tricks that make Python the fastest language to <em>write</em> correct interview solutions in.

# Complexity cheat sheet

| Operation | list | dict / set | deque | heapq |
| --- | --- | --- | --- | --- |
| Access by index / key | O(1) | O(1) avg | O(n) in the middle | — |
| Search `x in …` | O(n) | <strong>O(1)</strong> avg | O(n) | O(n) |
| Append / add at end | O(1)\* | O(1) avg | O(1) | push O(log n) |
| Remove at front | <strong>O(n)</strong> | — | <strong>O(1)</strong> | pop min O(log n) |
| Insert / delete in middle | O(n) | O(1) avg (by key) | O(n) | — |
| Min / max | O(n) | O(n) | O(n) | <strong>O(1)</strong> peek |
| Sort | O(n log n) | — | — | — |

\* amortised. Strings are immutable: slicing and `+` copy — O(k).

# Templates

```python filename:Python%20%E2%80%94%20BFS
from collections import deque

def bfs(graph, start):
    """Shortest path (edges) from start in an unweighted graph."""
    dist = {start: 0}
    q = deque([start])
    while q:
        node = q.popleft()
        for nxt in graph[node]:
            if nxt not in dist:
                dist[nxt] = dist[node] + 1
                q.append(nxt)
    return dist

graph = {"a": ["b", "c"], "b": ["d"], "c": ["d"], "d": []}
print(bfs(graph, "a"))          # {'a': 0, 'b': 1, 'c': 1, 'd': 2}
```

```python filename:Python%20%E2%80%94%20binary%20search
def lower_bound(nums, target):
    """First index with nums[i] >= target (len(nums) if none)."""
    lo, hi = 0, len(nums)
    while lo < hi:
        mid = (lo + hi) // 2
        if nums[mid] < target:
            lo = mid + 1
        else:
            hi = mid
    return lo

print(lower_bound([1, 3, 5, 7], 5), lower_bound([1, 3], 9))   # 2 2
```

```python filename:Python%20%E2%80%94%20sliding%20window
def longest_unique_substring(s):
    seen, left, best = {}, 0, 0
    for right, ch in enumerate(s):
        if seen.get(ch, -1) >= left:
            left = seen[ch] + 1          # shrink past the duplicate
        seen[ch] = right
        best = max(best, right - left + 1)
    return best

print(longest_unique_substring("abcabcbb"))   # 3
```

```python filename:Python%20%E2%80%94%20Dijkstra
import heapq

def dijkstra(adj, src):
    dist = {src: 0}
    heap = [(0, src)]
    while heap:
        d, u = heapq.heappop(heap)
        if d > dist.get(u, float("inf")):
            continue                      # stale entry
        for v, w in adj.get(u, []):
            nd = d + w
            if nd < dist.get(v, float("inf")):
                dist[v] = nd
                heapq.heappush(heap, (nd, v))
    return dist

adj = {"a": [("b", 4), ("c", 1)], "c": [("b", 2)]}
print(dijkstra(adj, "a"))                 # {'a': 0, 'b': 3, 'c': 1}
```

# Tricks that save time

> [!NOTE] Infinity
>
> `float('inf')` and `-float('inf')` for initial min/max; `math.inf` works too.

> [!NOTE] Big integers
>
> `int` never overflows — factorials and large sums need no special handling.

> [!NOTE] Fast input
>
> `import sys; input = sys.stdin.readline` for large competitive-programming inputs.

> [!NOTE] Deep recursion
>
> `sys.setrecursionlimit(10**6)` — or better, rewrite DFS with an explicit stack.

> [!NOTE] Memoize
>
> `@functools.cache` on a recursive function = instant top-down DP.

> [!NOTE] Grids
>
> Direction list `[(0,1),(1,0),(0,-1),(-1,0)]` and a bounds check `0 <= r < R`.

```python filename:Python
from functools import cache

@cache
def climb(n):                 # ways to climb n stairs taking 1 or 2 steps
    return 1 if n <= 1 else climb(n - 1) + climb(n - 2)

print(climb(50))              # 20365011074
```

> [!WARNING] Watch out
>
> Plain Python is roughly 10–100× slower than C++ for tight loops. Pick the right algorithm first; then lean on built-ins (`sum`, `sorted`, `set`), which run in C.
