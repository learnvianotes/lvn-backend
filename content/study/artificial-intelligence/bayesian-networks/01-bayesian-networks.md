---
id: 8268c00b-331d-7979-9659-8e81a2e15566
key: topic:artificial-intelligence/bayesian-networks
subject: artificial-intelligence
topic: bayesian-networks
title: Bayesian Networks
slug: bayesian-networks
order: 1
---

A Bayesian network is a directed acyclic graph whose nodes are random variables and whose edges mean “directly influences”. Each node stores a small conditional probability table (CPT); together they define the full joint distribution compactly.

`P(x₁, …, xₙ) = Π P(xᵢ | Parents(Xᵢ))`

# The burglar alarm network

| Node | Parents | CPT |
| --- | --- | --- |
| Burglary (B) | — | `P(b) = 0.001` |
| Earthquake (E) | — | `P(e) = 0.002` |
| Alarm (A) | B, E | `P(a &#124; b, e) = 0.95`, `P(a &#124; b, ¬e) = 0.94`, `P(a &#124; ¬b, e) = 0.29`, `P(a &#124; ¬b, ¬e) = 0.001` |
| JohnCalls (J) | A | `P(j &#124; a) = 0.90`, `P(j &#124; ¬a) = 0.05` |
| MaryCalls (M) | A | `P(m &#124; a) = 0.70`, `P(m &#124; ¬a) = 0.01` |

10 numbers instead of the 2⁵ − 1 = 31 of the full joint — and the savings grow exponentially with more variables. Each variable is conditionally independent of its non-descendants given its parents: John's call depends on the alarm, not directly on burglaries.

# Exact inference by enumeration

To answer `P(Burglary | JohnCalls, MaryCalls)`, sum the joint over the hidden variables (E, A) for each value of B, then normalise:

`P(B | j, m) = α Σₑ Σₐ P(B) · P(e) · P(a | B, e) · P(j | a) · P(m | a)`

```python filename:Python
from itertools import product

P_B, P_E = 0.001, 0.002
P_A = {(True, True): 0.95, (True, False): 0.94, (False, True): 0.29, (False, False): 0.001}
P_J = {True: 0.90, False: 0.05}
P_M = {True: 0.70, False: 0.01}

def pr(p_true, value):
    return p_true if value else 1 - p_true

def joint(b, e, a, j, m):                    # product of the local CPT entries
    return pr(P_B, b) * pr(P_E, e) * pr(P_A[(b, e)], a) * pr(P_J[a], j) * pr(P_M[a], m)

print(f"{joint(False, False, True, True, True):.6f}")   # 0.000628 ← P(j, m, a, ¬b, ¬e)

def query_burglary(j, m):
    unnorm = [sum(joint(b, e, a, j, m) for e, a in product([True, False], repeat=2)) for b in (True, False)]
    return round(unnorm[0] / sum(unnorm), 3)             # normalise (α)

print(query_burglary(True, True))     # 0.284 ← both neighbours call: still only ~28%
print(query_burglary(True, False))    # 0.005 ← only John calls
```

> [!NOTE] Key point
>
> Enumeration costs `O(2ⁿ)` in the worst case. <strong>Variable elimination</strong> caches repeated sub-products and is linear for singly-connected networks (polytrees). Exact inference in general networks is NP-hard, hence approximate methods.

# Approximate inference by sampling

```python filename:Python
import random

P_B, P_E = 0.001, 0.002
P_A = {(True, True): 0.95, (True, False): 0.94, (False, True): 0.29, (False, False): 0.001}
P_J = {True: 0.90, False: 0.05}
P_M = {True: 0.70, False: 0.01}

def likelihood_weighting(n):
    """Sample non-evidence variables in topological order; weight by the likelihood of evidence j, m."""
    weights = {True: 0.0, False: 0.0}
    for _ in range(n):
        b = random.random() < P_B
        e = random.random() < P_E
        a = random.random() < P_A[(b, e)]
        weights[b] += P_J[a] * P_M[a]          # evidence is fixed, not sampled
    return round(weights[True] / (weights[True] + weights[False]), 2)

random.seed(0)
print(likelihood_weighting(200_000))     # 0.28 ← close to the exact 0.284
```

| Method | Idea | Weakness |
| --- | --- | --- |
| Rejection sampling | Sample the whole network, discard samples that contradict the evidence | Wastes almost everything when evidence is rare (here `P(j, m) ≈ 0.002`) |
| Likelihood weighting | Fix evidence variables, weight each sample by the evidence likelihood | Poor when evidence is downstream of unlikely causes |
| Gibbs sampling (MCMC) | Resample one variable at a time given its Markov blanket | Slow mixing with near-deterministic CPTs |

# Reading independence from the graph

| Pattern | Shape | X and Y independent… |
| --- | --- | --- |
| Causal chain | `X → Z → Y` | …given `Z` (Burglary ⟂ JohnCalls \| Alarm) |
| Common cause | `X ← Z → Y` | …given `Z` (JohnCalls ⟂ MaryCalls \| Alarm) |
| Common effect (v-structure) | `X → Z ← Y` | …only when `Z` (and its descendants) is <strong>not</strong> observed — observing the alarm makes burglary and earthquake dependent (“explaining away”) |

```question
What does an edge in a Bayesian network mean, and why is the network compact?

---

An edge `X → Y` means X directly influences Y; each node is conditionally independent of its non-descendants given its parents. The joint is then a product of small local CPTs, so a node with `k` Boolean parents needs `2ᵏ` numbers instead of the exponential full joint.
```

```question
What is explaining away?

---

In a v-structure `Burglary → Alarm ← Earthquake`, the causes are independent until the alarm is observed. Once it rings, learning there was an earthquake <em>lowers</em> the probability of a burglary — the earthquake explains the alarm away.
```

```question
How do you do inference in a Bayesian network?

---

Exactly by enumeration or variable elimination (sum out hidden variables, normalise) — exponential in general, linear on polytrees. Approximately by sampling: rejection sampling, likelihood weighting or MCMC such as Gibbs sampling.
```
