---
id: 7b95f647-1bf4-7bc5-99b1-2e305b5f910f
key: topic:artificial-intelligence/uninformed-search
subject: artificial-intelligence
topic: uninformed-search
title: "Uninformed Search: BFS, DFS & UCS"
slug: uninformed-search-bfs-dfs-ucs
order: 1
---

Uninformed (blind) strategies know nothing about where the goal is — only how to generate successors and test for the goal. They differ solely in <strong>which frontier node to expand next</strong>.

| Strategy | Frontier | Expands | Finds |
| --- | --- | --- | --- |
| <strong>Breadth-first (BFS)</strong> | FIFO queue | Shallowest node first — level by level | The path with the <strong>fewest steps</strong> |
| <strong>Depth-first (DFS)</strong> | LIFO stack (or recursion) | Deepest node first | <em>Some</em> path — often long |
| <strong>Uniform-cost (UCS)</strong> | Priority queue on path cost `g(n)` | Cheapest-so-far node first | The <strong>lowest-cost</strong> path (Dijkstra's algorithm) |

# BFS and DFS on the Romania map

The classic textbook example: drive from Arad to Bucharest. Roads have lengths in km; the neighbour order below is the order roads were listed.

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

def path(parent, node):
    out = []
    while node:
        out.append(node)
        node = parent[node]
    return out[::-1]

def bfs(start, goal):
    frontier, parent, expanded = deque([start]), {start: None}, 0
    while frontier:
        node = frontier.popleft()                     # FIFO: oldest node first
        expanded += 1
        for nbr in graph[node]:
            if nbr not in parent:
                parent[nbr] = node
                if nbr == goal:                       # BFS may test the goal when a node is generated
                    return path(parent, nbr), expanded
                frontier.append(nbr)

def dfs(start, goal):
    frontier, parent, expanded = [start], {start: None}, 0
    while frontier:
        node = frontier.pop()                         # LIFO: newest node first
        if node == goal:
            return path(parent, node), expanded
        expanded += 1
        for nbr in graph[node]:
            if nbr not in parent:
                parent[nbr] = node
                frontier.append(nbr)

def cost(route):
    return sum(graph[a][b] for a, b in zip(route, route[1:]))

route, n = bfs("Arad", "Bucharest")
print(route, cost(route), n)     # ['Arad', 'Sibiu', 'Fagaras', 'Bucharest'] 450 6
route, n = dfs("Arad", "Bucharest")
print(route, cost(route), n)     # ['Arad', 'Timisoara', 'Lugoj', 'Mehadia', 'Drobeta', 'Craiova', 'Pitesti', 'Bucharest'] 733 7
```

BFS finds the route with the fewest roads (3), but it is <strong>not</strong> the shortest in km. DFS dives down whichever branch it pushed last and returns a much longer route.

# Uniform-cost search

UCS always expands the frontier node with the lowest path cost `g(n)`. It must test for the goal when a node is <strong>popped</strong>, not when it is generated — a cheaper route to the goal may still be on the frontier.

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

import heapq

def ucs(start, goal):
    frontier = [(0, start)]                           # (path cost g, city)
    best, parent, expanded = {start: 0}, {start: None}, []
    while frontier:
        g, node = heapq.heappop(frontier)
        if node == goal:                              # goal test on expansion → optimal
            route = [node]
            while parent[route[-1]]:
                route.append(parent[route[-1]])
            return route[::-1], g, expanded
        if g > best[node]:
            continue                                  # stale entry: a cheaper path was found later
        expanded.append(node)
        for nbr, km in graph[node].items():
            if g + km < best.get(nbr, float("inf")):
                best[nbr], parent[nbr] = g + km, node
                heapq.heappush(frontier, (g + km, nbr))

route, g, expanded = ucs("Arad", "Bucharest")
print(route, g)          # ['Arad', 'Sibiu', 'Rimnicu', 'Pitesti', 'Bucharest'] 418
print(len(expanded))     # 12
print(expanded[:6])      # ['Arad', 'Zerind', 'Timisoara', 'Sibiu', 'Oradea', 'Rimnicu']
```

> [!NOTE] Key point
>
> UCS is Dijkstra's algorithm stopped at the goal. It expands nodes in rings of increasing cost — in all directions, because it has no idea where Bucharest is. Adding that knowledge gives A\* (see <strong>Informed Search</strong>).

|  | BFS | DFS | UCS |
| --- | --- | --- | --- |
| Complete? | Yes (finite `b`) | No in infinite spaces or with loops (tree search); yes for finite graph search | Yes if every step cost ≥ `ε > 0` |
| Optimal? | Only if all step costs are equal | No | Yes |
| Time | `O(bᵈ)` | `O(bᵐ)` | `O(b^(1 + ⌊C*/ε⌋))` |
| Space | `O(bᵈ)` — keeps the whole frontier | `O(bm)` — only the current path + siblings | `O(b^(1 + ⌊C*/ε⌋))` |

> [!WARNING] Watch out
>
> BFS's real problem is <strong>memory</strong>, not time: at `b = 10`, depth 10 means \~10¹⁰ nodes in memory — terabytes. DFS uses linear memory but can wander down an infinite branch.

```question
When is BFS optimal?

---

When every action has the same cost (or cost is a non-decreasing function of depth). Then the shallowest goal is also the cheapest. With varied step costs use UCS.
```

```question
Why must UCS test the goal on expansion rather than generation?

---

When the goal is first generated it may be via an expensive edge (Fagaras → Bucharest, total 450) while a cheaper route (via Pitesti, 418) is still on the frontier. Waiting until the goal is popped guarantees it's the cheapest.
```

```question
Is Dijkstra's algorithm the same as UCS?

---

Essentially yes. Dijkstra computes shortest paths from a source to all nodes in an explicit graph; UCS stops at the goal and works on implicit graphs generated on the fly.
```
