---
id: 9d818142-fa3d-71c2-91d9-9441f205b5b6
key: topic:deep-learning/optimizers
subject: deep-learning
topic: optimizers
title: "Optimizers: Momentum, RMSProp, Adam"
slug: optimizers-momentum-rmsprop-adam
order: 1
---

Plain SGD uses only the current gradient. Modern optimizers also remember past gradients — to build speed in consistent directions (momentum) and to give each parameter its own step size (RMSProp, Adam).

| Optimizer | Update (g = gradient) | Idea |
| --- | --- | --- |
| SGD | `θ ← θ − η·g` | Step against the gradient |
| Momentum | `v ← βv + g; θ ← θ − η·v` | A heavy ball: speeds up along consistent directions, damps zig-zag |
| Nesterov | Gradient evaluated at the look-ahead point `θ − ηβv` | Momentum that corrects earlier |
| RMSProp | `s ← ρs + (1−ρ)g²; θ ← θ − η·g / (√s + ε)` | Divide by recent gradient size — per-parameter step |
| Adam | `m ← β₁m + (1−β₁)g; v ← β₂v + (1−β₂)g²; θ ← θ − η·m̂ / (√v̂ + ε)` | Momentum + RMSProp, with bias correction `m̂ = m / (1−β₁ᵗ)` |
| AdamW | Adam + `θ ← θ − η·λ·θ` applied separately | Weight decay <strong>decoupled</strong> from the adaptive step |

# Racing them on a narrow valley

`f(x, y) = x² + 100y²` is steep in `y` and flat in `x` — like many real loss surfaces. Plain SGD must keep its step below 0.01 to avoid bouncing out of the valley in `y`, and then crawls along `x`. All three start at `(5, 1)` and take 100 steps; the minimum is `f = 0`.

```python filename:Python
import numpy as np

grad = lambda t: np.array([2 * t[0], 200 * t[1]])     # ∇ of f = x² + 100y²
f = lambda t: t[0] ** 2 + 100 * t[1] ** 2
start, steps = np.array([5.0, 1.0]), 100

def sgd(lr=0.009):                                    # above 0.01 it diverges in y
    t = start.copy()
    for _ in range(steps):
        t -= lr * grad(t)
    return f(t)

def momentum(lr=0.005, beta=0.9):
    t, v = start.copy(), np.zeros(2)
    for _ in range(steps):
        v = beta * v + grad(t)
        t -= lr * v
    return f(t)

def adam(lr=0.3, b1=0.9, b2=0.999, eps=1e-8):
    t, m, v = start.copy(), np.zeros(2), np.zeros(2)
    for k in range(1, steps + 1):
        g = grad(t)
        m = b1 * m + (1 - b1) * g
        v = b2 * v + (1 - b2) * g ** 2
        m_hat, v_hat = m / (1 - b1 ** k), v / (1 - b2 ** k)
        t -= lr * m_hat / (np.sqrt(v_hat) + eps)
    return f(t)

print(f"{sgd():.4f}")        # 0.6611 ← still far from the minimum
print(f"{momentum():.4f}")   # 0.0004
print(f"{adam():.4f}")       # 0.0007
```

# In PyTorch

```python filename:Python
import torch
from torch import nn

model = nn.Linear(10, 1)
opt_sgd = torch.optim.SGD(model.parameters(), lr=0.1, momentum=0.9, nesterov=True)
opt_adam = torch.optim.Adam(model.parameters(), lr=1e-3)
opt_adamw = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=0.01)

print(opt_adamw.defaults["betas"], opt_adamw.defaults["eps"])   # (0.9, 0.999) 1e-08
```

1. <strong>`optimizer.zero_grad()`</strong>

   Clear old gradients — PyTorch <strong>accumulates</strong> them otherwise.

2. <strong>`loss.backward()`</strong>

   Compute fresh gradients into each parameter's `.grad`.

3. <strong>`optimizer.step()`</strong>

   Update the parameters using those gradients (and the optimizer's memory).

# Adam vs AdamW

L2 regularisation adds `λθ` to the gradient. In Adam that term is then divided by `√v̂`, so parameters with large gradients get <em>less</em> regularisation — not what we want. <strong>AdamW</strong> applies the decay directly to the weights, outside the adaptive step. It's the default for Transformers.

| Choose | When |
| --- | --- |
| AdamW (lr ≈ 1e-3 … 1e-4) | Default for most work: Transformers, MLPs, fine-tuning |
| SGD + momentum 0.9 (lr ≈ 0.1) + schedule | CNNs on images, when you can tune — often generalises slightly better |
| Adam | Quick prototypes; same as AdamW with `weight_decay=0` |

> [!WARNING] Watch out
>
> An optimizer keeps state: Adam stores two extra tensors (`m`, `v`) per parameter — the model's weights ×3 in memory. Save the optimizer's `state_dict()` with checkpoints or resumed training will behave differently.

```question
Why does Adam need bias correction?

---

`m` and `v` start at zero, so during the first steps they're biased toward zero (e.g. after step 1, `m = 0.1·g`). Dividing by `1 − βᵗ` rescales them to proper averages; the correction fades as `t` grows.
```

```question
What does momentum do?

---

It keeps an exponentially-weighted running sum of past gradients. Components that point the same way every step add up (faster progress along valleys); components that flip sign cancel (less zig-zagging).
```
