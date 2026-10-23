---
id: c477b57b-7e5b-7000-aea3-e737944b4c80
key: topic:deep-learning/activation-functions
subject: deep-learning
topic: activation-functions
title: Activation Functions
slug: activation-functions
order: 1
---

Activations add the non-linearity that lets networks learn curved decision boundaries. Without them, any stack of layers collapses into one linear layer.

```python filename:Python
import numpy as np

rng = np.random.default_rng(0)
W1, W2 = rng.normal(size=(3, 4)), rng.normal(size=(4, 2))
x = rng.normal(size=(5, 3))

two_layers = (x @ W1) @ W2           # two linear layers, no activation…
one_layer = x @ (W1 @ W2)            # …equal one linear layer with weights W1 @ W2
print(np.allclose(two_layers, one_layer))   # True
```

# The common ones

| Function | Formula | Range | Used for | Watch out |
| --- | --- | --- | --- | --- |
| Sigmoid | `σ(z) = 1 / (1 + e^-z)` | (0, 1) | Binary output (probability), gates in LSTMs | Saturates → vanishing gradients; max slope 0.25; not zero-centred |
| Tanh | `tanh(z)` | (−1, 1) | RNN hidden states | Zero-centred but still saturates |
| ReLU | `max(0, z)` | \[0, ∞) | Default for CNNs &amp; MLPs | “Dying ReLU” — units stuck at 0 never recover |
| Leaky ReLU | `z if z > 0 else 0.01·z` | (−∞, ∞) | When many ReLUs die | Extra hyper-parameter (slope) |
| GELU | `z · Φ(z)` (Φ = normal CDF) | ≈ (−0.17, ∞) | Transformers (BERT, GPT) | Slightly more compute |
| SiLU / Swish | `z · σ(z)` | ≈ (−0.28, ∞) | Modern CNNs, LLaMA-style FFNs (SwiGLU) | — |
| Softmax | `e^zᵢ / Σⱼ e^zⱼ` | (0, 1), sums to 1 | Multi-class output layer | Overflows without the max-subtraction trick |

```python filename:Python
import numpy as np
from math import erf, sqrt

z = np.array([-2.0, 0.0, 2.0])
sigmoid = 1 / (1 + np.exp(-z))
tanh = np.tanh(z)
relu = np.maximum(0, z)
leaky = np.where(z > 0, z, 0.01 * z)
gelu = z * 0.5 * (1 + np.array([erf(v / sqrt(2)) for v in z]))

print(sigmoid.round(3).tolist())    # [0.119, 0.5, 0.881]
print(tanh.round(3).tolist())       # [-0.964, 0.0, 0.964]
print(relu.tolist())                # [0.0, 0.0, 2.0]
print(leaky.tolist())               # [-0.02, 0.0, 2.0]
print(gelu.round(3).tolist())       # [-0.046, 0.0, 1.954]
```

# Derivatives — why ReLU won

Backprop multiplies one activation derivative per layer. Sigmoid's derivative is at most 0.25, so ten sigmoid layers can shrink a gradient by `0.25¹⁰ ≈ 10⁻⁶`. ReLU's derivative is exactly 1 for positive inputs, so gradients pass through unchanged.

```python filename:Python
import numpy as np

z = np.array([-4.0, 0.0, 4.0])
s = 1 / (1 + np.exp(-z))
print((s * (1 - s)).round(4).tolist())     # [0.0177, 0.25, 0.0177] ← σ'(z) = σ(z)(1 − σ(z)); max 0.25
print((1 - np.tanh(z) ** 2).round(4).tolist())   # [0.0013, 1.0, 0.0013] ← tanh'(z); max 1
print((z > 0).astype(float).tolist())      # [0.0, 0.0, 1.0] ← ReLU'(z)
print(0.25 ** 10)                          # 9.5367431640625e-07 ← best case after 10 sigmoid layers
```

# Softmax, safely

Softmax turns a vector of scores (<strong>logits</strong>) into probabilities. Subtracting the maximum first gives the same answer (it cancels in the ratio) but prevents `exp` from overflowing.

```python filename:Python
import numpy as np

def softmax(z):
    e = np.exp(z - z.max())            # shift so the largest exponent is e^0 = 1
    return e / e.sum()

logits = np.array([2.0, 1.0, 0.1])
p = softmax(logits)
print(p.round(3).tolist(), round(p.sum(), 6))    # [0.659, 0.242, 0.099] 1.0

big = np.array([1000.0, 999.0, 998.1])           # same gaps, huge values
with np.errstate(over="ignore", invalid="ignore"):
    naive = np.exp(big) / np.exp(big).sum()
print(naive.tolist())                            # [nan, nan, nan] ← inf / inf
print(softmax(big).round(3).tolist())            # [0.659, 0.242, 0.099]
```

# In PyTorch

```python filename:Python
import torch
import torch.nn.functional as F

z = torch.tensor([-2.0, 0.0, 2.0])
print(torch.relu(z))                        # tensor([0., 0., 2.])
print(torch.sigmoid(z).round(decimals=3))   # tensor([0.1190, 0.5000, 0.8810])
print(F.gelu(z).round(decimals=3))          # tensor([-0.0460,  0.0000,  1.9540])
print(torch.softmax(torch.tensor([2.0, 1.0, 0.1]), dim=0).round(decimals=3))   # tensor([0.6590, 0.2420, 0.0990])
```

> [!TIP] Do
>
> Use ReLU (or GELU/SiLU) in hidden layers; pick the <strong>output</strong> activation from the task: none for regression, sigmoid for binary, softmax for multi-class.

> [!DANGER] Avoid
>
> Sigmoid/tanh in the hidden layers of a deep feed-forward net — gradients vanish.

```question
Why do we need non-linear activation functions?

---

A composition of linear maps is linear, so without non-linearities a 100-layer network could only learn what logistic/linear regression learns. Non-linearities let it approximate curved functions.
```

```question
What is the dying ReLU problem?

---

If a unit's pre-activation becomes negative for every input (e.g. after a large update or a bad bias), its output and gradient are 0 everywhere and it never recovers. Fixes: lower learning rate, He initialisation, Leaky ReLU/GELU.
```

```question
Sigmoid vs softmax at the output?

---

Sigmoid gives an independent probability per output — binary or <strong>multi-label</strong> (an image can be both “dog” and “outdoor”). Softmax gives a distribution over mutually exclusive classes that sums to 1 — <strong>multi-class</strong>.
```
