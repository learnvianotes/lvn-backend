---
id: 8cef6563-e336-72d6-ac69-f3b26b7dfee3
key: topic:artificial-intelligence/markov-models-hmm
subject: artificial-intelligence
topic: markov-models-hmm
title: Markov Chains & Hidden Markov Models
slug: markov-chains-hidden-markov-models
order: 1
---

To reason over time, model the world as a sequence of states where the future depends only on the present. When the states themselves are hidden and only noisy observations are seen, you get a hidden Markov model (HMM).

> [!INFO]
>
> <strong>Markov assumption</strong> — the next state depends only on the current state: `P(Xₜ | X₀…Xₜ₋₁) = P(Xₜ | Xₜ₋₁)`. With a fixed transition matrix the process is <strong>stationary</strong> and is a Markov chain.

```python filename:Python
# weather Markov chain: rows = today, columns = tomorrow (sunny, rainy)
T = [[0.9, 0.1],
     [0.5, 0.5]]

def step(dist):
    return [sum(dist[i] * T[i][j] for i in range(2)) for j in range(2)]

dist = [0.0, 1.0]                      # it's raining today
tomorrow = step(dist)
for _ in range(50):
    dist = step(dist)
print([round(p, 3) for p in tomorrow])   # [0.5, 0.5]
print([round(p, 3) for p in dist])       # [0.833, 0.167] ← stationary distribution: the start no longer matters
```

# Hidden Markov models

An HMM adds a <strong>sensor model</strong> `P(Eₜ | Xₜ)`. The textbook <em>umbrella world</em>: a guard underground can't see the weather, only whether the director brings an umbrella. Rain persists with probability 0.7; the umbrella appears on 90% of rainy days and 20% of dry days.

| Task | Computes | Algorithm |
| --- | --- | --- |
| <strong>Filtering</strong> | `P(Xₜ &#124; e₁:ₜ)` — belief about now | Forward algorithm |
| <strong>Prediction</strong> | `P(Xₜ₊ₖ &#124; e₁:ₜ)` — the future | Forward, then transitions only |
| <strong>Smoothing</strong> | `P(Xₖ &#124; e₁:ₜ)`, `k < t` — the past, with hindsight | Forward–backward |
| <strong>Most likely explanation</strong> | `argmax P(x₁:ₜ &#124; e₁:ₜ)` — the best state sequence | <strong>Viterbi</strong> (dynamic programming) |
| Learning | Transition and sensor models from data | Baum–Welch (EM) |

```python filename:Python
TRANS = {True: 0.7, False: 0.3}          # P(rain today | rain yesterday = key)
SENSOR = {True: 0.9, False: 0.2}         # P(umbrella | rain = key)

def forward(evidence, prior=0.5):
    belief = {True: prior, False: 1 - prior}
    history = []
    for umbrella in evidence:
        predicted = {r: sum(belief[prev] * (TRANS[prev] if r else 1 - TRANS[prev]) for prev in (True, False))
                     for r in (True, False)}                                        # predict
        weighted = {r: predicted[r] * (SENSOR[r] if umbrella else 1 - SENSOR[r]) for r in (True, False)}
        total = sum(weighted.values())
        belief = {r: weighted[r] / total for r in (True, False)}                    # update + normalise
        history.append(round(belief[True], 3))
    return history

def viterbi(evidence, prior=0.5):
    like = lambda r, u: SENSOR[r] if u else 1 - SENSOR[r]
    trans = lambda prev, r: TRANS[prev] if r else 1 - TRANS[prev]
    best = {r: (prior * like(r, evidence[0]), [r]) for r in (True, False)}
    for u in evidence[1:]:
        best = {r: max(((p * trans(prev, r) * like(r, u), path + [r]) for prev, (p, path) in best.items()),
                       key=lambda x: x[0]) for r in (True, False)}
    return ["rain" if r else "dry" for r in max(best.values(), key=lambda x: x[0])[1]]

print(forward([True, True]))                         # [0.818, 0.883] ← P(rain) after day 1 and day 2
print(viterbi([True, True, False, True, True]))      # ['rain', 'rain', 'dry', 'rain', 'rain']
```

> [!NOTE] Key point
>
> Before deep learning, HMMs powered speech recognition, part-of-speech tagging and gene finding. The same filtering idea with continuous states and Gaussian noise is the <strong>Kalman filter</strong> (tracking, GPS, robotics); with samples it is the <strong>particle filter</strong> (robot localisation).

```question
What is the Markov assumption?

---

The future is conditionally independent of the past given the present state: `P(Xₜ | X₀:ₜ₋₁) = P(Xₜ | Xₜ₋₁)`. It keeps models of time compact; if it doesn't hold, enrich the state (add more history or variables).
```

```question
What problems does an HMM solve, and with which algorithms?

---

Filtering (forward algorithm), prediction, smoothing (forward–backward), the most likely hidden-state sequence (Viterbi), and learning the parameters (Baum–Welch / EM). Each runs in time linear in the sequence length.
```
