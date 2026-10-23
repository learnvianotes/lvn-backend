---
id: 1433cd31-636d-7937-a4f8-c8ad282ce60b
key: topic:artificial-intelligence/heuristics
subject: artificial-intelligence
topic: heuristics
title: Designing Heuristics
slug: designing-heuristics
order: 1
---

A\* is only as good as its heuristic. Good heuristics are admissible, as close to the true cost as possible, and cheap to compute — and the standard way to invent one is to <strong>relax</strong> the problem.

# Two classic 8-puzzle heuristics

| Heuristic | Definition | Relaxed problem it solves exactly |
| --- | --- | --- |
| `h₁` — misplaced tiles | Number of tiles not in their goal square | A tile can jump <em>anywhere</em> in one move |
| `h₂` — Manhattan distance | Sum over tiles of \|row − goal row\| + \|col − goal col\| | A tile can move to <em>any adjacent</em> square, even an occupied one |

A relaxed problem has <em>more</em> actions, so its optimal cost can only be lower — that is why a heuristic derived from a relaxation is automatically admissible (and consistent).

```python filename:Python
import heapq

GOAL = (0, 1, 2, 3, 4, 5, 6, 7, 8)         # 0 = blank

def h1(s):                                  # misplaced tiles (the blank doesn't count)
    return sum(1 for i, tile in enumerate(s) if tile and tile != i)

def h2(s):                                  # Manhattan distance
    return sum(abs(i // 3 - t // 3) + abs(i % 3 - t % 3) for i, t in enumerate(s) if t)

def neighbours(s):
    i = s.index(0)
    r, c = divmod(i, 3)
    for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        if 0 <= r + dr < 3 and 0 <= c + dc < 3:
            j = (r + dr) * 3 + c + dc
            t = list(s)
            t[i], t[j] = t[j], t[i]
            yield tuple(t)

def astar(start, h):
    frontier, best, expanded = [(h(start), 0, start)], {start: 0}, 0
    while frontier:
        f, g, s = heapq.heappop(frontier)
        if s == GOAL:
            return g, expanded
        if g > best[s]:
            continue
        expanded += 1
        for t in neighbours(s):
            if g + 1 < best.get(t, 99):
                best[t] = g + 1
                heapq.heappush(frontier, (g + 1 + h(t), g + 1, t))

start = (7, 2, 4,
         5, 0, 6,
         8, 3, 1)
print(h1(start), h2(start))                 # 8 18 ← true cost is 26
print(astar(start, lambda s: 0))            # (26, 162240) ← h = 0 is uniform-cost search
print(astar(start, h1))                     # (26, 44988)
print(astar(start, h2))                     # (26, 4085)
```

All three find the optimal 26-move solution; Manhattan distance does it with roughly <strong>40× fewer</strong> expansions than no heuristic.

# Dominance and the effective branching factor

> [!INFO]
>
> <strong>Dominance</strong> — if `h₂(n) ≥ h₁(n)` for every `n` and both are admissible, `h₂` <strong>dominates</strong> `h₁` and A\* with `h₂` never expands more nodes. Larger is better — as long as it stays admissible.

To compare heuristics independently of problem size, compute the <strong>effective branching factor</strong> `b*`: the branching factor a uniform tree of depth `d` would need to contain the `N` nodes A\* expanded. Close to 1 is ideal.

`N + 1 = 1 + b* + (b*)² + … + (b*)ᵈ`

```python filename:Python
def effective_branching(n_expanded, depth):
    lo, hi = 1.0, 10.0
    for _ in range(60):                        # bisection
        b = (lo + hi) / 2
        total = sum(b ** i for i in range(depth + 1))
        lo, hi = (b, hi) if total < n_expanded + 1 else (lo, b)
    return round(b, 2)

print(effective_branching(162240, 26))     # 1.52 ← no heuristic
print(effective_branching(44988, 26))      # 1.44 ← misplaced tiles
print(effective_branching(4085, 26))       # 1.3 ← Manhattan distance
```

# Recipes for heuristics

> [!NOTE] Relax the problem
>
> Remove constraints until the problem is easy to solve exactly: straight-line distance (ignore roads), Manhattan distance (ignore other tiles), ignore-preconditions in planning.

> [!NOTE] Max of admissible heuristics
>
> `h(n) = max(h₁(n), …, hₖ(n))` is admissible and dominates each component — use it when no single one is best everywhere.

> [!NOTE] Pattern databases
>
> Precompute exact costs for a sub-problem (e.g. tiles 1–4 only) for every configuration and look them up. Disjoint patterns can be <em>added</em>. Solves the 15-puzzle and Rubik's cube quickly.

> [!NOTE] Learn a heuristic
>
> Train a model to predict cost-to-go from features of a state (AlphaGo's value network is a learned evaluation). Fast, but no admissibility guarantee.

| Domain | Admissible heuristic |
| --- | --- |
| Grid, 4-way moves | Manhattan distance `&#124;dx&#124; + &#124;dy&#124;` |
| Grid, 8-way moves (diagonal cost √2) | Octile distance `max(dx, dy) + (√2 − 1)·min(dx, dy)` |
| Any-angle / road maps | Euclidean (straight-line) distance |
| Travelling salesperson | Cost of a minimum spanning tree of unvisited cities |

> [!WARNING] Watch out
>
> Manhattan distance is <strong>not</strong> admissible on an 8-connected grid — one diagonal step (cost √2 ≈ 1.41) covers Manhattan distance 2, so it overestimates.

```question
What makes a heuristic admissible? Give one for the 8-puzzle.

---

It never overestimates the true cost to the goal. Manhattan distance: every tile must move at least its row and column offset, one square per move, so the sum can't exceed the real number of moves.
```

```question
Admissible vs consistent?

---

Admissible: `h(n) ≤ h*(n)`. Consistent: `h(n) ≤ c(n, n′) + h(n′)` for every edge — a stronger condition that implies admissibility and guarantees `f` is non-decreasing along paths, so graph-search A\* never needs to re-open nodes.
```

```question
If h₂ dominates h₁, is h₂ always better?

---

It never expands more nodes, but it may cost more to <em>compute</em> per node. The best heuristic balances accuracy against evaluation time.
```
