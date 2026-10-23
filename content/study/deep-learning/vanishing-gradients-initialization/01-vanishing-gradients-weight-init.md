---
id: 0288f027-ddcb-7590-a739-b3a120ff7862
key: topic:deep-learning/vanishing-gradients-initialization
subject: deep-learning
topic: vanishing-gradients-initialization
title: Vanishing Gradients & Weight Init
slug: vanishing-gradients-weight-init
order: 1
---

In a deep network the signal is multiplied by one weight matrix per layer — forwards and backwards. If each multiplication shrinks it a little, gradients vanish; if each grows it a little, they explode. Good initialisation keeps the scale steady.

# Why not start from zero?

If every weight in a layer starts equal, every unit computes the same output and receives the same gradient — they stay identical forever (<strong>symmetry</strong>). Random initialisation breaks the tie; the question is how large the random values should be.

```python filename:Python
import numpy as np

X = np.array([[1.0, 2.0], [0.5, -1.0]])
W1 = np.full((2, 3), 0.5)                     # all hidden weights equal
H = np.tanh(X @ W1)
print(H.round(3).tolist())                    # [[0.905, 0.905, 0.905], [-0.245, -0.245, -0.245]] ← 3 hidden units, identical columns
```

# Watching activations vanish

```python filename:Python
import numpy as np

def final_std(scale, act, layers=20, width=256):
    rng = np.random.default_rng(0)
    h = rng.normal(size=(512, width))
    for _ in range(layers):
        W = rng.normal(0, scale, size=(width, width))
        h = act(h @ W)
    return float(h.std())

relu = lambda z: np.maximum(0, z)
print(f"{final_std(0.01, np.tanh):.1e}")               # 1.1e-16 ← too small: signal dies
print(f"{final_std(1.0, relu):.1e}")                   # 1.2e+21 ← too large: explodes
print(f"{final_std(np.sqrt(1 / 256), np.tanh):.2f}")   # 0.15 ← Xavier with tanh: survives
print(f"{final_std(np.sqrt(2 / 256), relu):.2f}")      # 1.05 ← He with ReLU: stays ~1
```

# Xavier and He

| Scheme | Weight variance | Use with | PyTorch |
| --- | --- | --- | --- |
| Xavier / Glorot | `2 / (fan_in + fan_out)` (≈ `1 / fan_in`) | tanh, sigmoid, linear | `nn.init.xavier_uniform_` |
| He / Kaiming | `2 / fan_in` | ReLU and variants | `nn.init.kaiming_normal_(w, nonlinearity='relu')` |
| PyTorch default for `nn.Linear` | Uniform(±1/√fan\_in) | Reasonable baseline | applied automatically |

The idea: a sum of `fan_in` random terms has variance `fan_in × Var(w) × Var(x)`. Setting `Var(w) = 1/fan_in` keeps the output variance equal to the input's. ReLU zeroes half its inputs, halving the variance — so He doubles it back with `2/fan_in`.

```python filename:Python
import torch
from torch import nn

torch.manual_seed(0)
layer = nn.Linear(512, 512)
nn.init.kaiming_normal_(layer.weight, nonlinearity="relu")
nn.init.zeros_(layer.bias)
print(round(layer.weight.std().item(), 3), round((2 / 512) ** 0.5, 3))   # 0.063 0.062 ← measured vs target std
```

# Vanishing and exploding gradients

By the chain rule, the gradient at layer 1 is a <strong>product</strong> of one factor per layer above it. Factors below 1 (saturated sigmoids: slope ≤ 0.25) shrink it exponentially — early layers stop learning. Factors above 1 (large weights, long RNN unrolls) blow it up — the loss becomes `nan`.

```python filename:Python
import torch
from torch import nn

def first_layer_grad(act, he=False, depth=15):
    torch.manual_seed(0)
    layers = []
    for _ in range(depth):
        lin = nn.Linear(32, 32)
        if he:
            nn.init.kaiming_normal_(lin.weight, nonlinearity="relu")
        layers += [lin, act()]
    net = nn.Sequential(*layers, nn.Linear(32, 1))
    net(torch.randn(64, 32)).pow(2).mean().backward()
    return net[0].weight.grad.abs().mean().item()

print(f"{first_layer_grad(nn.Sigmoid):.0e}")        # 3e-15 ← sigmoid: vanished
print(f"{first_layer_grad(nn.ReLU):.0e}")           # 2e-10 ← ReLU, default init: still shrinks
print(f"{first_layer_grad(nn.ReLU, he=True):.0e}")  # 1e-03 ← ReLU + He init: healthy
```

| Fix | Helps with |
| --- | --- |
| ReLU-family activations | Vanishing (slope 1 for positive inputs) |
| Xavier / He initialisation | Both — keeps the scale steady at the start |
| BatchNorm / LayerNorm | Both — re-normalises activations every layer |
| Residual (skip) connections | Vanishing — gradient flows through the identity path (ResNets, Transformers) |
| Gradient clipping | Exploding — caps the gradient norm |
| LSTM / GRU gates | Vanishing through time in RNNs |

# Gradient clipping

```python filename:Python
import torch
from torch import nn

model = nn.Linear(4, 1)
for p in model.parameters():
    p.grad = torch.full_like(p, 10.0)             # pretend a huge gradient arrived

before = nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)   # returns the norm before clipping
after = torch.cat([p.grad.flatten() for p in model.parameters()]).norm()
print(round(before.item(), 2), round(after.item(), 2))   # 22.36 1.0
```

> [!NOTE] Key point
>
> Clipping rescales the whole gradient vector when its norm exceeds `max_norm` — the direction is kept, only the step length is capped. Call it between `loss.backward()` and `optimizer.step()`. It's standard for RNNs and Transformers (`max_norm=1.0`).

```question
What is the vanishing gradient problem and how do you fix it?

---

Gradients shrink exponentially as they flow backwards through many layers (or time steps) because they're multiplied by factors smaller than 1, so early layers barely learn. Fixes: ReLU-type activations, He/Xavier init, normalisation layers, residual connections, and gated RNNs (LSTM/GRU).
```

```question
Why can't all weights be initialised to zero?

---

Every unit in a layer would compute the same function and get the same update, so the layer behaves like a single unit forever. (Biases can start at zero — the random weights already break the symmetry.)
```
