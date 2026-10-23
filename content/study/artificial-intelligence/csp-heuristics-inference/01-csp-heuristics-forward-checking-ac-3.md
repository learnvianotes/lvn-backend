---
id: 1da7fb9c-78f2-7c6e-a93a-d9179853a5b1
key: topic:artificial-intelligence/csp-heuristics-inference
subject: artificial-intelligence
topic: csp-heuristics-inference
title: CSP Heuristics, Forward Checking & AC-3
slug: csp-heuristics-forward-checking-ac-3
order: 1
---

Three questions make backtracking fast: <strong>which variable</strong> next, <strong>which value</strong> first, and <strong>what can we infer</strong> after each assignment. Good answers turn exponential searches into near-linear ones.

| Heuristic | Rule | Intuition |
| --- | --- | --- |
| <strong>MRV</strong> — minimum remaining values | Pick the variable with the fewest legal values left | <em>Fail first</em>: tackle the most constrained variable before it becomes impossible |
| <strong>Degree heuristic</strong> | Tie-break by the variable involved in the most constraints with unassigned variables | Reduces future branching (SA first in Australia) |
| <strong>LCV</strong> — least constraining value | Try the value that rules out the fewest choices for neighbours | <em>Fail last</em>: leave maximum flexibility — we only need one solution |

# Inference: forward checking and arc consistency

> [!NOTE] Forward checking
>
> After assigning `X = v`, delete `v`-inconsistent values from the domains of `X`'s unassigned neighbours. If a domain becomes empty, backtrack immediately.

> [!NOTE] Arc consistency
>
> Arc `X → Y` is consistent if every value of `X` has <em>some</em> supporting value in `Y`. AC-3 enforces this for all arcs, propagating deletions until nothing changes.

> [!NOTE] MAC
>
> <em>Maintaining arc consistency</em>: run AC-3 after every assignment during backtracking — stronger than forward checking.

```python filename:Python
def solve(n, mrv=False, forward_check=False):
    nodes = 0
    def backtrack(assign, domains):
        nonlocal nodes
        if len(assign) == n:
            return dict(assign)
        free = [c for c in range(n) if c not in assign]
        var = min(free, key=lambda c: len(domains[c])) if mrv else free[0]
        for row in sorted(domains[var]):
            if any(row == r or abs(row - r) == abs(var - c) for c, r in assign.items()):
                continue
            nodes += 1
            assign[var] = row
            new = domains
            if forward_check:              # prune neighbours' domains; empty domain → dead end
                new = {c: d if c in assign else {x for x in d if x != row and abs(x - row) != abs(c - var)}
                       for c, d in domains.items()}
            if all(new[c] for c in new if c not in assign) and (res := backtrack(assign, new)):
                return res
            del assign[var]
        return None
    backtrack({}, {c: set(range(n)) for c in range(n)})
    return nodes

print(solve(16))                                  # 10052 ← plain backtracking
print(solve(16, forward_check=True))              # 7560
print(solve(16, mrv=True, forward_check=True))    # 44 ← MRV + forward checking
```

# AC-3

1. <strong>Queue every arc</strong>

   For each binary constraint between X and Y add both arcs `(X, Y)` and `(Y, X)`.

2. <strong>Revise</strong>

   Pop an arc `(X, Y)`; delete each value of `X` that has no compatible value in `Y`'s domain.

3. <strong>Propagate</strong>

   If `X`'s domain shrank, re-queue every arc `(Z, X)` for neighbours `Z ≠ Y`.

4. <strong>Stop</strong>

   When the queue is empty (arc-consistent) — or a domain becomes empty (no solution).

```python filename:Python
from collections import deque

def ac3(domains, constraints):
    """constraints: {(X, Y): predicate(x, y)} — both directions must be listed."""
    queue = deque(constraints)
    while queue:
        x, y = queue.popleft()
        ok = constraints[(x, y)]
        removed = {vx for vx in domains[x] if not any(ok(vx, vy) for vy in domains[y])}
        if removed:
            domains[x] -= removed
            if not domains[x]:
                return False                                  # inconsistency detected
            queue.extend((z, w) for (z, w) in constraints if w == x and z != y)
    return True

# X < Y < Z with values 1..3: propagation alone solves it
doms = {v: {1, 2, 3} for v in "XYZ"}
lt, gt = (lambda a, b: a < b), (lambda a, b: a > b)
print(ac3(doms, {("X", "Y"): lt, ("Y", "X"): gt, ("Y", "Z"): lt, ("Z", "Y"): gt}), doms)   # True {'X': {1}, 'Y': {2}, 'Z': {3}}

# Australia after WA = red, Q = green: forward checking leaves NT = SA = {blue} and doesn't notice…
edges = [("WA", "NT"), ("WA", "SA"), ("NT", "SA"), ("NT", "Q"), ("SA", "Q"), ("SA", "NSW"),
         ("SA", "V"), ("Q", "NSW"), ("NSW", "V")]
ne = lambda a, b: a != b
cons = {**{(a, b): ne for a, b in edges}, **{(b, a): ne for a, b in edges}}
doms = {v: {"red", "green", "blue"} for v in ["WA", "NT", "SA", "Q", "NSW", "V", "T"]}
doms["WA"], doms["Q"] = {"red"}, {"green"}
print(ac3(doms, cons))       # False ← …AC-3 proves there is no solution with this partial assignment
```

AC-3 runs in `O(c·d³)` for `c` arcs and domain size `d`. Arc consistency alone doesn't always find a solution (map colouring with 2 colours on a triangle stays arc-consistent), but combined with search it removes most dead ends early.

# Local search for CSPs: min-conflicts

Start from a complete (inconsistent) assignment; repeatedly pick a conflicted variable and give it the value with the <strong>fewest conflicts</strong>. Remarkably effective on large, loosely constrained problems — started from a greedy initial assignment it solves the million-queens problem in about 50 steps on average, and it is used for real-time rescheduling.

```python filename:Python
import random

def min_conflicts(n, max_steps=1000):
    rows = [random.randrange(n) for _ in range(n)]
    def conflicts(c, r):
        return sum(1 for c2 in range(n) if c2 != c and (rows[c2] == r or abs(rows[c2] - r) == abs(c2 - c)))
    for step in range(max_steps):
        bad = [c for c in range(n) if conflicts(c, rows[c])]
        if not bad:
            return rows, step
        c = random.choice(bad)
        rows[c] = min(range(n), key=lambda r: (conflicts(c, r), random.random()))   # random tie-break
    return None, max_steps

random.seed(0)
rows, steps = min_conflicts(40)
print(steps)     # 152 ← steps to solve 40-queens from a random start
```

# Exploiting problem structure

| Structure | Technique | Cost |
| --- | --- | --- |
| Independent sub-problems (Tasmania) | Solve connected components separately | `O(dᶜ · n/c)` instead of `O(dⁿ)` |
| Tree-structured constraint graph | Order topologically, make arcs consistent backwards, assign forwards | `O(n·d²)` — linear in `n` |
| Nearly a tree | <strong>Cutset conditioning</strong>: assign a small cycle cutset, solve the remaining tree | `O(dᶜ · (n − c)·d²)` |
| Symmetric values | Symmetry-breaking constraints (e.g. NT &lt; SA &lt; WA) | Removes equivalent solutions |

```question
Explain MRV and LCV — why is one 'fail first' and the other 'fail last'?

---

MRV picks the variable with the fewest legal values: every variable must be assigned eventually, so discovering a dead end early saves work. LCV orders the chosen variable's values so the one that leaves neighbours the most options comes first: we only need one solution, so try the value most likely to succeed.
```

```question
Forward checking vs arc consistency?

---

Forward checking only prunes the domains of variables directly connected to the one just assigned. Arc consistency (AC-3) propagates further: every arc is revised until stable, catching conflicts between two <em>unassigned</em> variables — like NT and SA both reduced to {blue}.
```

```question
What is the time complexity of AC-3?

---

`O(c·d³)`: each of the `c` arcs can be re-queued at most `d` times (once per deleted value), and revising an arc costs `O(d²)`.
```
