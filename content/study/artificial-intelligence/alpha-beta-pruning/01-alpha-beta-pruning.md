---
id: 5a0ca1ec-fae8-7128-b3f9-9793f6d3771b
key: topic:artificial-intelligence/alpha-beta-pruning
subject: artificial-intelligence
topic: alpha-beta-pruning
title: Alpha-Beta Pruning
slug: alpha-beta-pruning
order: 1
---

Alpha-beta pruning returns exactly the minimax value while skipping branches that cannot affect the decision. With good move ordering it searches roughly <strong>twice as deep</strong> in the same time.

> [!INFO]
>
> <strong>α (alpha)</strong> — the best value MAX can already guarantee somewhere along the path to the root — a lower bound.

> [!INFO]
>
> <strong>β (beta)</strong> — the best (lowest) value MIN can already guarantee along the path — an upper bound.

While searching, if a node's value is proven to be outside `[α, β]`, the player above will never let the game reach it, so its remaining children are <strong>pruned</strong>: whenever `α ≥ β`.

```python filename:Python
TREE = {"A": ["B", "C", "D"],
        "B": [3, 12, 8], "C": [2, 4, 6], "D": [14, 5, 2]}
visited = []

def alphabeta(node, alpha, beta, maximizing):
    if isinstance(node, int):
        visited.append(node)
        return node
    if maximizing:
        value = float("-inf")
        for child in TREE[node]:
            value = max(value, alphabeta(child, alpha, beta, False))
            alpha = max(alpha, value)
            if alpha >= beta:
                break                              # β cut-off: MIN above won't allow this
        return value
    value = float("inf")
    for child in TREE[node]:
        value = min(value, alphabeta(child, alpha, beta, True))
        beta = min(beta, value)
        if alpha >= beta:
            break                                  # α cut-off: MAX above already has better
    return value

print(alphabeta("A", float("-inf"), float("inf"), True))   # 3 ← same answer as minimax
print(visited, f"{len(visited)} of 9 leaves")               # [3, 12, 8, 2, 14, 5, 2] 7 of 9 leaves
```

1. <strong>Explore B</strong>

   MIN sees 3, 12, 8 → B = 3. At the root α = 3: MAX is guaranteed at least 3.

2. <strong>First leaf of C is 2</strong>

   MIN at C can force ≤ 2, which is worse for MAX than the 3 it already has — so C's other leaves (4, 6) are <strong>pruned</strong>.

3. <strong>Explore D</strong>

   14 → 5 → 2: D's value is only bounded after the last leaf, so nothing is pruned there.

4. <strong>Result</strong>

   Root = max(3, ≤2, 2) = 3 — identical to minimax, with 7 leaves instead of 9.

# Move ordering is everything

Pruning depends on examining the <strong>best moves first</strong>. On a random tree of depth 4 with 4 moves per node (256 leaves):

```python filename:Python
import random

random.seed(3)
B, DEPTH = 4, 4
def build(depth):
    return random.randint(0, 99) if depth == 0 else [build(depth - 1) for _ in range(B)]
tree = build(DEPTH)

def minimax(node, maximizing):
    if isinstance(node, int):
        return node
    vals = [minimax(c, not maximizing) for c in node]
    return max(vals) if maximizing else min(vals)

def alphabeta(node, alpha, beta, maximizing, order, count):
    if isinstance(node, int):
        count[0] += 1
        return node
    best = float("-inf") if maximizing else float("inf")
    for child in order(node, maximizing):
        v = alphabeta(child, alpha, beta, not maximizing, order, count)
        if maximizing:
            best, alpha = max(best, v), max(alpha, v)
        else:
            best, beta = min(best, v), min(beta, v)
        if alpha >= beta:
            break
    return best

as_given = lambda node, maximizing: node
worst_first = lambda node, maximizing: sorted(node, key=lambda c: minimax(c, not maximizing), reverse=not maximizing)
best_first = lambda node, maximizing: sorted(node, key=lambda c: minimax(c, not maximizing), reverse=maximizing)

counts = {}
for name, order in [("worst-first", worst_first), ("as generated", as_given), ("best-first", best_first)]:
    count = [0]
    alphabeta(tree, float("-inf"), float("inf"), True, order, count)
    counts[name] = count[0]

print(minimax(tree, True), B ** DEPTH)     # 47 256 ← value, and leaves plain minimax looks at
print(counts["worst-first"])               # 238
print(counts["as generated"])              # 61
print(counts["best-first"])                # 31 ← 2·b^(d/2) − 1 = 31: the theoretical minimum
```

| Move ordering | Nodes examined | Effective branching factor | Depth reachable in the same time |
| --- | --- | --- | --- |
| Worst (best moves last) | `O(bᵐ)` — no pruning | `b` | `d` |
| Random | ≈ `O(b^(3m/4))` | ≈ `b^(3/4)` | ≈ `4d/3` |
| Perfect (best moves first) | `O(b^(m/2))` | `√b` (chess: 35 → \~6) | `2d` |

> [!NOTE] Iterative deepening
>
> Search depth 1, 2, 3… and try the previous iteration's best move first — the deeper search inherits a near-perfect ordering.

> [!NOTE] Killer moves
>
> Moves that caused a cut-off at the same depth elsewhere are likely to cause one here — try them early.

> [!NOTE] History heuristic
>
> Keep a score of moves that caused cut-offs anywhere; order by it.

> [!NOTE] Transposition table
>
> Hash positions already evaluated (reached by different move orders) and reuse their values and best moves.

> [!WARNING] Watch out
>
> Alpha-beta never changes the minimax value at the root — if your pruned search returns a different move value than plain minimax, there's a bug (usually α/β passed or updated at the wrong level).

```question
What is alpha-beta pruning?

---

An optimisation of minimax that tracks α (MAX's best guaranteed value) and β (MIN's best guaranteed value) along the current path. When `α ≥ β` at a node, the remaining children can't influence the decision and are skipped. The result equals minimax.
```

```question
What is the best-case complexity of alpha-beta and what does it require?

---

`O(b^(m/2))` — the square root of minimax's `O(bᵐ)`, so it can search about twice as deep. It requires perfect move ordering: the best move examined first at every node.
```
