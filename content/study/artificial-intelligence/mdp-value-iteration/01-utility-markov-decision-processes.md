---
id: c733bbc1-3f43-7e94-b6e6-e7d5ed959ffb
key: topic:artificial-intelligence/mdp-value-iteration
subject: artificial-intelligence
topic: mdp-value-iteration
title: Utility & Markov Decision Processes
slug: utility-markov-decision-processes
order: 1
---

When actions have uncertain outcomes, the agent needs more than a plan: it needs a <strong>policy</strong> — the best action in every state — chosen to maximise expected utility. MDPs formalise this, and the Bellman equation says how to solve them.

# Utility theory in one minute

A rational agent picks the action with <strong>maximum expected utility</strong> (MEU): `EU(a) = Σ P(outcome | a) · U(outcome)`. Utilities are not money: most people prefer a sure $1M to a 50% chance of $3M because the utility of money is concave (<strong>risk aversion</strong>).

```python filename:Python
import math

lotteries = {"sure $1M": [(1.0, 1_000_000)], "50% of $3M": [(0.5, 3_000_000), (0.5, 0)]}
EMV = {k: sum(p * x for p, x in v) for k, v in lotteries.items()}
EU = {k: round(sum(p * math.log10(1 + x) for p, x in v), 2) for k, v in lotteries.items()}   # concave utility
print(max(EMV, key=EMV.get), EMV)     # 50% of $3M {'sure $1M': 1000000.0, '50% of $3M': 1500000.0} ← expected money prefers the gamble
print(max(EU, key=EU.get), EU)        # sure $1M {'sure $1M': 6.0, '50% of $3M': 3.24} ← a risk-averse utility prefers the sure thing
```

# Markov decision processes

| Component | Meaning |
| --- | --- |
| States `S` | Fully observable world states |
| Actions `A(s)` | Actions available in each state |
| Transition model `P(s′ &#124; s, a)` | Probability of reaching `s′` — outcomes are stochastic but Markovian |
| Reward `R(s, a, s′)` | Immediate reward for a transition |
| Discount `γ ∈ [0, 1]` | How much future rewards count; `γ < 1` keeps infinite sums finite and prefers sooner rewards |

A <strong>policy</strong> `π(s)` maps states to actions. The utility (value) of a state under the optimal policy satisfies the <strong>Bellman equation</strong>:

`U(s) = max over a of Σ_s′ P(s′ | s, a) · [ R(s, a, s′) + γ · U(s′) ]`

# Value iteration on the 4×3 grid world

The textbook world: start bottom-left, +1 and −1 exits on the right, a wall at (2, 2). Each move goes the intended way with probability 0.8 and slips sideways with 0.1 each; every step costs 0.04. Value iteration applies the Bellman equation as an update until the utilities stop changing:

```python filename:Python
COLS, ROWS, WALL = 4, 3, (2, 2)
TERMINAL = {(4, 3): 1.0, (4, 2): -1.0}
STEP_REWARD, GAMMA = -0.04, 1.0
MOVES = {"^": (0, 1), "v": (0, -1), "<": (-1, 0), ">": (1, 0)}
SIDEWAYS = {"^": "<>", "v": "<>", "<": "^v", ">": "^v"}
STATES = [(c, r) for c in range(1, COLS + 1) for r in range(1, ROWS + 1) if (c, r) != WALL]

def go(s, move):
    dc, dr = MOVES[move]
    t = (s[0] + dc, s[1] + dr)
    return t if t in STATES else s                        # bumping into a wall/edge: stay put

def outcomes(s, a):                                        # [(probability, next state)]
    return [(0.8, go(s, a))] + [(0.1, go(s, side)) for side in SIDEWAYS[a]]

def q_value(U, s, a):
    return sum(p * (STEP_REWARD + GAMMA * U[t]) for p, t in outcomes(s, a))

def value_iteration(eps=1e-6):
    U = {s: TERMINAL.get(s, 0.0) for s in STATES}
    sweeps = 0
    while True:
        sweeps += 1
        new = {s: U[s] if s in TERMINAL else max(q_value(U, s, a) for a in MOVES) for s in STATES}
        delta = max(abs(new[s] - U[s]) for s in STATES)
        U = new
        if delta < eps:
            return U, sweeps

U, sweeps = value_iteration()
policy = {s: max(MOVES, key=lambda a: q_value(U, s, a)) for s in STATES if s not in TERMINAL}

def row(r, show):
    return " ".join(show(c, r) for c in range(1, COLS + 1))
val = lambda c, r: "  ## " if (c, r) == WALL else f"{U[(c, r)]:5.3f}"
arrow = lambda c, r: "#" if (c, r) == WALL else ("+" if U.get((c, r)) == 1 else "-") if (c, r) in TERMINAL else policy[(c, r)]

print(sweeps)                          # 28
print(row(3, val))                     # 0.812 0.868 0.918 1.000
print(row(2, val))                     # 0.762   ##  0.660 -1.000
print(row(1, val))                     # 0.705 0.655 0.611 0.388
print(row(3, arrow), "|", row(2, arrow), "|", row(1, arrow))   # > > > + | ^ # ^ - | ^ < < < ← top | middle | bottom row
```

Look at (3, 2) and (4, 1), next to the −1 exit: the policy goes up and left — the long way round — rather than risk a 10% slip into the pit. Make the step cost much larger (say −2 per step) and the agent would dive into the −1 exit just to stop paying.

# Policy iteration

1. <strong>Policy evaluation</strong>

   For the current policy π, compute `U^π(s) = Σ P(s′ | s, π(s)) [R + γ U^π(s′)]` — a linear system (no max), solvable exactly or by a few sweeps.

2. <strong>Policy improvement</strong>

   Make π greedy with respect to `U^π`: `π(s) ← argmaxₐ Σ P(s′ | s, a)[R + γ U^π(s′)]`.

3. <strong>Repeat</strong>

   Stop when the policy no longer changes — it is then optimal. Usually converges in very few iterations.

```python filename:Python
COLS, ROWS, WALL = 4, 3, (2, 2)
TERMINAL = {(4, 3): 1.0, (4, 2): -1.0}
MOVES = {"^": (0, 1), "v": (0, -1), "<": (-1, 0), ">": (1, 0)}
SIDEWAYS = {"^": "<>", "v": "<>", "<": "^v", ">": "^v"}
STATES = [(c, r) for c in range(1, COLS + 1) for r in range(1, ROWS + 1) if (c, r) != WALL]

def go(s, m):
    t = (s[0] + MOVES[m][0], s[1] + MOVES[m][1])
    return t if t in STATES else s

def q(U, s, a):
    return sum(p * (-0.04 + U[t]) for p, t in [(0.8, go(s, a))] + [(0.1, go(s, x)) for x in SIDEWAYS[a]])

def policy_iteration():
    policy = {s: "^" for s in STATES if s not in TERMINAL}         # an arbitrary start: always go up
    U = {s: TERMINAL.get(s, 0.0) for s in STATES}
    for iteration in range(1, 100):
        for _ in range(100):                                       # evaluate (simplified: repeated sweeps)
            U = {s: U[s] if s in TERMINAL else q(U, s, policy[s]) for s in STATES}
        new = {s: max(MOVES, key=lambda a: q(U, s, a)) for s in policy}   # improve
        if new == policy:
            return policy, iteration
        policy = new

policy, iterations = policy_iteration()
print(iterations)                                                   # 5
print("".join(policy[s] for s in sorted(policy)))                   # ^^><><^>< ← states (1,1), (1,2), … (4,1): the same policy as value iteration
```

|  | Value iteration | Policy iteration |
| --- | --- | --- |
| Each iteration | One Bellman update (with max) of every state | Full policy evaluation + one improvement |
| Iterations | Many cheap ones | Few expensive ones |
| Converges to | Optimal utilities (policy extracted at the end) | Optimal policy exactly, in finitely many steps |

> [!WARNING] Watch out
>
> MDPs assume the agent <em>knows</em> `P` and `R` and can <em>see</em> the state. If the state is hidden, it's a POMDP (plan over belief states — much harder). If `P` and `R` are unknown, the agent must learn from experience — reinforcement learning.

```question
What is the Bellman equation?

---

It defines the utility of a state recursively: the best action's expected immediate reward plus the discounted utility of the next state, `U(s) = maxₐ Σ P(s′|s,a)[R + γU(s′)]`. Value iteration turns it into an update rule; its unique solution gives the optimal policy.
```

```question
What does the discount factor γ do?

---

It weighs future rewards: `γ` near 0 makes the agent short-sighted, near 1 far-sighted. With `γ < 1` infinite-horizon sums stay finite and value iteration converges geometrically; it can also model uncertainty about whether the future happens at all.
```

```question
Value iteration vs policy iteration?

---

Value iteration repeatedly applies the Bellman update to utilities and extracts the policy at the end. Policy iteration alternates evaluating the current policy and making it greedy; it needs fewer iterations, each more expensive. Both converge to the optimal policy.
```
