---
id: aa5b2a91-1ca9-7ce5-af45-f0c4d1bce6a1
key: topic:artificial-intelligence/informed-search
subject: artificial-intelligence
topic: informed-search
title: "Informed Search: Greedy & A*"
slug: informed-search-greedy-a
order: 1
---

Informed search uses a <strong>heuristic</strong> `h(n)` — an estimate of the cost from `n` to the goal — to expand promising nodes first. A\* combines the cost so far with the estimate to go, and is optimal when the heuristic never overestimates.

| Strategy | Evaluation `f(n)` | Behaviour |
| --- | --- | --- |
| Uniform-cost | `g(n)` | Cheapest-so-far — ignores the goal |
| <strong>Greedy best-first</strong> | `h(n)` | Whatever <em>looks</em> closest to the goal — fast, not optimal |
| <strong>A</strong>\* | `g(n) + h(n)` | Cheapest estimated <em>total</em> path through `n` — optimal with an admissible `h` |
| Weighted A\* | `g(n) + w·h(n)`, `w > 1` | Faster, cost at most `w ×` optimal |

`f(n) = g(n) + h(n) g = cost from start to n, h = estimated cost from n to goal`

For route finding, the straight-line distance (SLD) to Bucharest is a natural heuristic — a road can't be shorter than a straight line:

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

SLD = {"Arad": 366, "Bucharest": 0, "Craiova": 160, "Drobeta": 242, "Eforie": 161, "Fagaras": 176,
       "Giurgiu": 77, "Hirsova": 151, "Iasi": 226, "Lugoj": 244, "Mehadia": 241, "Neamt": 234,
       "Oradea": 380, "Pitesti": 100, "Rimnicu": 193, "Sibiu": 253, "Timisoara": 329,
       "Urziceni": 80, "Vaslui": 199, "Zerind": 374}

def best_first(start, goal, f):
    frontier = [(f(0, start), 0, start, [start])]          # (priority, g, city, route)
    best_g, expanded = {start: 0}, []
    while frontier:
        _, g, node, route = heapq.heappop(frontier)
        if node == goal:
            return route, g, expanded
        if g > best_g[node]:
            continue
        expanded.append(node)
        for nbr, km in graph[node].items():
            g2 = g + km
            if g2 < best_g.get(nbr, float("inf")):
                best_g[nbr] = g2
                heapq.heappush(frontier, (f(g2, nbr), g2, nbr, route + [nbr]))

greedy = lambda g, city: SLD[city]              # f = h
astar = lambda g, city: g + SLD[city]           # f = g + h

route, cost, expanded = best_first("Arad", "Bucharest", greedy)
print(route, cost)       # ['Arad', 'Sibiu', 'Fagaras', 'Bucharest'] 450
print(expanded)          # ['Arad', 'Sibiu', 'Fagaras']
route, cost, expanded = best_first("Arad", "Bucharest", astar)
print(route, cost)       # ['Arad', 'Sibiu', 'Rimnicu', 'Pitesti', 'Bucharest'] 418
print(expanded)          # ['Arad', 'Sibiu', 'Rimnicu', 'Fagaras', 'Pitesti']
```

Greedy heads for Fagaras because it is closest to Bucharest in a straight line, and ends up 32 km worse. A\* expands Fagaras too, but when Bucharest appears with `f = 450` it first expands Pitesti (`f = 317 + 100 = 417`) and finds the 418 km route. UCS needed 12 expansions for the same answer; A\* needed 5.

# Why A\* is optimal

> [!INFO]
>
> <strong>Admissible heuristic</strong> — never overestimates the true cost to reach the goal: `h(n) ≤ h*(n)` for every `n`. It is <em>optimistic</em>.

> [!INFO]
>
> <strong>Consistent (monotone) heuristic</strong> — for every node `n` and successor `n′` via action `a`: `h(n) ≤ c(n, a, n′) + h(n′)` — a triangle inequality. Along any path, `f` never decreases. Every consistent heuristic is admissible.

1. <strong>Admissible h</strong>

   `f(n) = g(n) + h(n)` never overestimates the cost of the best solution through `n`.

2. <strong>Suboptimal goal G₂ on the frontier</strong>

   `f(G₂) = g(G₂) > C*` because `h(G₂) = 0`.

3. <strong>Some node n on the optimal path is also on the frontier</strong>

   `f(n) ≤ C* < f(G₂)`, so `n` is expanded before `G₂`.

4. <strong>Conclusion</strong>

   A\* never pops a suboptimal goal before the optimal one. With graph search, consistency guarantees each state's first expansion is via its cheapest path.

| Property of A\* | Holds when |
| --- | --- |
| Complete | Finite branching and step costs ≥ `ε > 0` |
| Optimal — tree search | `h` admissible |
| Optimal — graph search (no re-opening) | `h` consistent |
| Optimally efficient | No other optimal algorithm using the same `h` expands fewer nodes (up to ties) |
| Space | Exponential — keeps every generated node; this is A\*'s real bottleneck |

> [!NOTE] IDA*
>
> Iterative deepening on `f` instead of depth: each iteration's cutoff is the smallest `f` that exceeded the last one. Linear memory; good for puzzles with unit costs.

> [!NOTE] SMA* / memory-bounded
>
> Runs A\* until memory is full, then drops the worst leaf and remembers its `f` in the parent.

> [!NOTE] Weighted A*
>
> `f = g + w·h` with `w > 1`: expands far fewer nodes, solution cost ≤ `w · C*`. Common in games and robotics.

> [!NOTE] Greedy best-first
>
> `f = h`. Often very fast, but not optimal and (tree search) not complete — it can loop.

> [!WARNING] Watch out
>
> An <strong>inadmissible</strong> heuristic (one that sometimes overestimates) can make A\* skip the optimal path. And a heuristic that is admissible but <em>inconsistent</em> needs graph search that can re-open closed nodes — otherwise optimality is lost.

```question
Explain A\* and when it is optimal.

---

A\* is best-first search on `f(n) = g(n) + h(n)`, the estimated cost of the cheapest solution through `n`. It is optimal if `h` is admissible (tree search) or consistent (graph search), and complete with positive step costs and finite branching.
```

```question
What happens to A\* when h = 0? When h = h\* exactly?

---

`h = 0` gives uniform-cost search (still optimal, but uninformed). With the perfect heuristic `h = h*`, A\* expands only nodes on an optimal path — straight to the goal.
```

```question
Why does greedy best-first search fail to be optimal?

---

It ignores the cost already paid (`g`), so it follows whatever looks closest even when that route is expensive — Arad → Sibiu → Fagaras → Bucharest (450 km) instead of 418 km.
```
