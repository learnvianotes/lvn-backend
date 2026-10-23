---
id: 1d21aae9-ea2c-7250-bba0-36d498d965ce
key: topic:deep-learning/normalization
subject: deep-learning
topic: normalization
title: Batch Norm & Layer Norm
slug: batch-norm-layer-norm
order: 1
---

Normalisation layers rescale activations to zero mean and unit variance inside the network, then let it learn the best scale and shift. Training becomes faster, more stable and less sensitive to initialisation.

`x̂ = (x − μ) / √(σ² + ε) y = γ · x̂ + β (γ, β learned)`

|  | BatchNorm | LayerNorm |
| --- | --- | --- |
| Statistics over | The <strong>batch</strong> (per feature/channel) | The <strong>features</strong> of each sample |
| Depends on batch size | Yes — noisy for small batches | No |
| Train vs eval | Different: uses running averages at eval | Same computation |
| Used in | CNNs | Transformers, RNNs |

# BatchNorm by hand

```python filename:Python
import numpy as np
import torch
from torch import nn

x = np.array([[1.0, 200.0], [2.0, 220.0], [3.0, 240.0], [4.0, 260.0]])   # 4 samples, 2 features
mu, var = x.mean(axis=0), x.var(axis=0)             # per feature, over the batch
x_hat = (x - mu) / np.sqrt(var + 1e-5)
print(x_hat[:, 0].round(3).tolist())               # [-1.342, -0.447, 0.447, 1.342]
print(x_hat[:, 1].round(3).tolist())               # [-1.342, -0.447, 0.447, 1.342] ← same, whatever the original scale

bn = nn.BatchNorm1d(2)                             # γ = 1, β = 0 at the start
out = bn(torch.tensor(x, dtype=torch.float32))     # training mode: batch statistics
print(np.allclose(out.detach().numpy(), x_hat, atol=1e-4))   # True
```

# Train vs eval mode

During training BatchNorm uses the current batch's mean and variance and updates <strong>running averages</strong>. In `model.eval()` it uses those running averages instead, so a single example gets a deterministic output.

```python filename:Python
import torch
from torch import nn

torch.manual_seed(0)
bn = nn.BatchNorm1d(1, momentum=0.1)
print(bn.running_mean.item(), bn.running_var.item())   # 0.0 1.0 ← initial values

bn.train()
for _ in range(100):
    bn(torch.randn(32, 1) * 3 + 10)                    # data with mean 10, std 3
print(round(bn.running_mean.item(), 1), round(bn.running_var.item() ** 0.5, 1))   # 9.8 2.9

bn.eval()
print(round(bn(torch.tensor([[10.0]])).item(), 2))     # 0.07 ← ≈ 0: the value sits at the mean
```

> [!WARNING] Watch out
>
> Forgetting `model.eval()` before validation or inference is a classic bug: BatchNorm then normalises with the statistics of whatever batch you pass in (and a batch of 1 breaks it), and dropout stays on. Always switch modes.

# LayerNorm

```python filename:Python
import torch
from torch import nn

x = torch.tensor([[1.0, 2.0, 3.0, 4.0],
                  [10.0, 20.0, 30.0, 40.0]])
ln = nn.LayerNorm(4)                          # normalise over the last dimension of each sample
out = ln(x).detach()
print([round(v, 3) for v in out[0].tolist()])   # [-1.342, -0.447, 0.447, 1.342]
print([round(v, 3) for v in out[1].tolist()])   # [-1.342, -0.447, 0.447, 1.342] ← same: each row is scaled on its own
```

Each row is normalised on its own, so it works with any batch size (even 1) and with variable-length sequences — why Transformers use it. Many LLMs use <strong>RMSNorm</strong>, a cheaper variant that only divides by the root-mean-square (no mean subtraction).

> [!NOTE] GroupNorm
>
> Normalises groups of channels per sample — a BatchNorm replacement for tiny batches (detection, segmentation).

> [!NOTE] Pre-LN vs Post-LN
>
> Transformers normalise <em>before</em> each sub-layer (Pre-LN) in most modern models — more stable to train than the original Post-LN.

```question
Why does batch normalization help?

---

It keeps each layer's inputs in a well-scaled range, which allows higher learning rates, reduces sensitivity to initialisation and smooths the loss landscape. The batch noise also gives a mild regularising effect.
```

```question
BatchNorm vs LayerNorm — when do you use which?

---

BatchNorm for CNNs with reasonably large batches. LayerNorm (or RMSNorm) for Transformers and RNNs, where sequence lengths vary, batches can be small, and train/inference behaviour should be identical.
```
