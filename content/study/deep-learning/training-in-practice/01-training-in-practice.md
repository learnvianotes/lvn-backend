---
id: 27d5d054-4232-790e-88d0-ddc10d4165cd
key: topic:deep-learning/training-in-practice
subject: deep-learning
topic: training-in-practice
title: Training in Practice
slug: training-in-practice
order: 1
---

Most failed training runs are bugs or bad settings, not bad architectures. A short, disciplined routine — start small, overfit one batch, read the loss curves, then tune — finds problems quickly.

# A debugging routine

1. <strong>Look at the data</strong>

   Plot samples with their labels; check shapes, ranges, class balance, normalisation, and that inputs and labels still line up after shuffling.

2. <strong>Check the first loss</strong>

   For `k` balanced classes it should be ≈ `ln k`. Far off → wrong loss, wrong labels or bad init.

3. <strong>Overfit one small batch</strong>

   A healthy model + training loop drives the loss on 10–50 examples to \~0. If it can't, there's a bug.

4. <strong>Train a simple baseline</strong>

   Small model, Adam(W) at `1e-3`, no fancy tricks. Get something working end-to-end.

5. <strong>Scale up and regularise</strong>

   Bigger model, more data, augmentation, schedules — one change at a time, tracking validation metrics.

```python filename:Python
import torch
from torch import nn

torch.manual_seed(0)
xb = torch.randn(16, 10)                          # one small batch with random labels —
yb = torch.randint(0, 4, (16,))                   # impossible to generalise, easy to memorise
model = nn.Sequential(nn.Linear(10, 64), nn.ReLU(), nn.Linear(64, 4))
opt = torch.optim.Adam(model.parameters(), lr=1e-2)
loss_fn = nn.CrossEntropyLoss()

first = loss_fn(model(xb), yb).item()
for _ in range(200):
    loss = loss_fn(model(xb), yb)
    opt.zero_grad(); loss.backward(); opt.step()

print(round(first, 1), round(torch.log(torch.tensor(4.0)).item(), 1))   # 1.4 1.4 ← first loss ≈ ln 4
print(loss.item() < 0.01)                                              # True ← memorised: the loop works
```

# Reading loss curves

| What you see | Diagnosis | Try |
| --- | --- | --- |
| Train ↓, validation ↓ then ↑ | Overfitting | Early stopping, regularisation, augmentation, more data |
| Both high and flat | Underfitting or LR too low | Bigger model, higher LR, train longer, check for bugs |
| Loss jumps to `nan` / `inf` | Exploding gradients, LR too high, `log(0)` | Lower LR, gradient clipping, warmup, check the loss inputs |
| Very noisy loss | LR too high or batch too small | Lower LR, larger batch, LR decay |
| Validation better than training | Dropout/augmentation only in training — or a leaky validation set | Usually fine; check for leakage |
| Plateau, then sudden drop | Poor init or LR schedule kicking in | Warmup, better init |

# Hyper-parameter tuning

| Priority | Hyper-parameter | Typical search |
| --- | --- | --- |
| 1 | Learning rate | Log scale: 1e-4, 3e-4, 1e-3, 3e-3… |
| 2 | Batch size / schedule / epochs | As large as memory allows; cosine + warmup |
| 3 | Weight decay, dropout | 0–0.1; 0–0.5 |
| 4 | Architecture (depth, width) | Scale up until validation stops improving |

> [!NOTE] Key point
>
> Prefer <strong>random search</strong> over grid search (it explores important dimensions better), sample learning rates on a log scale, and tune on a smaller budget before full runs. Tools such as Optuna or Ray Tune automate this; Weights &amp; Biases or TensorBoard track the runs.

# Mixed precision

Running most operations in 16-bit floats (`float16` or `bfloat16`) halves memory and uses fast tensor cores, with little accuracy loss. `torch.autocast` picks the precision per operation — matrix multiplies in 16-bit, sensitive reductions in 32-bit.

```python filename:Python
import torch
from torch import nn

model = nn.Linear(8, 4)
x = torch.randn(2, 8)
with torch.autocast(device_type="cpu", dtype=torch.bfloat16):
    out = model(x)
print(out.dtype, model.weight.dtype)      # torch.bfloat16 torch.float32 ← compute in bf16, weights stay fp32
```

```python filename:Python
scaler = torch.amp.GradScaler("cuda")          # float16 on CUDA needs loss scaling (bfloat16 doesn't)
for xb, yb in loader:
    optimizer.zero_grad()
    with torch.autocast(device_type="cuda", dtype=torch.float16):
        loss = loss_fn(model(xb), yb)
    scaler.scale(loss).backward()              # scale up so small gradients don't underflow
    scaler.step(optimizer)                     # unscales; skips the step if inf/nan appeared
    scaler.update()
```

# GPU memory and gradient accumulation

Memory holds weights, gradients, optimizer state (Adam: 2× weights) and the activations saved for backprop, which grow with batch size. When a batch doesn't fit, <strong>accumulate</strong> gradients over several micro-batches before stepping:

```python filename:Python
import torch
from torch import nn

torch.manual_seed(0)
model = nn.Linear(4, 1)
X, y = torch.randn(8, 4), torch.randn(8, 1)
loss_fn = nn.MSELoss()

model.zero_grad()
loss_fn(model(X), y).backward()                    # one batch of 8
full = model.weight.grad.clone()

model.zero_grad()
for xb, yb in zip(X.split(2), y.split(2)):         # 4 micro-batches of 2
    (loss_fn(model(xb), yb) / 4).backward()        # divide by the number of micro-batches
print(torch.allclose(full, model.weight.grad, atol=1e-6))   # True ← same gradient
```

| Speed-up | How |
| --- | --- |
| Keep the GPU fed | `num_workers > 0`, `pin_memory=True`, avoid `.item()` / `.cpu()` inside the loop |
| Mixed precision | `torch.autocast` + bf16/fp16 |
| Compile | `model = torch.compile(model)` fuses operations |
| Bigger batches | Better hardware use (retune the LR) |
| Multiple GPUs | `DistributedDataParallel` (DDP); FSDP to shard huge models |
| Save memory | Gradient checkpointing (recompute activations), smaller batch + accumulation |

```question
Your loss isn't decreasing. How do you debug it?

---

Check the data and labels first, then the initial loss against `ln k`, then try to overfit a single small batch. If that fails, look for bugs: missing `zero_grad`, softmax before `CrossEntropyLoss`, wrong label dtype/shape, frozen parameters, forgetting `optimizer.step()`, or an LR that's far too high or low. Then inspect gradient norms per layer.
```

```question
What is mixed precision training?

---

Doing most computation in 16-bit floats while keeping a 32-bit master copy of the weights. It cuts memory and speeds up training on tensor-core GPUs. With float16 a gradient scaler prevents small gradients from underflowing; bfloat16 has float32's range and usually doesn't need one.
```
