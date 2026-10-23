---
id: 5598fefb-3573-7958-951a-49a75bad2aaf
key: topic:artificial-intelligence/iterative-deepening
subject: artificial-intelligence
topic: iterative-deepening
title: Depth-Limited, Iterative Deepening & Bidirectional Search
slug: depth-limited-iterative-deepening-bidirectional-search
order: 1
---

Iterative deepening combines DFS's tiny memory with BFS's completeness and optimality — and is the preferred uninformed method when the solution depth is unknown. Bidirectional search meets in the middle to cut `bᵈ` to `2·b^(d/2)`.

# Depth-limited and iterative deepening DFS

<strong>Depth-limited search (DLS)</strong> is DFS that treats nodes at depth `ℓ` as leaves — it can't loop forever, but misses goals deeper than `ℓ`. <strong>Iterative deepening (IDDFS)</strong> runs DLS with `ℓ = 0, 1, 2, …` until a goal is found.

```python filename:Python
ROADS = """Arad Zerind 75, Arad Sibiu 140, Arad Timisoara 118, Zerind Oradea 71, Oradea Sibiu 151,
Timisoara Lugoj 111, Lugoj Mehadia 70, Mehadia Drobeta 75, Drobeta Craiova 120, Craiova Rimnicu 146,
Craiova Pitesti 138, Sibiu Fagaras 99, Sibiu Rimnicu 80, Rimnicu Pitesti 97, Fagaras Bucharest 211,
Pitesti Bucharest 101, Bucharest Giurgiu 90, Bucharest Urziceni 85, Urziceni Hirsova 98,
Hirsova Eforie 86, Urziceni Vaslui 142, Vaslui Iasi 92, Iasi Neamt 87"""
graph = {}                                  # city -> {neighbour: road km}  ("Rimnicu" = Rimnicu Vilcea)
for road in ROADS.split(","):
    a, b, km = road.split()
    graph.setdefault(a, {})[b] = int(km)
    graph.setdefault(b, {})[a] = int(km)

def dls(node, goal, limit, route, counter):
    counter[0] += 1                                    # count expansions
    if node == goal:
        return route
    if limit == 0:
        return None                                    # cutoff
    for nbr in graph[node]:
        if nbr not in route:                           # avoid cycles along the current path
            found = dls(nbr, goal, limit - 1, route + [nbr], counter)
            if found:
                return found
    return None

def iddfs(start, goal, max_depth=10):
    total = 0
    for limit in range(max_depth + 1):
        counter = [0]
        found = dls(start, goal, limit, [start], counter)
        total += counter[0]
        if found:
            return found, limit, total

print(dls("Arad", "Bucharest", 2, ["Arad"], [0]))     # None ← limit too small
print(iddfs("Arad", "Bucharest"))                     # (['Arad', 'Sibiu', 'Fagaras', 'Bucharest'], 3, 23)
```

Re-generating the shallow levels looks wasteful, but in a tree most nodes are at the bottom level, so the overhead is small:

`N(IDS) = d·b + (d−1)·b² + … + 1·bᵈ N(BFS) = b + b² + … + bᵈ`

```python filename:Python
b, d = 10, 5
n_bfs = sum(b ** i for i in range(1, d + 1))
n_ids = sum((d - i + 1) * b ** i for i in range(1, d + 1))
print(n_bfs, n_ids, f"{n_ids / n_bfs - 1:.0%}")    # 111110 123450 11% ← only ~11% more nodes, with O(bd) memory
```

# Bidirectional search

Search forward from the start and backward from the goal at the same time; stop when the frontiers meet. Two searches of depth `d/2` generate `2·b^(d/2)` nodes — far fewer than `bᵈ` (for `b = 10, d = 6`: 2,000 vs 1,000,000). It needs actions that can be <em>reversed</em> and an explicit goal state.

```python filename:Python
ROADS = """Arad Zerind 75, Arad Sibiu 140, Arad Timisoara 118, Zerind Oradea 71, Oradea Sibiu 151,
Timisoara Lugoj 111, Lugoj Mehadia 70, Mehadia Drobeta 75, Drobeta Craiova 120, Craiova Rimnicu 146,
Craiova Pitesti 138, Sibiu Fagaras 99, Sibiu Rimnicu 80, Rimnicu Pitesti 97, Fagaras Bucharest 211,
Pitesti Bucharest 101, Bucharest Giurgiu 90, Bucharest Urziceni 85, Urziceni Hirsova 98,
Hirsova Eforie 86, Urziceni Vaslui 142, Vaslui Iasi 92, Iasi Neamt 87"""
graph = {}                                  # city -> {neighbour: road km}  ("Rimnicu" = Rimnicu Vilcea)
for road in ROADS.split(","):
    a, b, km = road.split()
    graph.setdefault(a, {})[b] = int(km)
    graph.setdefault(b, {})[a] = int(km)

from collections import deque

def bidirectional(start, goal):
    parents = {start: {start: None}, goal: {goal: None}}      # one search tree per direction
    frontiers = {start: deque([start]), goal: deque([goal])}
    while frontiers[start] and frontiers[goal]:
        for side, other in ((start, goal), (goal, start)):    # alternate one layer each
            for _ in range(len(frontiers[side])):
                node = frontiers[side].popleft()
                for nbr in graph[node]:
                    if nbr not in parents[side]:
                        parents[side][nbr] = node
                        frontiers[side].append(nbr)
                    if nbr in parents[other]:                  # the two searches meet
                        left, right, n = [], [], nbr
                        while n: left.append(n); n = parents[start][n]
                        n = parents[goal][nbr]
                        while n: right.append(n); n = parents[goal][n]
                        return left[::-1] + right, nbr

print(bidirectional("Arad", "Bucharest"))    # (['Arad', 'Sibiu', 'Fagaras', 'Bucharest'], 'Fagaras')
```

# Comparing the uninformed strategies

| Criterion | BFS | UCS | DFS | Depth-limited | Iterative deepening | Bidirectional |
| --- | --- | --- | --- | --- | --- | --- |
| Complete? | Yes¹ | Yes¹ ² | No | No (if `ℓ < d`) | Yes¹ | Yes¹ ⁴ |
| Optimal? | Yes³ | Yes | No | No | Yes³ | Yes³ ⁴ |
| Time | `O(bᵈ)` | `O(b^(1+⌊C*/ε⌋))` | `O(bᵐ)` | `O(bˡ)` | `O(bᵈ)` | `O(b^(d/2))` |
| Space | `O(bᵈ)` | `O(b^(1+⌊C*/ε⌋))` | `O(bm)` | `O(bℓ)` | `O(bd)` | `O(b^(d/2))` |

¹ if `b` is finite. ² if every step cost ≥ `ε > 0`. ³ if all step costs are equal. ⁴ if both directions use BFS (or UCS).

> [!NOTE] Key point
>
> Rule of thumb: <strong>IDDFS</strong> when the space is large and the solution depth unknown; <strong>UCS</strong> when step costs differ; <strong>BFS</strong> only when the space is small enough to fit in memory; <strong>DFS</strong> when memory is tight and any solution will do (or all solutions are deep and plentiful).

```question
Why is iterative deepening not as wasteful as it looks?

---

With branching factor `b`, the bottom level holds about `(b−1)/b` of all nodes, so re-generating the upper levels adds only a constant factor (\~11% for `b = 10`). In return you get BFS's completeness/optimality with DFS's `O(bd)` memory.
```

```question
What does bidirectional search need to work?

---

An explicit goal state (or a small set of them) and the ability to compute predecessors — i.e. reversible actions. It also needs an efficient check for when the two frontiers intersect (a hash set).
```
