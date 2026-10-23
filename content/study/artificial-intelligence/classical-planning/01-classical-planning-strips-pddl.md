---
id: 87650d5b-2b9c-71e5-a39d-47dc328f3684
key: topic:artificial-intelligence/classical-planning
subject: artificial-intelligence
topic: classical-planning
title: Classical Planning (STRIPS & PDDL)
slug: classical-planning-strips-pddl
order: 1
---

Planning finds a sequence of actions that achieves a goal, using a <strong>factored</strong> representation: states are sets of facts and actions are schemas with preconditions and effects. That structure allows domain-independent heuristics that make planners scale to huge problems.

# The STRIPS representation

| Part | Meaning | Blocks world |
| --- | --- | --- |
| State | Conjunction of ground facts (fluents); everything else is false (closed world) | `On(C, A) ∧ OnTable(A) ∧ OnTable(B) ∧ Clear(C) ∧ Clear(B)` |
| Goal | Conjunction of facts that must hold (a partial state) | `On(A, B) ∧ On(B, C)` |
| Action schema | Name, <strong>preconditions</strong>, <strong>add list</strong>, <strong>delete list</strong> | `Move(b, x, y)` |

An action is applicable when its preconditions hold; its result is `(state − delete list) ∪ add list`. Facts not mentioned stay unchanged — this is how STRIPS sidesteps the frame problem. <strong>PDDL</strong> (Planning Domain Definition Language) is the standard modern syntax:

```text filename:PDDL
(:action move
  :parameters (?b ?x ?y)
  :precondition (and (on ?b ?x) (clear ?b) (clear ?y))
  :effect (and (on ?b ?y) (clear ?x)
               (not (on ?b ?x)) (not (clear ?y))))
```

# Forward (progression) planning

Treat planning as search: states are fact sets, successors come from applicable ground actions. Here is the <strong>Sussman anomaly</strong> — start with C on A; goal A on B on C:

```python filename:Python
from collections import deque

BLOCKS = ["A", "B", "C"]
PLACES = BLOCKS + ["Table"]

def ground_actions():                               # every instance of Move(b, x, y)
    for b in BLOCKS:
        for x in PLACES:
            for y in PLACES:
                if len({b, x, y}) == 3:
                    pre = {("On", b, x), ("Clear", b)} | ({("Clear", y)} if y != "Table" else set())
                    add = {("On", b, y)} | ({("Clear", x)} if x != "Table" else set())
                    delete = {("On", b, x)} | ({("Clear", y)} if y != "Table" else set())
                    yield f"Move({b},{x},{y})", frozenset(pre), frozenset(add), frozenset(delete)

ACTIONS = list(ground_actions())

def plan(start, goal):                              # breadth-first progression search
    frontier, seen = deque([(start, [])]), {start}
    while frontier:
        state, steps = frontier.popleft()
        if goal <= state:
            return steps, len(seen)
        for name, pre, add, delete in ACTIONS:
            if pre <= state:
                nxt = (state - delete) | add
                if nxt not in seen:
                    seen.add(nxt)
                    frontier.append((nxt, steps + [name]))

start = frozenset({("On", "C", "A"), ("On", "A", "Table"), ("On", "B", "Table"), ("Clear", "C"), ("Clear", "B")})
goal = {("On", "A", "B"), ("On", "B", "C")}
print(len(ACTIONS))           # 18 ← ground actions from one schema
print(plan(start, goal))      # (['Move(C,A,Table)', 'Move(B,Table,C)', 'Move(A,Table,B)'], 13)
```

> [!NOTE] Key point
>
> The Sussman anomaly defeats planners that achieve goals <strong>one at a time</strong>: stacking A on B first (after clearing C) must be undone to get B onto C, and achieving B on C first buries A. The goals interact, so a planner must interleave them.

# Search strategies and heuristics

| Approach | Idea |
| --- | --- |
| <strong>Forward (progression)</strong> search | From the initial state apply applicable actions. Many irrelevant actions — needs a good heuristic. |
| <strong>Backward (regression)</strong> search | From the goal, consider only <em>relevant</em> actions (that add a goal fact without deleting another); regress the goal through them. Smaller branching factor. |
| <strong>Ignore-delete-lists</strong> heuristic | Solve the relaxed problem where actions never remove facts (the basis of FF and HSP planners). Admissible variants give A\*-optimal plans. |
| <strong>Ignore-preconditions</strong> heuristic | Count how many actions are needed if any action could always be applied — roughly the number of unsatisfied goals. |
| <strong>Planning graphs / GraphPlan</strong> | Layered graph of reachable facts and actions with mutex links; the level where all goals first appear is a heuristic estimate. |
| <strong>SAT planning</strong> | Encode “is there a plan of length `T`?” as a Boolean formula and hand it to a SAT solver. |

# Partial-order planning

A <strong>partial-order planner</strong> (POP) searches in the space of <em>plans</em>, not states, and commits to an ordering only when necessary (<strong>least commitment</strong>). A plan has actions, ordering constraints `A ≺ B`, and <strong>causal links</strong> `A →p→ B` (A achieves precondition `p` of B). A <strong>threat</strong> is an action that could delete `p` between A and B — resolved by ordering it before A (demotion) or after B (promotion).

> [!TIP] Least commitment
>
> Putting on shoes: `RightSock ≺ RightShoe` and `LeftSock ≺ LeftShoe`, but the left and right sides are unordered — the plan allows any of the 6 interleavings.

| Beyond classical planning | Handles |
| --- | --- |
| Hierarchical task networks (HTN) | High-level actions refined into sub-plans — how most real planners (and games' NPCs) work |
| Scheduling with resources | Durations, deadlines, limited machines/crew — critical-path method |
| Contingent / conformant planning | Partial observability: plans with sensing actions and branches |
| Replanning &amp; execution monitoring | Detect when the world deviates from the plan and repair it |
| MDPs (next group) | Stochastic action outcomes — a <em>policy</em> instead of a fixed sequence |

```question
What is STRIPS?

---

A planning representation where states are sets of ground facts and each action has preconditions, an add list and a delete list. Anything not mentioned is unchanged, which avoids writing frame axioms. PDDL is its modern, more expressive successor.
```

```question
Forward vs backward state-space planning?

---

Forward search starts from the initial state and applies applicable actions — simple but branches on many irrelevant actions. Backward (regression) search starts from the goal and only considers relevant actions, giving a smaller branching factor, but works on sets of states and makes heuristics harder.
```

```question
Why can planning use domain-independent heuristics while plain search cannot?

---

The factored representation exposes the structure of actions, so a planner can automatically build relaxed problems — ignoring delete lists or preconditions — and solve them to get heuristic estimates without any domain-specific coding.
```
