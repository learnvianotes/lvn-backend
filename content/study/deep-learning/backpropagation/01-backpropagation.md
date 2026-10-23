---
id: c5bca25f-987f-763f-bd97-3c4054233f74
key: topic:deep-learning/backpropagation
subject: deep-learning
topic: backpropagation
title: Backpropagation
slug: backpropagation
order: 1
---

Backpropagation computes the gradient of the loss with respect to every weight in one backward sweep, reusing intermediate results via the chain rule. It's what makes training deep networks affordable.

> [!INFO]
>
> <strong>Backpropagation</strong> — reverse-mode automatic differentiation: run the forward pass and remember the intermediate values, then walk the computational graph backwards, multiplying each node's <strong>local gradient</strong> by the gradient flowing in from above.

`chain rule: ∂L/∂w = ∂L/∂a · ∂a/∂z · ∂z/∂w`

# A computational graph by hand

One neuron with a squared-error loss: `z = w·x + b`, `a = σ(z)`, `L = (a − y)²`.

x, w, b → z = w·x + b → a = σ(z) → L = (a − y)²

```python filename:Python
import math

x, y, w, b = 2.0, 1.0, 0.5, -0.5
# forward
z = w * x + b                           # 0.5
a = 1 / (1 + math.exp(-z))              # σ(0.5)
L = (a - y) ** 2
# backward — one local derivative per edge, multiplied right to left
dL_da = 2 * (a - y)
da_dz = a * (1 - a)
dL_dz = dL_da * da_dz
dL_dw = dL_dz * x                       # ∂z/∂w = x
dL_db = dL_dz * 1                       # ∂z/∂b = 1
print(round(L, 4), round(dL_dw, 4), round(dL_db, 4))   # 0.1425 -0.3549 -0.1774
```

PyTorch's autograd does exactly this bookkeeping for you:

```python filename:Python
import torch

x, y = torch.tensor(2.0), torch.tensor(1.0)
w = torch.tensor(0.5, requires_grad=True)
b = torch.tensor(-0.5, requires_grad=True)

L = (torch.sigmoid(w * x + b) - y) ** 2
L.backward()                            # fills w.grad and b.grad
print(round(w.grad.item(), 4), round(b.grad.item(), 4))   # -0.3549 -0.1774
```

# A 2-layer network from scratch

Forward: `H = relu(X W₁ + b₁)`, `P = σ(H W₂ + b₂)`, BCE loss. Backward, the key results are: for sigmoid + BCE, `∂L/∂logits = (P − y) / n`; for a linear layer `Y = XW`, `∂L/∂W = Xᵀ · ∂L/∂Y` and `∂L/∂X = ∂L/∂Y · Wᵀ`; for ReLU, pass the gradient where the input was positive.

```python filename:Python
import numpy as np

rng = np.random.default_rng(0)
X = np.array([[0, 0], [0, 1], [1, 0], [1, 1]], dtype=float)
y = np.array([[0], [1], [1], [0]], dtype=float)              # XOR

params = {"W1": rng.normal(0, 1, (2, 8)), "b1": np.full(8, 0.1),
          "W2": rng.normal(0, 1, (8, 1)), "b2": np.zeros(1)}

def forward_backward(p):
    Z1 = X @ p["W1"] + p["b1"]; H = np.maximum(0, Z1)       # forward
    Z2 = H @ p["W2"] + p["b2"]; P = 1 / (1 + np.exp(-Z2))
    loss = -np.mean(y * np.log(P) + (1 - y) * np.log(1 - P))
    dZ2 = (P - y) / len(X)                                   # backward
    dW2, db2 = H.T @ dZ2, dZ2.sum(0)
    dH = dZ2 @ p["W2"].T
    dZ1 = dH * (Z1 > 0)
    dW1, db1 = X.T @ dZ1, dZ1.sum(0)
    return loss, {"W1": dW1, "b1": db1, "W2": dW2, "b2": db2}

loss, grads = forward_backward(params)
print(round(loss, 4))                     # 0.7371 ← before training
```

# Gradient checking

Always verify a hand-written backward pass numerically. Nudge each weight by `±ε` and compare the slope of the loss with the analytic gradient:

`∂L/∂θ ≈ [ L(θ + ε) − L(θ − ε) ] / 2ε relative error = |g_analytic − g_numeric| / (|g_analytic| + |g_numeric|)`

```python filename:Python
import numpy as np

rng = np.random.default_rng(0)
X = np.array([[0, 0], [0, 1], [1, 0], [1, 1]], dtype=float)
y = np.array([[0], [1], [1], [0]], dtype=float)
params = {"W1": rng.normal(0, 1, (2, 8)), "b1": np.full(8, 0.1),
          "W2": rng.normal(0, 1, (8, 1)), "b2": np.zeros(1)}

def forward_backward(p):
    Z1 = X @ p["W1"] + p["b1"]; H = np.maximum(0, Z1)
    Z2 = H @ p["W2"] + p["b2"]; P = 1 / (1 + np.exp(-Z2))
    loss = -np.mean(y * np.log(P) + (1 - y) * np.log(1 - P))
    dZ2 = (P - y) / len(X)
    dH = dZ2 @ p["W2"].T
    dZ1 = dH * (Z1 > 0)
    return loss, {"W1": X.T @ dZ1, "b1": dZ1.sum(0), "W2": H.T @ dZ2, "b2": dZ2.sum(0)}

_, grads = forward_backward(params)
eps, worst = 1e-6, 0.0
for name, value in params.items():
    for i in np.ndindex(value.shape):
        old = value[i]
        value[i] = old + eps; up, _ = forward_backward(params)
        value[i] = old - eps; down, _ = forward_backward(params)
        value[i] = old
        numeric, analytic = (up - down) / (2 * eps), grads[name][i]
        if abs(numeric) + abs(analytic) > 0:
            worst = max(worst, abs(numeric - analytic) / (abs(numeric) + abs(analytic)))
print(worst < 1e-6)            # True ← analytic and numeric gradients agree
```

# Training it

```python filename:Python
import numpy as np

rng = np.random.default_rng(0)
X = np.array([[0, 0], [0, 1], [1, 0], [1, 1]], dtype=float)
y = np.array([[0], [1], [1], [0]], dtype=float)
p = {"W1": rng.normal(0, 1, (2, 8)), "b1": np.full(8, 0.1),
     "W2": rng.normal(0, 1, (8, 1)), "b2": np.zeros(1)}

def forward_backward(p):
    Z1 = X @ p["W1"] + p["b1"]; H = np.maximum(0, Z1)
    Z2 = H @ p["W2"] + p["b2"]; P = 1 / (1 + np.exp(-Z2))
    loss = -np.mean(y * np.log(P) + (1 - y) * np.log(1 - P))
    dZ2 = (P - y) / len(X)
    dH = dZ2 @ p["W2"].T
    dZ1 = dH * (Z1 > 0)
    return loss, P, {"W1": X.T @ dZ1, "b1": dZ1.sum(0), "W2": H.T @ dZ2, "b2": dZ2.sum(0)}

history = []
for step in range(2000):
    loss, P, grads = forward_backward(p)
    for k in p:
        p[k] -= 0.5 * grads[k]                  # plain gradient descent
    if step % 500 == 0:
        history.append(round(float(loss), 3))
print(history)                                  # [0.737, 0.003, 0.001, 0.001] ← loss every 500 steps
print((P > 0.5).astype(int).ravel().tolist())   # [0, 1, 1, 0] ← XOR learned
```

> [!NOTE] Key point
>
> Cost: the backward pass costs roughly <strong>2×</strong> the forward pass, and it needs the stored activations — which is why training uses much more memory than inference.

> [!WARNING] Watch out
>
> Gradient checking is for debugging only — it costs two forward passes per parameter. Use `float64`, a small `ε` (\~1e-6) and avoid points where ReLU is exactly at its kink.

```question
Explain backpropagation in two sentences.

---

After a forward pass that stores intermediate values, we apply the chain rule backwards from the loss: each node multiplies the incoming gradient by its local derivative and passes it to its inputs. This gives the gradient for every parameter in about the cost of one extra forward pass.
```

```question
Why reverse mode and not forward mode differentiation?

---

A network has millions of inputs (parameters) and one scalar output (the loss). Reverse mode gets all parameter gradients in one backward pass; forward mode would need one pass per parameter.
```
