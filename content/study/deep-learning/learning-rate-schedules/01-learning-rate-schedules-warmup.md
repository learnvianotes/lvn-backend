---
id: fb2e566c-d3fa-79fa-a446-95c85caa1bb6
key: topic:deep-learning/learning-rate-schedules
subject: deep-learning
topic: learning-rate-schedules
title: Learning-Rate Schedules & Warmup
slug: learning-rate-schedules-warmup
order: 1
---

The best learning rate changes during training: large early to make progress, small late to settle into a minimum. Schedules automate that — and warmup protects the fragile first steps.

| Schedule | Shape | Typical use |
| --- | --- | --- |
| Step decay | Multiply by γ (e.g. 0.1) every N epochs | Classic CNN training (ResNet) |
| Exponential | Multiply by γ every epoch | Simple smooth decay |
| Cosine annealing | Half a cosine from max to \~0 | Modern default for vision &amp; LLMs |
| Linear warmup + decay | Ramp 0 → max over the first steps, then cosine/linear down | Transformers, large batches, fine-tuning |
| One-cycle | Up then down in one cycle | Fast training on a fixed budget |
| Reduce on plateau | Cut LR when validation loss stops improving | When you don't know the length of training |

# Step and cosine in PyTorch

```python filename:Python
import torch
from torch import nn

def lrs(make_scheduler, epochs=8):
    opt = torch.optim.SGD(nn.Linear(2, 1).parameters(), lr=0.1)
    sched = make_scheduler(opt)
    out = []
    for _ in range(epochs):
        out.append(round(opt.param_groups[0]["lr"], 4))
        opt.step()                    # (training for one epoch would go here)
        sched.step()                  # then advance the schedule
    return out

print(lrs(lambda o: torch.optim.lr_scheduler.StepLR(o, step_size=3, gamma=0.1)))   # [0.1, 0.1, 0.1, 0.01, 0.01, 0.01, 0.001, 0.001]
print(lrs(lambda o: torch.optim.lr_scheduler.CosineAnnealingLR(o, T_max=8)))       # [0.1, 0.0962, 0.0854, 0.0691, 0.05, 0.0309, 0.0146, 0.0038]
```

# Warmup + cosine

Adam's early estimates of `v` are noisy, and a freshly initialised network has large, badly-scaled gradients. Starting with a tiny LR and ramping up over the first few hundred or thousand steps avoids early divergence.

```python filename:Python
import math
import torch
from torch import nn

warmup, total = 3, 10
def factor(step):                                   # multiplier on the base LR
    if step < warmup:
        return (step + 1) / warmup                  # linear ramp
    progress = (step - warmup) / (total - warmup)
    return 0.5 * (1 + math.cos(math.pi * progress)) # cosine down to 0

opt = torch.optim.AdamW(nn.Linear(2, 1).parameters(), lr=1e-3)
sched = torch.optim.lr_scheduler.LambdaLR(opt, factor)
seen = []
for _ in range(total):
    seen.append(round(opt.param_groups[0]["lr"] * 1000, 2))   # in units of 1e-3
    opt.step(); sched.step()
print(seen)     # [0.33, 0.67, 1.0, 1.0, 0.95, 0.81, 0.61, 0.39, 0.19, 0.05]
```

> [!WARNING] Watch out
>
> Call `scheduler.step()` <strong>after</strong> `optimizer.step()`, and be consistent about the unit — per epoch or per batch. Transformers usually step the schedule every batch; `ReduceLROnPlateau.step(val_loss)` takes the metric as an argument.

# Finding a good max LR

An <strong>LR range test</strong>: train for a few hundred steps while increasing the LR exponentially (1e-7 → 1), plot loss vs LR, and pick a value about 10× smaller than where the loss is lowest (before it blows up).

```question
Why use learning-rate warmup?

---

At the start, weights are random and optimizer statistics are unreliable, so large steps can push the network into a bad region or cause `nan`s. A short linear warmup lets things stabilise before the full learning rate kicks in; it matters most for Transformers, Adam and large batch sizes.
```

```question
Why decay the learning rate?

---

A large LR explores and makes fast progress but bounces around the minimum; lowering it lets the weights settle into the bottom of the basin, which usually lowers both training and validation loss at the end.
```
