---
id: 9e1cb138-ac6d-7f9d-bd5b-1c6b1d34bb8e
key: topic:deep-learning/mlp-forward-pass
subject: deep-learning
topic: mlp-forward-pass
title: MLPs & the Forward Pass
slug: mlps-the-forward-pass
order: 1
---

A multi-layer perceptron (MLP) stacks fully-connected layers with activations in between. The forward pass is just matrix multiplies — computed for a whole batch at once.

> [!INFO]
>
> <strong>Fully-connected (dense / linear) layer</strong> — every output unit is connected to every input: `Y = X W + b`, where `X` is (batch, n\_in), `W` is (n\_in, n\_out) and `b` is (n\_out,).

Input layer (features) → Hidden layer 1 + ReLU → Hidden layer 2 + ReLU → Output layer (logits)

# Shapes and parameter counts

`parameters of a dense layer = n_in × n_out + n_out (weights + biases)`

```python filename:Python
import numpy as np

rng = np.random.default_rng(0)
sizes = [4, 16, 8, 3]                  # 4 features → 16 → 8 → 3 classes
params = [(rng.normal(0, 0.5, (a, b)), np.zeros(b)) for a, b in zip(sizes, sizes[1:])]

def forward(X):
    h = X
    for i, (W, b) in enumerate(params):
        h = h @ W + b
        if i < len(params) - 1:       # ReLU on hidden layers only
            h = np.maximum(0, h)
    return h                           # logits

X = rng.normal(size=(5, 4))            # a batch of 5 samples
print(forward(X).shape)                # (5, 3)
print(sum(W.size + b.size for W, b in params))   # 243 ← (4·16+16) + (16·8+8) + (8·3+3)
```

# A hidden layer solves XOR

With hand-picked weights, two ReLU units are enough: `h₁ = relu(x₁ + x₂)` counts the ones, `h₂ = relu(x₁ + x₂ − 1)` fires only when both are 1, and the output is `h₁ − 2h₂`.

```python filename:Python
import numpy as np

X = np.array([[0, 0], [0, 1], [1, 0], [1, 1]])
W1 = np.array([[1, 1], [1, 1]]); b1 = np.array([0, -1])
W2 = np.array([1, -2]);          b2 = 0

H = np.maximum(0, X @ W1 + b1)
print(H.tolist())                  # [[0, 0], [1, 0], [1, 0], [2, 1]] ← the hidden representation
print((H @ W2 + b2).tolist())      # [0, 1, 1, 0] ← XOR
```

> [!NOTE] Key point
>
> The hidden layer re-maps the inputs so that the classes <em>become</em> linearly separable — (0,1) and (1,0) both land on `[1, 0]`. That is what “learning a representation” means. Backpropagation finds such weights automatically (see <strong>Backpropagation</strong>).

# The same network in PyTorch

```python filename:Python
import torch
from torch import nn

torch.manual_seed(0)
model = nn.Sequential(
    nn.Linear(4, 16), nn.ReLU(),
    nn.Linear(16, 8), nn.ReLU(),
    nn.Linear(8, 3),                  # raw logits — the loss applies softmax
)
X = torch.randn(5, 4)
print(model(X).shape)                                    # torch.Size([5, 3])
print(sum(p.numel() for p in model.parameters()))       # 243
```

# Universal approximation

> [!INFO]
>
> <strong>Universal approximation theorem</strong> — an MLP with <strong>one</strong> hidden layer and a non-linear activation can approximate any continuous function on a bounded domain as closely as you like — given enough hidden units.

> [!WARNING] Watch out
>
> The theorem says a good network <em>exists</em>, not that gradient descent will find it or that it will generalise. The required width can be astronomically large; in practice <strong>depth</strong> gives the same power with far fewer parameters.

| Choice | Rule of thumb |
| --- | --- |
| Hidden layers | 1–3 for tabular data; deeper nets need tricks (normalisation, residuals) |
| Width | Powers of two (64, 128, 256…) — wide enough to overfit a small batch |
| Hidden activation | ReLU / GELU |
| Output layer | Linear, with `n_out` = 1 (regression / binary) or number of classes |

```question
What happens in a forward pass?

---

Input flows layer by layer: each layer computes `XW + b`, applies its activation and passes the result on, until the output layer produces predictions (logits). Intermediate activations are kept in memory because backprop needs them.
```

```question
How many parameters does a Linear(512, 256) layer have?

---

`512 × 256 + 256 = 131,328` — one weight per input–output pair plus one bias per output.
```
