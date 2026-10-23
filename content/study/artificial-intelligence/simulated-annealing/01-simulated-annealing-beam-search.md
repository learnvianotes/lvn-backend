---
id: 46f69a0d-4f2a-7f84-8ee1-a63141f21c39
key: topic:artificial-intelligence/simulated-annealing
subject: artificial-intelligence
topic: simulated-annealing
title: Simulated Annealing & Beam Search
slug: simulated-annealing-beam-search
order: 1
---

Simulated annealing is hill climbing that sometimes accepts a <em>worse</em> move — often early on, rarely later — so it can shake itself out of local optima. Beam search keeps several states instead of one.

The name comes from metallurgy: heating metal and cooling it slowly lets atoms settle into a low-energy crystal. The algorithm picks a <strong>random</strong> neighbour; if it is better it always moves, and if it is worse by `ΔE` it moves with probability:

`P(accept worse move) = e^(−ΔE / T)`

```python filename:Python
import math

accept = {T: [round(math.exp(-delta / T), 3) for delta in (1, 2, 5)] for T in (10, 1, 0.1)}
print(accept[10])      # [0.905, 0.819, 0.607] ← hot: almost any move is accepted (ΔE = 1, 2, 5)
print(accept[1])       # [0.368, 0.135, 0.007]
print(accept[0.1])     # [0.0, 0.0, 0.0] ← cold: pure hill climbing
```

The <strong>temperature</strong> `T` starts high (random walk) and decreases according to a <strong>schedule</strong> (e.g. `T ← 0.99·T`). As `T → 0` it becomes plain hill climbing. If `T` is lowered slowly enough, it finds the global optimum with probability approaching 1.

```python filename:Python
import math
import random

def conflicts(s):
    return sum(1 for i in range(8) for j in range(i + 1, 8) if s[i] == s[j] or abs(s[i] - s[j]) == j - i)

def simulated_annealing(state, T=2.0, cooling=0.995, steps=20000):
    for t in range(steps):
        if conflicts(state) == 0:
            return state, t
        col, row = random.randrange(8), random.randrange(8)
        nxt = state[:col] + (row,) + state[col + 1:]           # a random neighbour
        delta = conflicts(nxt) - conflicts(state)              # > 0 means worse
        if delta <= 0 or random.random() < math.exp(-delta / T):
            state = nxt
        T = max(T * cooling, 1e-3)                             # cooling schedule
    return state, steps

random.seed(1)
start = tuple(random.randrange(8) for _ in range(8))      # the start where hill climbing got stuck
end, t = simulated_annealing(start)
print(end, conflicts(end), t)                             # (2, 5, 7, 0, 3, 6, 4, 1) 0 711
```

# Local beam search

Keep <strong>k</strong> states instead of one. Each step, generate all successors of all `k` states and keep the best `k` overall. Unlike `k` independent restarts, information is shared: states on a good hill attract the whole beam.

> [!NOTE] Local beam search
>
> Deterministic: top-`k` of all successors. Risk: the beam collapses into one small region (lack of diversity).

> [!NOTE] Stochastic beam search
>
> Choose `k` successors at random, weighted by value — keeps diversity. Resembles natural selection, leading to genetic algorithms.

> [!NOTE] Beam search in NLP
>
> The same idea decodes text from a language model: keep the `k` most probable partial sentences at each step (see <strong>Generative AI</strong>).

| Method | States kept | Accepts worse moves? | Complete? |
| --- | --- | --- | --- |
| Hill climbing | 1 | No | No |
| Random-restart HC | 1 (many runs) | No | With probability → 1 |
| Simulated annealing | 1 | Yes, with prob. `e^(−ΔE/T)` | With a slow enough schedule (in the limit) |
| Local beam search | `k` | Only via the beam | No |
| Genetic algorithm | Population | Yes (selection is stochastic) | No |

> [!WARNING] Watch out
>
> The cooling schedule is the hard part: too fast and it freezes in a local optimum like hill climbing; too slow and it wastes time as a random walk. Tune the start temperature so early acceptance of worse moves is high (\~80%).

```question
How does simulated annealing escape local optima?

---

It accepts worse moves with probability `e^(−ΔE/T)`. At high temperature many downhill moves are accepted (exploration); as `T` falls, it accepts fewer and settles into a good optimum (exploitation).
```

```question
Local beam search vs k random restarts?

---

Restarts run independently. Beam search pools all successors and keeps the best `k`, so effort moves to the most promising regions — faster, but prone to losing diversity.
```
