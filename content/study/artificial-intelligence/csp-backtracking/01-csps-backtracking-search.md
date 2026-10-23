---
id: 60587fc2-6791-7d8e-a3fc-5436ce9be620
key: topic:artificial-intelligence/csp-backtracking
subject: artificial-intelligence
topic: csp-backtracking
title: CSPs & Backtracking Search
slug: csps-backtracking-search
order: 1
---

A constraint satisfaction problem (CSP) describes a state as <strong>variables with domains</strong> and the goal as a set of <strong>constraints</strong>. That factored structure lets one general-purpose solver handle map colouring, Sudoku, scheduling and timetabling — and prune huge parts of the search space.

> [!INFO]
>
> <strong>CSP</strong> — a triple <strong>(X, D, C)</strong>: variables `X₁…Xₙ`, a domain `Dᵢ` of allowed values for each, and constraints `C` that restrict which combinations of values are allowed. A <strong>solution</strong> is a <em>complete</em> and <em>consistent</em> assignment — every variable has a value and no constraint is violated.

# Example: colouring the map of Australia

| Part | Map colouring |
| --- | --- |
| Variables | WA, NT, SA, Q, NSW, V, T (the seven states and territories) |
| Domains | {red, green, blue} for each |
| Constraints | Neighbouring regions differ: WA ≠ NT, WA ≠ SA, NT ≠ SA, NT ≠ Q, SA ≠ Q, SA ≠ NSW, SA ≠ V, Q ≠ NSW, NSW ≠ V |

Binary constraints form a <strong>constraint graph</strong>: nodes are variables, edges connect variables that share a constraint. Tasmania (T) has no edges — an independent sub-problem.

# Kinds of constraints and problems

| Kind | Example |
| --- | --- |
| Unary (one variable) | SA ≠ green |
| Binary (two variables) | WA ≠ NT |
| Global / higher-order | `Alldiff(F, T, U, W, R, O)` in cryptarithmetic; each Sudoku row/column/box |
| Preference (soft) | “Prof. X prefers mornings” → a <strong>constraint optimisation</strong> problem |

Sudoku: 81 variables, domain 1–9, 27 Alldiff constraints · N-queens · exam timetabling · job-shop scheduling · SEND + MORE = MONEY · circuit layout · register allocation (graph colouring)

# Backtracking search

Backtracking is depth-first search that assigns <strong>one variable per level</strong>, checks constraints immediately and undoes the last choice when no value fits. Because assignment order doesn't matter (commutativity), it explores `dⁿ` leaves instead of the `n!·dⁿ` a naive search would.

```python filename:Python
NEIGHBOURS = {"WA": ["NT", "SA"], "NT": ["WA", "SA", "Q"], "SA": ["WA", "NT", "Q", "NSW", "V"],
              "Q": ["NT", "SA", "NSW"], "NSW": ["Q", "SA", "V"], "V": ["SA", "NSW"], "T": []}
COLOURS = ["red", "green", "blue"]

def consistent(var, colour, assignment):
    return all(assignment.get(n) != colour for n in NEIGHBOURS[var])

def backtrack(assignment, stats):
    if len(assignment) == len(NEIGHBOURS):
        return assignment                                   # complete and consistent
    var = next(v for v in NEIGHBOURS if v not in assignment)  # first unassigned variable
    for colour in COLOURS:
        stats["tried"] += 1
        if consistent(var, colour, assignment):
            assignment[var] = colour
            if backtrack(assignment, stats):
                return assignment
            del assignment[var]                             # undo and try the next value
    return None                                             # no value works → backtrack

stats = {"tried": 0}
print(backtrack({}, stats))     # {'WA': 'red', 'NT': 'green', 'SA': 'blue', 'Q': 'red', 'NSW': 'green', 'V': 'red', 'T': 'red'}
print(stats)                    # {'tried': 11}
```

# Counting every solution: 8-queens

```python filename:Python
def queens(n):
    solutions, nodes = [], 0
    def place(rows):                          # rows[c] = row of the queen in column c
        nonlocal nodes
        nodes += 1
        if len(rows) == n:
            solutions.append(rows)
            return
        c = len(rows)
        for r in range(n):
            if all(r != r2 and abs(r - r2) != c - c2 for c2, r2 in enumerate(rows)):
                place(rows + [r])
    place([])
    return solutions, nodes

solutions, nodes = queens(8)
print(len(solutions), nodes)     # 92 2057 ← 92 solutions; 2,057 consistent partial boards visited (incl. the empty one)
print(solutions[0])              # [0, 4, 7, 5, 2, 6, 1, 3]
```

> [!NOTE] Key point
>
> Plain backtracking already beats generate-and-test (8⁸ ≈ 16.8 million full boards) by checking constraints on <em>partial</em> assignments. The next topic makes it smarter: choose variables and values wisely, and propagate constraints ahead.

```question
What is a CSP? Give an example.

---

A problem defined by variables, domains and constraints, solved by finding an assignment that satisfies all constraints. Examples: map colouring, Sudoku, N-queens, timetabling.
```

```question
Why is backtracking better than plain DFS over assignments?

---

It fixes one variable per tree level (assignments commute) and checks constraints as soon as a variable is assigned, abandoning a partial assignment the moment it violates a constraint instead of completing it first.
```
