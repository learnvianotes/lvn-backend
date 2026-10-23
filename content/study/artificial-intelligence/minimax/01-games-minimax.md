---
id: 26a6b89c-fcba-701e-b6af-158058850d7d
key: topic:artificial-intelligence/minimax
subject: artificial-intelligence
topic: minimax
title: Games & Minimax
slug: games-minimax
order: 1
---

In a game the agent faces an <strong>opponent</strong> who is trying to make it lose. Minimax plans for the worst case: MAX picks the move with the highest value assuming MIN always answers with the move that is worst for MAX.

# Kinds of games

|  | Deterministic | Chance |
| --- | --- | --- |
| <strong>Perfect information</strong> | Chess, Go, checkers, tic-tac-toe, connect-four | Backgammon, Monopoly |
| <strong>Imperfect information</strong> | Battleship, Stratego | Poker, bridge, Scrabble |

Classical game search targets <strong>two-player, turn-taking, zero-sum, perfect-information</strong> games — one player's gain is exactly the other's loss.

# A game as a search problem

| Element | Meaning |
| --- | --- |
| `S₀` | Initial state (starting position) |
| `ToMove(s)` | Whose turn it is (MAX or MIN) |
| `Actions(s)` / `Result(s, a)` | Legal moves and the position they lead to |
| `IsTerminal(s)` | Is the game over? |
| `Utility(s, p)` | Final payoff for player `p`: e.g. +1 win, 0 draw, −1 loss |

`MINIMAX(s) = Utility(s) if terminal; max over a of MINIMAX(Result(s, a)) if MAX to move; min over a … if MIN to move`

# Minimax on a two-ply tree

The standard textbook tree: MAX moves at the root (A), MIN replies at B, C and D, and the leaves are utilities for MAX.

```python filename:Python
TREE = {"A": ["B", "C", "D"],                    # MAX node
        "B": [3, 12, 8], "C": [2, 4, 6], "D": [14, 5, 2]}   # MIN nodes → leaf utilities

def minimax(node, maximizing):
    if isinstance(node, int):                     # leaf: utility
        return node
    values = [minimax(child, not maximizing) for child in TREE[node]]
    return max(values) if maximizing else min(values)

print([minimax(n, False) for n in TREE["A"]])     # [3, 2, 2] ← MIN's replies at B, C, D
print(minimax("A", True))                         # 3 ← MAX moves to B
```

# Perfect tic-tac-toe

```python filename:Python
from functools import lru_cache

LINES = [(0, 1, 2), (3, 4, 5), (6, 7, 8), (0, 3, 6), (1, 4, 7), (2, 5, 8), (0, 4, 8), (2, 4, 6)]

def winner(b):
    for i, j, k in LINES:
        if b[i] != "." and b[i] == b[j] == b[k]:
            return b[i]
    return None

@lru_cache(maxsize=None)                  # the same position is reached by many move orders
def value(board, player):                 # +1 = X wins, 0 = draw, −1 = O wins (perfect play)
    w = winner(board)
    if w:
        return 1 if w == "X" else -1
    if "." not in board:
        return 0
    nxt = "O" if player == "X" else "X"
    vals = [value(board[:i] + player + board[i + 1:], nxt) for i in range(9) if board[i] == "."]
    return max(vals) if player == "X" else min(vals)

def best_move(board, player):
    nxt = "O" if player == "X" else "X"
    moves = [i for i in range(9) if board[i] == "."]
    pick = max if player == "X" else min
    return pick(moves, key=lambda i: value(board[:i] + player + board[i + 1:], nxt))

print(value("." * 9, "X"))                # 0 ← perfect play from the empty board is a draw
print(value.cache_info().currsize)        # 5478 ← distinct positions evaluated
board = "XX." \
        "OO." \
        "..."
print(best_move(board, "X"))              # 2 ← win at once (square 2)
print(best_move("XO..O...X", "X"))        # 7 ← must block O's middle column
```

# Cost of minimax

Minimax is a complete depth-first exploration of the game tree: time `O(bᵐ)`, space `O(bm)`. Tic-tac-toe has fewer than 9! = 362,880 move sequences, but chess has `b ≈ 35` and games of \~80 plies — about 10¹²³ positions in the tree. Real programs therefore <strong>prune</strong> (alpha-beta) and <strong>cut off</strong> the search at a fixed depth with an evaluation function.

> [!NOTE] Key point
>
> Minimax is optimal against an optimal opponent. Against a weak opponent another strategy may win more — but minimax never does worse than its computed value.

```question
Explain minimax.

---

Recursively evaluate the game tree: terminal states get their utility, MAX nodes take the maximum of their children and MIN nodes the minimum. The root's best child is the move that guarantees the best outcome against an opponent who also plays optimally.
```

```question
What is the time complexity of minimax?

---

`O(bᵐ)` time and `O(bm)` space (depth-first), where `b` is the branching factor and `m` the maximum depth — infeasible for chess or Go without pruning and depth cut-offs.
```
