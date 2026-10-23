---
id: a61ce8f5-78e1-7ca1-b433-46e7c84c8fb0
key: topic:artificial-intelligence/ai-interview-questions
subject: artificial-intelligence
topic: ai-interview-questions
title: Interview Questions
slug: interview-questions
order: 1
---

Classical AI questions from university exams and ML/AI engineer interviews — short answers you can say out loud, with pointers to the topic that explains each one.

# Foundations

```question
What is an intelligent agent? What makes it rational?

---

Anything that perceives its environment through sensors and acts through actuators. It is rational if, for each percept sequence, it chooses the action expected to maximise its performance measure given its percepts and built-in knowledge. (See <strong>Intelligent Agents &amp; Environments</strong>.)
```

```question
Describe the task environment of a self-driving car.

---

PEAS — performance: safety, time, legality, comfort; environment: roads, traffic, pedestrians, weather; actuators: steering, throttle, brake, signals; sensors: cameras, LiDAR, radar, GPS. It is partially observable, multi-agent, stochastic, sequential, dynamic, continuous.
```

```question
Name the five agent architectures.

---

Simple reflex, model-based reflex, goal-based, utility-based and learning agents — each adds internal state, goals, preferences or self-improvement to the previous one.
```

# Search

```question
Compare BFS, DFS, UCS and iterative deepening.

---

BFS: complete, optimal for unit costs, `O(bᵈ)` time and memory. DFS: `O(bm)` memory but not complete or optimal. UCS: optimal for any positive costs, expands by path cost. IDDFS: BFS's guarantees with DFS's memory, at \~11% extra time for `b = 10`. (See <strong>Depth-Limited, Iterative Deepening &amp; Bidirectional Search</strong>.)
```

```question
Why is A\* optimal, and what conditions does the heuristic need?

---

It expands nodes in order of `f = g + h`. With an admissible `h` it can never pop a suboptimal goal before some node on the optimal path; graph search additionally needs consistency so the first path found to every state is its cheapest.
```

```question
How would you design a heuristic for a new problem?

---

Relax the problem — remove constraints until it is easy to solve exactly — and use the relaxed optimal cost (Manhattan distance, straight-line distance, ignore-delete-lists). Combine several admissible heuristics with `max`, or precompute pattern databases.
```

```question
When would you use local search instead of systematic search?

---

When only the final state matters, the space is huge or continuous, and a good (not necessarily optimal) solution is enough — scheduling, layout, n-queens with millions of queens. Hill climbing with restarts, simulated annealing or genetic algorithms.
```

# Games &amp; CSPs

```question
Explain alpha-beta pruning and its best case.

---

Minimax with bounds α (MAX's guaranteed value) and β (MIN's). When `α ≥ β` the rest of a node's children can't affect the decision and are skipped. With perfect move ordering the cost falls from `O(bᵐ)` to `O(b^(m/2))`, doubling the searchable depth.
```

```question
Why did Go need MCTS instead of alpha-beta?

---

Go's branching factor (\~250) makes full-width search shallow, and good evaluation functions were very hard to hand-write. MCTS grows an asymmetric tree using playouts and UCB1, and AlphaGo added learned policy and value networks.
```

```question
How do MRV, forward checking and AC-3 speed up a CSP solver?

---

MRV picks the most constrained variable so dead ends appear early; forward checking prunes neighbours' domains after each assignment; AC-3 propagates constraints across all arcs, detecting conflicts between unassigned variables before search reaches them.
```

# Logic, knowledge &amp; planning

```question
What is the difference between soundness and completeness?

---

A sound inference procedure derives only entailed sentences; a complete one derives every entailed sentence. Resolution is sound and refutation-complete for propositional logic; forward chaining is sound and complete for Horn clauses.
```

```question
Explain forward vs backward chaining with an example.

---

Forward chaining starts from known facts and fires rules until the goal appears (production systems, monitoring). Backward chaining starts from the goal and works back through rules whose conclusion matches it (Prolog, diagnosis). (See <strong>Resolution, Forward &amp; Backward Chaining</strong>.)
```

```question
What is unification and where is it used?

---

Finding the most general substitution that makes two logical expressions identical, e.g. `Knows(John, x)` and `Knows(y, Mary)` → `{y/John, x/Mary}`. Used in generalised modus ponens, Prolog, and first-order resolution.
```

```question
What is the frame problem?

---

The difficulty of representing what does <em>not</em> change when an action occurs without writing an explicit axiom for every unaffected fact. STRIPS handles it by assuming everything not in an action's add/delete lists stays the same.
```

```question
What is STRIPS / PDDL?

---

A planning language where states are sets of facts and actions have preconditions, add lists and delete lists. PDDL is the standard modern form; the structure lets planners compute domain-independent heuristics such as ignore-delete-lists.
```

# Uncertainty, decisions &amp; learning

```question
Why are Bayesian networks more compact than a full joint distribution?

---

They encode conditional independence: each variable depends directly only on its parents, so the joint factorises into small CPTs. The burglary network needs 10 numbers instead of 31; the gap grows exponentially with more variables.
```

```question
What is an HMM and what is the Viterbi algorithm?

---

A Markov chain over hidden states with noisy observations of each state. Viterbi is dynamic programming that finds the single most likely hidden-state sequence for an observation sequence in time linear in its length.
```

```question
Define an MDP and the Bellman equation.

---

An MDP is states, actions, a transition model `P(s′|s,a)`, rewards and a discount `γ`. The Bellman equation `U(s) = maxₐ Σ P(s′|s,a)[R + γU(s′)]` characterises optimal utilities; value iteration applies it repeatedly.
```

```question
What's the difference between an MDP and reinforcement learning?

---

In an MDP the transition and reward models are known, so you can plan (value/policy iteration). In RL they are unknown and the agent must learn from experienced transitions — model-based (learn the model, then plan) or model-free (Q-learning, policy gradients).
```

```question
Explain the Q-learning update.

---

`Q(s,a) ← Q(s,a) + α[r + γ maxₐ′ Q(s′,a′) − Q(s,a)]`: move the estimate toward the observed reward plus the discounted value of the best next action. It's off-policy and converges to the optimal Q with enough exploration and a decaying learning rate.
```

# Big picture

```question
What were the causes of the AI winters, and are we in a bubble now?

---

Over-promising followed by technical walls: combinatorial explosion in search and brittle, expensive expert systems. Today's systems deliver real value at scale, but costs, reliability (hallucination) and unmet expectations are the usual warning signs to watch.
```

```question
How would you explain the difference between AI, ML, DL and generative AI to a non-technical person?

---

AI is making computers do things that seem intelligent. ML is doing that by learning from examples instead of hand-written rules. Deep learning is ML with large neural networks. Generative AI uses deep learning to create new text, images or audio.
```

```question
What are the main ethical risks of AI systems?

---

Unfair outcomes from biased data, opaque decisions without recourse, privacy leakage, unsafe behaviour under distribution shift or attack, misuse (deepfakes, fraud), and misaligned objectives. Mitigations: subgroup evaluation, documentation, human oversight, monitoring and regulation-aligned governance.
```
