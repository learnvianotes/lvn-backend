---
id: 3ecb88ad-a49b-7e67-81e4-6c71e67e0e02
key: topic:artificial-intelligence/reinforcement-learning
subject: artificial-intelligence
topic: reinforcement-learning
title: Reinforcement Learning
slug: reinforcement-learning
order: 1
---

Reinforcement learning (RL) solves an MDP <strong>without knowing</strong> its transition model or reward function: the agent learns from trial and error, guided only by rewards. It powers game-playing agents, robotics controllers and the RLHF stage of LLM training.

Agent observes state s → Chooses action a → Environment returns reward r and next state s′ → Agent updates its estimates

| Approach | Learns | Example |
| --- | --- | --- |
| <strong>Model-based</strong> | `P(s′ &#124; s, a)` and `R`, then plans (value iteration) | Dyna, AlphaZero (known rules), MuZero (learned model) |
| <strong>Model-free, value-based</strong> | `Q(s, a)` — value of an action in a state | Q-learning, SARSA, DQN |
| <strong>Model-free, policy-based</strong> | The policy `π(a &#124; s)` directly, by gradient ascent on reward | REINFORCE, actor-critic, PPO |

# Exploration vs exploitation

An agent that always takes the best-known action (<strong>exploit</strong>) may never discover a better one; one that always tries new actions (<strong>explore</strong>) never cashes in. <strong>ε-greedy</strong> explores with probability ε. A 3-armed bandit with win rates 0.2, 0.5 and 0.7:

```python filename:Python
import random

def bandit(epsilon, pulls=2000, true_p=(0.2, 0.5, 0.7)):
    counts, values, total = [0, 0, 0], [0.0, 0.0, 0.0], 0
    for _ in range(pulls):
        if random.random() < epsilon:
            arm = random.randrange(3)                                # explore
        else:
            arm = max(range(3), key=lambda i: values[i])             # exploit
        reward = 1 if random.random() < true_p[arm] else 0
        counts[arm] += 1
        values[arm] += (reward - values[arm]) / counts[arm]          # running average
        total += reward
    return counts, total

random.seed(1)
print(bandit(0.0))     # ([2000, 0, 0], 406) ← greedy: never tries the other arms
print(bandit(0.1))     # ([74, 73, 1853], 1355) ← explores, then mostly pulls the best arm
```

# Temporal-difference learning and Q-learning

TD learning updates an estimate towards a <strong>one-step bootstrapped target</strong> after every transition — no need to wait for the episode to end, and no model required:

`TD(0): U(s) ← U(s) + α [ r + γ U(s′) − U(s) ]`

`Q-learning: Q(s, a) ← Q(s, a) + α [ r + γ · maxₐ′ Q(s′, a′) − Q(s, a) ]`

`SARSA: Q(s, a) ← Q(s, a) + α [ r + γ · Q(s′, a′) − Q(s, a) ] (a′ = the action actually taken next)`

Q-learning is <strong>off-policy</strong>: it learns the value of the <em>greedy</em> policy while behaving ε-greedily. SARSA is <strong>on-policy</strong>: it learns the value of the policy it actually follows, exploration included. The classic <em>cliff walking</em> grid shows the difference — walk from the bottom-left to the bottom-right corner; stepping into the cliff between them costs −100 and restarts:

```python filename:Python
import random

ROWS, COLS = 4, 12
START, GOAL = (3, 0), (3, 11)
ACTIONS = [(-1, 0), (1, 0), (0, -1), (0, 1)]              # up, down, left, right

def step(s, a):
    r, c = min(max(s[0] + a[0], 0), ROWS - 1), min(max(s[1] + a[1], 0), COLS - 1)
    if r == 3 and 0 < c < 11:
        return START, -100                                 # fell off the cliff
    return (r, c), -1

def choose(Q, s, eps):
    if random.random() < eps:
        return random.randrange(4)
    return max(range(4), key=lambda a: Q[(s, a)])

def train(method, episodes=500, alpha=0.5, gamma=1.0, eps=0.1):
    Q = {((r, c), a): 0.0 for r in range(ROWS) for c in range(COLS) for a in range(4)}
    returns = []
    for _ in range(episodes):
        s, a, total = START, choose(Q, START, eps), 0
        while s != GOAL:
            s2, reward = step(s, ACTIONS[a])
            a2 = choose(Q, s2, eps)
            if method == "q-learning":
                target = reward + gamma * max(Q[(s2, b)] for b in range(4))   # best next action
            else:
                target = reward + gamma * Q[(s2, a2)]                          # the action we will take
            if s2 == GOAL:
                target = reward
            Q[(s, a)] += alpha * (target - Q[(s, a)])
            s, a, total = s2, a2, total + reward
        returns.append(total)
    return Q, sum(returns[-100:]) / 100

def greedy_path(Q):
    s, path = START, [START]
    while s != GOAL and len(path) < 50:
        s, _ = step(s, ACTIONS[max(range(4), key=lambda a: Q[(s, a)])])
        path.append(s)
    return path

random.seed(0)
Q1, avg1 = train("q-learning")
Q2, avg2 = train("sarsa")
p1, p2 = greedy_path(Q1), greedy_path(Q2)
print(len(p1) - 1, min(r for r, c in p1))     # 13 2 ← Q-learning: shortest path, right along the cliff edge (row 2)
print(len(p2) - 1, min(r for r, c in p2))     # 17 0 ← SARSA: longer, safe path along the top row (row 0)
print(round(avg1), round(avg2))               # -43 -26 ← yet SARSA earns more *while exploring*
```

> [!NOTE] Key point
>
> Q-learning learns the optimal path along the cliff edge, but with ε-greedy exploration it occasionally slips off while training. SARSA accounts for its own exploration and prefers a safer route — lower optimal-path quality, higher reward during learning.

# Scaling up: deep RL

| Milestone | Idea |
| --- | --- |
| TD-Gammon (1992) | TD learning with a small neural network reached master-level backgammon |
| DQN (2015) | Q-learning with a CNN over raw pixels + experience replay + target network; human-level on many Atari games |
| AlphaGo / AlphaZero (2016–17) | Self-play RL + MCTS + policy/value networks; superhuman Go, chess, shogi |
| PPO &amp; actor-critic | Stable policy-gradient methods for robotics and continuous control |
| RLHF (2022–) | A reward model trained on human preferences, optimised with PPO-style RL, aligns LLMs (see <strong>Generative AI</strong>) |

> [!WARNING] Watch out
>
> <strong>Reward hacking</strong>: an RL agent optimises the reward you wrote, not the one you meant — a boat-racing agent learned to spin in circles collecting points instead of finishing the race. Reward design is part of AI safety (see <strong>AI Ethics, Safety &amp; Fairness</strong>).

```question
How does reinforcement learning differ from supervised learning?

---

There are no labelled correct actions — only scalar rewards, often delayed. The agent's own actions determine what data it sees, so it must balance exploration and exploitation and solve credit assignment (which earlier action earned a later reward).
```

```question
Q-learning vs SARSA?

---

Both are TD methods learning `Q(s, a)`. Q-learning is off-policy — its target uses `max Q(s′, ·)`, the greedy action — so it learns the optimal policy regardless of exploration. SARSA is on-policy — its target uses the action actually taken next — so it learns the value of the exploring policy and behaves more cautiously (cliff walking).
```

```question
What is the exploration–exploitation trade-off? Name some strategies.

---

Exploiting uses current knowledge to maximise reward now; exploring gathers information that may pay off later. Strategies: ε-greedy (often with ε decaying), softmax/Boltzmann exploration, optimism in the face of uncertainty (optimistic initial values, UCB), and Thompson sampling.
```
