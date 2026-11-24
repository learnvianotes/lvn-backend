---
id: 76e801fa-6222-7f9d-a10c-a7e2f6063cc5
key: topic:artificial-intelligence/problem-formulation
subject: artificial-intelligence
topic: problem-formulation
title: Problem Formulation & State Spaces
slug: problem-formulation-state-spaces
order: 1
---

Before an agent can search for a solution, the problem must be stated precisely: what a state is, which actions exist, what they do, what counts as the goal and what each step costs. A good formulation can shrink the search space by orders of magnitude.

# The five components of a search problem

| Component | Meaning | Route finding (Romania) | 8-puzzle |
| --- | --- | --- | --- |
| <strong>Initial state</strong> | Where the agent starts | In(Arad) | A scrambled board |
| <strong>Actions(s)</strong> | Moves applicable in state `s` | Drive to a neighbouring city | Slide the blank Up/Down/Left/Right |
| <strong>Transition model</strong> Result(s, a) | The state an action leads to | In(Sibiu) after driving Arad → Sibiu | Board with blank and tile swapped |
| <strong>Goal test</strong> | Is `s` a goal? | In(Bucharest) | Tiles in order 0–8 |
| <strong>Path cost</strong> | Sum of step costs `c(s, a, s′)` | Road kilometres | 1 per move |

Initial state + actions + transition model define the <strong>state space</strong> — a graph whose nodes are states and edges are actions. A <strong>solution</strong> is an action sequence from the initial state to a goal; an <strong>optimal</strong> solution has the lowest path cost.

# Formulating the 8-puzzle

```python filename:Python
from collections import deque

GOAL = (0, 1, 2,
        3, 4, 5,
        6, 7, 8)                       # 0 is the blank

def actions(state):
    row, col = divmod(state.index(0), 3)
    moves = []
    if row > 0: moves.append("Up")
    if row < 2: moves.append("Down")
    if col > 0: moves.append("Left")
    if col < 2: moves.append("Right")
    return moves

def result(state, action):              # transition model: slide the blank
    i = state.index(0)
    j = i + {"Up": -3, "Down": 3, "Left": -1, "Right": 1}[action]
    s = list(state)
    s[i], s[j] = s[j], s[i]
    return tuple(s)

start = (3, 1, 2,
         0, 4, 5,
         6, 7, 8)
print(actions(start))                            # ['Up', 'Down', 'Right']
print(result(start, "Up") == GOAL)               # True

# the whole state space reachable from the goal, by breadth-first expansion
seen, frontier = {GOAL}, deque([GOAL])
while frontier:
    s = frontier.popleft()
    for a in actions(s):
        t = result(s, a)
        if t not in seen:
            seen.add(t)
            frontier.append(t)
print(len(seen))                                 # 181440 ← 9!/2: only half of all 9! boards are reachable
```

# Formulation decides the size of the space

| Problem | Formulation | States |
| --- | --- | --- |
| 8-queens | Add queens anywhere, one at a time (64 squares, 8 queens) | 64 · 63 · … · 57 ≈ 1.8 × 10¹⁴ sequences |
| 8-queens | One queen per column, left to right, never attacking an earlier one | 2,057 |
| 8-puzzle | All boards | 9!/2 = 181,440 reachable |
| 15-puzzle | All boards | 16!/2 ≈ 1.05 × 10¹³ |
| Rubik's cube | All positions | ≈ 4.3 × 10¹⁹ |

> [!NOTE] Key point
>
> <strong>Abstraction</strong> is the art of formulation: drop every detail that doesn't affect the solution (the radio, the weather, the exact route between cities). A good abstraction is valid (every abstract solution maps to a real one) and useful (the abstract actions are easy to carry out).

# Search trees, frontiers and repeated states

Search algorithms grow a <strong>search tree</strong> over the state space. Each <strong>node</strong> stores a state, its parent, the action that produced it, the path cost `g` and the depth. The <strong>frontier</strong> (open list) holds generated-but-not-expanded nodes; the order in which it is expanded is the <em>only</em> difference between most search strategies.

1. <strong>Initialise</strong>

   Put a node for the initial state on the frontier.

2. <strong>Choose</strong>

   Remove a node from the frontier according to the strategy (FIFO, LIFO, lowest cost…).

3. <strong>Test</strong>

   If its state is a goal, return the path (follow parent links back).

4. <strong>Expand</strong>

   Otherwise generate its children — one per applicable action — and add them to the frontier.

5. <strong>Repeat</strong>

   Until the frontier is empty → failure.

> [!TIP] Do
>
> Use <strong>graph search</strong>: keep a <em>reached/explored</em> set so each state is expanded at most once — cycles and redundant paths (A→B→A→B…) are pruned.

> [!DANGER] Avoid
>
> Plain <strong>tree search</strong> on a graph with cycles or many paths to the same state — it can loop forever or blow up exponentially.

# Measuring a search strategy

| Criterion | Question | Symbols used |
| --- | --- | --- |
| <strong>Completeness</strong> | Is it guaranteed to find a solution when one exists? | `b` = branching factor (max children per node) |
| <strong>Optimality</strong> (cost-optimal) | Does it find the lowest-cost solution? | `d` = depth of the shallowest goal |
| <strong>Time complexity</strong> | How many nodes does it generate? | `m` = maximum depth of the state space (may be ∞) |
| <strong>Space complexity</strong> | How many nodes are in memory at once? | `C*` = optimal cost, `ε` = smallest step cost |

```question
What are the components of a well-defined search problem?

---

Initial state, actions, transition model, goal test and path-cost function. The first three implicitly define the state space.
```

```question
What is the difference between a state and a node?

---

A state is a configuration of the world. A node is a bookkeeping structure in the search tree: a state plus parent pointer, action, path cost and depth. The same state can appear in many nodes (reached by different paths).
```

```question
Tree search vs graph search?

---

Graph search remembers visited states and never re-expands them, so it avoids loops and redundant paths at the cost of memory. Tree search keeps no such set and can revisit states indefinitely.
```
