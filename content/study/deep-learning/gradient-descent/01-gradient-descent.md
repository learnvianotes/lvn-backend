---
id: 633b8d9c-be4c-70c8-9852-1b3446591ec3
key: topic:deep-learning/gradient-descent
subject: deep-learning
topic: gradient-descent
title: Gradient Descent
slug: gradient-descent
order: 1
---

Training = walking downhill on the loss surface. The gradient points uphill, so each step moves the weights a little in the opposite direction.

`θ ← θ − η · ∇θ L(θ) η = learning rate`

# Batch, mini-batch and stochastic

| Variant | Gradient computed on | Pros | Cons |
| --- | --- | --- | --- |
| Batch GD | The whole dataset | Exact gradient, smooth path | Slow per step; dataset must fit in memory |
| Stochastic GD (SGD) | One example | Cheap steps, noise can escape bad regions | Very noisy; poor hardware use |
| <strong>Mini-batch</strong> GD | A batch of 32–1024 examples | GPU-friendly, reasonably stable — <strong>the default</strong> | Batch size is another hyper-parameter |

In deep learning “SGD” almost always means mini-batch SGD. Vocabulary: one <strong>iteration</strong> (step) processes one batch; one <strong>epoch</strong> is a full pass over the data — `ceil(N / batch_size)` iterations.

# Mini-batch GD from scratch

```python filename:Python
import numpy as np

rng = np.random.default_rng(0)
X = rng.uniform(-1, 1, size=200)
y = 3 * X + 2 + rng.normal(0, 0.1, size=200)     # true line: y = 3x + 2

w, b, lr, batch = 0.0, 0.0, 0.1, 20
for epoch in range(50):
    idx = rng.permutation(len(X))                 # reshuffle every epoch
    for start in range(0, len(X), batch):
        j = idx[start:start + batch]
        err = (w * X[j] + b) - y[j]
        w -= lr * 2 * np.mean(err * X[j])         # ∂MSE/∂w
        b -= lr * 2 * np.mean(err)                # ∂MSE/∂b

print(round(w, 2), round(b, 2))                   # 2.99 2.0
print(len(X) // batch * 50)                       # 500 ← updates made (10 per epoch × 50 epochs)
```

# The learning rate

```python filename:Python
def descend(lr, steps=20, w=5.0):
    for _ in range(steps):
        w -= lr * 2 * w            # minimise f(w) = w², gradient 2w
    return w

print(round(descend(0.01), 3))     # 3.338 ← too small: barely moved
print(round(descend(0.1), 3))      # 0.058 ← good: close to the minimum at 0
print(round(descend(1.1), 1))      # 191.7 ← too large: diverges
```

| Symptom | Likely cause |
| --- | --- |
| Loss goes to `nan` or explodes | Learning rate too high |
| Loss drops very slowly | Learning rate too low |
| Loss oscillates / is very noisy | LR a bit high or batch too small |

> [!NOTE] Key point
>
> Typical starting points: `1e-3` for Adam/AdamW, `0.1` for SGD with momentum on CNNs. If you change the batch size a lot, retune the learning rate (a common heuristic scales it linearly with the batch size).

> [!WARNING] Watch out
>
> The loss surface of a deep network is not a bowl — it has saddle points, flat regions and many minima. Mini-batch noise actually helps: it keeps the optimiser moving through flat areas and tends to find wider minima that generalise better.

```question
What is the difference between an epoch, a batch and an iteration?

---

A batch is the subset of examples used for one gradient step; an iteration is one such step; an epoch is one pass over the whole training set. With 10,000 examples and batch size 100, one epoch is 100 iterations.
```

```question
How does batch size affect training?

---

Bigger batches give smoother gradients and better GPU utilisation but need more memory, often a larger learning rate, and can generalise slightly worse. Smaller batches are noisier (a mild regulariser) but slower per epoch.
```
