---
id: 1f47c4c5-2c3a-7040-9571-902be360a82c
key: topic:artificial-intelligence/game-search-beyond-minimax
subject: artificial-intelligence
topic: game-search-beyond-minimax
title: Evaluation Functions, Expectimax & MCTS
slug: evaluation-functions-expectimax-mcts
order: 1
---

Real games are too big to search to the end. Engines stop at a depth limit and <strong>estimate</strong> the position; games with dice need <strong>expectation</strong> instead of minimum; and Monte Carlo tree search replaces hand-made evaluation with random playouts.

# Depth cut-off and evaluation functions

Replace `IsTerminal` with a <strong>cut-off test</strong> (depth limit, or time) and `Utility` with an <strong>evaluation function</strong> — an estimate of the expected utility of a position. Most classical engines use a weighted linear sum of features:

`Eval(s) = w₁·f₁(s) + w₂·f₂(s) + … + wₙ·fₙ(s)`

```python filename:Python
VALUES = {"P": 1, "N": 3, "B": 3, "R": 5, "Q": 9, "K": 0}    # classic material weights

def material(pieces):                     # uppercase = White (MAX), lowercase = Black (MIN)
    return sum(VALUES[p.upper()] * (1 if p.isupper() else -1) for p in pieces)

print(material("KQRRBNPPPPP" + "kqrbbnnpppppp"))   # -2 ← White: rook vs two minor pieces (−1) and a pawn down (−1)
```

| Problem | What goes wrong | Remedy |
| --- | --- | --- |
| <strong>Horizon effect</strong> | A delaying move pushes an unavoidable loss beyond the depth limit, so the engine thinks it is avoided | Singular extensions — search forcing moves deeper |
| <strong>Non-quiescent positions</strong> | Cutting off in the middle of a capture sequence gives a wildly wrong estimate | <strong>Quiescence search</strong> — keep searching captures until the position is quiet |
| Weights are hand-tuned | The evaluation encodes human biases and misses deep strategy | Learn the evaluation (TD-Gammon, AlphaZero value networks) |

# Expectimax — games of chance

In backgammon a dice roll sits between the players' moves. Add <strong>chance nodes</strong> whose value is the probability-weighted average of their children:

`EXPECTIMINIMAX(s) = Σ over outcomes r of P(r) · EXPECTIMINIMAX(Result(s, r)) at chance nodes`

```python filename:Python
# MAX chooses a gamble; each gamble is a chance node: [(probability, payoff), ...]
options = {
    "risky": [(0.5, 10), (0.5, 0)],
    "safe":  [(1.0, 4)],
}
worst_case = {a: min(v for _, v in outs) for a, outs in options.items()}    # minimax-style: assume the worst
expected = {a: sum(p * v for p, v in outs) for a, outs in options.items()}  # expectimax

print(worst_case, max(worst_case, key=worst_case.get))    # {'risky': 0, 'safe': 4} safe
print(expected, max(expected, key=expected.get))          # {'risky': 5.0, 'safe': 4.0} risky
```

> [!WARNING] Watch out
>
> With chance nodes the <em>scale</em> of the evaluation matters, not just the ranking: only a positive linear transformation of the true expected payoff preserves the best move. Minimax is indifferent to any order-preserving transformation.

# Monte Carlo tree search (MCTS)

MCTS needs no evaluation function: it estimates a position's value by playing many (quick, often random) games to the end, and grows a search tree focused on the most promising moves. Each iteration has four steps:

1 · Selection (follow UCB1 down the tree) → 2 · Expansion (add one new child) → 3 · Simulation (random playout to the end) → 4 · Backpropagation (update wins/visits up the path)

`UCB1(n) = W(n)/N(n) + C · √( ln N(parent) / N(n) ) exploitation + exploration, C ≈ √2`

Demo on <strong>Nim</strong>: 10 sticks, each turn take 1–3, whoever takes the last stick wins. The winning strategy is to leave the opponent a multiple of 4 — so from 10 the right move is to take 2. MCTS discovers this from random playouts alone:

```python filename:Python
import math
import random

class Node:
    def __init__(self, sticks, parent=None, move=None):
        self.sticks, self.parent, self.move = sticks, parent, move
        self.children, self.wins, self.visits = [], 0, 0
        self.untried = [m for m in (1, 2, 3) if m <= sticks]

def ucb1(n, c=1.4):
    return n.wins / n.visits + c * math.sqrt(math.log(n.parent.visits) / n.visits)

def playout(sticks):                      # random game; True if the player to move wins
    to_move_wins = False
    while sticks:
        sticks -= random.randint(1, min(3, sticks))
        to_move_wins = not to_move_wins   # whoever just moved flips the flag
    return to_move_wins

def mcts(sticks, iterations=2000):
    root = Node(sticks)
    for _ in range(iterations):
        node = root
        while not node.untried and node.children:             # 1. selection
            node = max(node.children, key=ucb1)
        if node.untried:                                      # 2. expansion
            m = node.untried.pop()
            node.children.append(Node(node.sticks - m, node, m))
            node = node.children[-1]
        mover_won = not playout(node.sticks)                 # 3. simulation: opponent moves next
        while node:                                           # 4. backpropagation
            node.visits += 1
            node.wins += mover_won                            # wins for the player who moved into node
            mover_won = not mover_won
            node = node.parent
    best = max(root.children, key=lambda n: n.visits)
    return best.move, {n.move: n.visits for n in sorted(root.children, key=lambda n: n.move)}

random.seed(0)
print(mcts(10))      # (2, {1: 104, 2: 1854, 3: 42}) ← take 2, leaving 8
print(mcts(7)[0])    # 3 ← take 3, leaving 4
```

|  | Alpha-beta + evaluation | MCTS |
| --- | --- | --- |
| Needs | A good hand-crafted (or learned) evaluation function | Only the rules (to simulate) — any-time |
| Good for | Tactical games with moderate `b` (chess, checkers) | Huge `b`, hard-to-evaluate positions (Go: `b ≈ 250`) |
| Search shape | Uniform to a fixed depth | Asymmetric — deep on promising lines |
| Famous use | Deep Blue (1997), Stockfish | AlphaGo / AlphaZero (MCTS + policy and value networks) |

> [!NOTE] Key point
>
> AlphaZero replaced random playouts with a <strong>value network</strong> and biased selection with a <strong>policy network</strong>, both trained by self-play reinforcement learning — search and learning working together (see <strong>Reinforcement Learning</strong> and the <strong>Deep Learning</strong> notes).

```question
What is the horizon effect?

---

A depth-limited search can't see consequences beyond its cut-off, so an engine may play delaying moves that merely push an inevitable loss past the horizon. Quiescence search and search extensions reduce it.
```

```question
When would you use expectimax instead of minimax?

---

When outcomes involve chance (dice, card draws) or the opponent is not adversarial but random/suboptimal. Chance nodes take the probability-weighted average of their children instead of the minimum.
```

```question
Explain the four phases of MCTS.

---

Selection: descend the tree choosing children by UCB1 (balancing win rate and uncertainty). Expansion: add a new child node. Simulation: play out the game from there with a default (often random) policy. Backpropagation: update visit and win counts along the path. The move with the most visits at the root is played.
```
