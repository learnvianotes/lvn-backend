---
id: 301d4b94-4daf-7b7c-afdf-bf7ef692759d
key: topic:artificial-intelligence/hill-climbing
subject: artificial-intelligence
topic: hill-climbing
title: Hill Climbing
slug: hill-climbing
order: 1
---

When only the final state matters — not the path — local search keeps <strong>one current state</strong> and repeatedly moves to a better neighbour. It uses almost no memory and handles huge or continuous spaces, but it can get stuck.

> [!INFO]
>
> <strong>Local search</strong> — an optimisation method that works on <strong>complete-state</strong> formulations (every state is a full candidate solution) and improves it by small changes. Used for n-queens, scheduling, circuit layout, travelling salesperson, and — in continuous form — training neural networks by gradient descent.

The <strong>objective function</strong> (or cost) defines a <strong>state-space landscape</strong>. Hill climbing moves uphill (maximising) or downhill (minimising cost) until no neighbour is better.

# Steepest-ascent hill climbing on 8-queens

State: one queen per column, `state[c]` = its row. Neighbours: move one queen within its column (8 × 7 = 56 neighbours). Cost `h`: pairs of queens attacking each other.

```python filename:Python
def conflicts(state):                     # number of attacking pairs; 0 = solved
    n = len(state)
    return sum(1 for i in range(n) for j in range(i + 1, n)
               if state[i] == state[j] or abs(state[i] - state[j]) == j - i)

import random

def neighbours(state):
    for col in range(len(state)):
        for row in range(len(state)):
            if row != state[col]:
                yield state[:col] + (row,) + state[col + 1:]

def hill_climb(state):
    steps = 0
    while True:
        best = min(neighbours(state), key=conflicts)
        if conflicts(best) >= conflicts(state):
            return state, steps                 # no neighbour is better: a peak (or plateau)
        state, steps = best, steps + 1

random.seed(1)
start = tuple(random.randrange(8) for _ in range(8))
end, steps = hill_climb(start)
print(start, conflicts(start))             # (2, 1, 4, 1, 7, 7, 7, 6) 9
print(end, conflicts(end), steps)          # (5, 2, 4, 1, 7, 0, 3, 6) 1 4 ← stuck: a local minimum

starts = [tuple(random.randrange(8) for _ in range(8)) for _ in range(200)]
solved = sum(conflicts(hill_climb(s)[0]) == 0 for s in starts)
print(f"{solved}/200 random starts solved")    # 31/200 random starts solved
```

# Why it gets stuck

> [!NOTE] Local maximum
>
> A peak higher than every neighbour but lower than the global maximum. Every move looks worse, so the search stops.

> [!NOTE] Plateau / shoulder
>
> A flat region: all neighbours have the same value. No gradient to follow — the search wanders or stops.

> [!NOTE] Ridge
>
> A sequence of local maxima that rises diagonally; single moves in any axis go down, so progress is very slow.

# Variants that escape

| Variant | Idea | Effect on 8-queens (textbook figures) |
| --- | --- | --- |
| Steepest ascent | Take the best neighbour | Solves \~14% of starts, in \~4 steps |
| <strong>Sideways moves</strong> | Allow up to <em>k</em> moves to equal-valued neighbours (plateaus) | \~94% solved, \~21 steps |
| <strong>Stochastic</strong> hill climbing | Pick randomly among uphill moves, weighted by steepness | Slower but finds better peaks on some landscapes |
| <strong>First-choice</strong> | Generate random neighbours until one is better | Good when there are thousands of neighbours |
| <strong>Random-restart</strong> | Run from random starts until a solution appears | Complete with probability → 1; expected restarts ≈ 1/p |

```python filename:Python
def conflicts(state):                     # number of attacking pairs; 0 = solved
    n = len(state)
    return sum(1 for i in range(n) for j in range(i + 1, n)
               if state[i] == state[j] or abs(state[i] - state[j]) == j - i)

import random

def hill_climb(state):
    while True:
        nbrs = [state[:c] + (r,) + state[c + 1:] for c in range(8) for r in range(8) if r != state[c]]
        best = min(nbrs, key=conflicts)
        if conflicts(best) >= conflicts(state):
            return state
        state = best

def random_restart(seed):
    random.seed(seed)
    restarts = 0
    while True:
        result = hill_climb(tuple(random.randrange(8) for _ in range(8)))
        if conflicts(result) == 0:
            return result, restarts
        restarts += 1

print(random_restart(1))     # ((5, 1, 6, 0, 2, 4, 7, 3), 3)
```

> [!NOTE] Key point
>
> Random-restart hill climbing is surprisingly strong: with success probability `p` per run, it needs `1/p` runs on average. For 8-queens, `p ≈ 0.14` gives \~7 runs; with sideways moves, millions of queens can be solved in seconds.

> [!WARNING] Watch out
>
> Hill climbing is <strong>incomplete</strong> — it can stop at a local optimum and report it as the answer. Always ask: what is the landscape like, and how will the search escape a local optimum?

```question
What is the main weakness of hill climbing and how do you fix it?

---

It gets stuck on local maxima, plateaus and ridges because it only accepts improvements. Fixes: random restarts, sideways moves, stochastic moves, or accepting some downhill moves (simulated annealing).
```

```question
How is gradient descent related to hill climbing?

---

Gradient descent is hill climbing (descending) in a continuous space: the neighbour is chosen by stepping along the negative gradient. It has the same local-minimum issue, softened in deep learning by noise (SGD), momentum and the high-dimensional landscape.
```
