---
id: a235d1ad-e50c-79a8-96e6-a21175a0463a
key: topic:deep-learning/loss-functions
subject: deep-learning
topic: loss-functions
title: Loss Functions
slug: loss-functions
order: 1
---

The loss turns “how wrong is the network?” into one number to minimise. Pick it from the task — and in PyTorch, feed classification losses <strong>raw logits</strong>, not probabilities.

| Task | Output layer | Loss | PyTorch |
| --- | --- | --- | --- |
| Regression | Linear (no activation) | MSE (or MAE / Huber if outliers) | `nn.MSELoss`, `nn.L1Loss`, `nn.HuberLoss` |
| Binary / multi-label | 1 logit per label | Binary cross-entropy | `nn.BCEWithLogitsLoss` |
| Multi-class (one label) | 1 logit per class | Cross-entropy | `nn.CrossEntropyLoss` |

# Regression: MSE, MAE, Huber

`MSE = (1/n) Σ (yᵢ − ŷᵢ)² MAE = (1/n) Σ |yᵢ − ŷᵢ|`

```python filename:Python
import numpy as np

y     = np.array([3.0, 5.0, 2.0, 8.0])
y_hat = np.array([2.5, 5.0, 3.0, 4.0])      # the last prediction is badly off

err = y - y_hat
print(np.mean(err ** 2))                    # 4.3125 ← MSE: the outlier dominates (4² = 16)
print(np.mean(np.abs(err)))                 # 1.375 ← MAE: every unit of error counts the same
```

MSE punishes large errors quadratically (good when big mistakes are very bad, bad when labels contain outliers). MAE is robust to outliers but its gradient doesn't shrink near the optimum. <strong>Huber</strong> is quadratic for small errors and linear for large ones — a compromise.

# Binary cross-entropy

`BCE = −(1/n) Σ [ yᵢ log pᵢ + (1 − yᵢ) log(1 − pᵢ) ] p = σ(logit)`

```python filename:Python
import numpy as np

def bce(y, p):
    return -np.mean(y * np.log(p) + (1 - y) * np.log(1 - p))

y = np.array([1, 0, 1])
print(round(bce(y, np.array([0.9, 0.1, 0.8])), 4))    # 0.1446 ← confident and right
print(round(bce(y, np.array([0.1, 0.9, 0.2])), 4))    # 2.0715 ← confident and wrong: huge loss
```

# Cross-entropy for multi-class

`CE = −log p_true = −log softmax(z)_true = −z_true + log Σⱼ e^zⱼ`

Cross-entropy only looks at the probability given to the <strong>correct</strong> class. Predicting 0.7 for the right class costs `−log 0.7 ≈ 0.36`; predicting 0.01 costs 4.6. With `k` classes, a model that guesses uniformly scores `log k` — a handy sanity check for the first loss you see.

```python filename:Python
import numpy as np
import torch
from torch import nn

logits = np.array([[2.0, 1.0, 0.1],       # sample 0: true class 0
                   [0.5, 2.5, 0.3]])      # sample 1: true class 1
target = np.array([0, 1])

log_probs = logits - np.log(np.exp(logits).sum(axis=1, keepdims=True))   # log-softmax
ce = -log_probs[np.arange(2), target].mean()
print(round(ce, 4))                                            # 0.3185

loss_fn = nn.CrossEntropyLoss()                               # log-softmax + NLL in one stable op
print(round(loss_fn(torch.tensor(logits), torch.tensor(target)).item(), 4))   # 0.3185
print(round(np.log(3), 4))                                    # 1.0986 ← loss of a uniform guess over 3 classes
```

# Logits in, not probabilities

```python filename:Python
import torch
from torch import nn

logits = torch.tensor([[2.0, -1.0]])      # one sample, 2 classes; true class 0
target = torch.tensor([0])
ce = nn.CrossEntropyLoss()

print(round(ce(logits, target).item(), 4))                        # 0.0486 ← correct usage
print(round(ce(torch.softmax(logits, 1), target).item(), 4))      # 0.3397 ← softmax applied twice: wrong

bce = nn.BCEWithLogitsLoss()               # sigmoid + BCE, numerically stable
print(round(bce(torch.tensor([3.0]), torch.tensor([1.0])).item(), 4))   # 0.0486
```

> [!WARNING] Watch out
>
> `nn.CrossEntropyLoss` and `nn.BCEWithLogitsLoss` apply softmax/sigmoid <strong>internally</strong>. Adding your own softmax/sigmoid before them squashes the gradients and training stalls. Apply softmax only when you need probabilities for display or decisions.

```question
Why cross-entropy instead of MSE for classification?

---

Cross-entropy is the negative log-likelihood of the correct class, so it punishes confident wrong answers heavily and its gradient with softmax is simply `p − y` — large when wrong. MSE on sigmoid/softmax outputs gives tiny gradients when the output saturates, so learning is slow.
```

```question
What loss would you expect at the start of training a 10-class classifier?

---

About `ln 10 ≈ 2.30`. Much higher means the initial logits are too large (bad init or a bug); it's one of the quickest sanity checks.
```
