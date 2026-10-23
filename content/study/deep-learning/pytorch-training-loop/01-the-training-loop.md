---
id: bc59671e-12c2-7468-8fa6-2c30783a64c3
key: topic:deep-learning/pytorch-training-loop
subject: deep-learning
topic: pytorch-training-loop
title: The Training Loop
slug: the-training-loop
order: 1
---

Every PyTorch project has the same heartbeat: for each batch — forward, loss, zero\_grad, backward, step. Around it: an evaluation loop in `eval()` mode under `no_grad()`, and checkpoints.

1. <strong>`model.train()`</strong>

   Dropout on, BatchNorm uses batch statistics.

2. <strong>Forward</strong>

   `logits = model(xb)` then `loss = loss_fn(logits, yb)`.

3. <strong>`optimizer.zero_grad()`</strong>

   Clear gradients from the previous step.

4. <strong>`loss.backward()`</strong>

   Compute gradients.

5. <strong>`optimizer.step()`</strong>

   Update weights (then `scheduler.step()` if you use one).

6. <strong>Evaluate</strong>

   `model.eval()` + `torch.no_grad()` on the validation set; keep the best checkpoint.

# A complete example

Classify points by whether they lie inside a circle — a non-linear boundary a linear model can't learn.

```python filename:Python
import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset

torch.manual_seed(0)
X = torch.rand(1000, 2) * 2 - 1                      # points in [-1, 1]²
y = ((X ** 2).sum(dim=1) < 0.5).long()               # class 1 inside the circle
train_ds, val_ds = TensorDataset(X[:800], y[:800]), TensorDataset(X[800:], y[800:])
train_loader = DataLoader(train_ds, batch_size=32, shuffle=True)
val_loader = DataLoader(val_ds, batch_size=200)

model = nn.Sequential(nn.Linear(2, 32), nn.ReLU(), nn.Linear(32, 32), nn.ReLU(), nn.Linear(32, 2))
loss_fn = nn.CrossEntropyLoss()
optimizer = torch.optim.AdamW(model.parameters(), lr=1e-2)

def evaluate(loader):
    model.eval()
    correct = total = 0
    with torch.no_grad():
        for xb, yb in loader:
            correct += (model(xb).argmax(dim=1) == yb).sum().item()
            total += len(yb)
    return correct / total

for epoch in range(20):
    model.train()
    for xb, yb in train_loader:
        loss = loss_fn(model(xb), yb)
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()

print(f"train acc {evaluate(train_loader):.2f}, val acc {evaluate(val_loader):.2f}")   # train acc 0.99, val acc 0.97
```

# Saving and loading

```python filename:Python
import torch
from torch import nn

torch.manual_seed(0)
model = nn.Linear(3, 1)
optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3)

torch.save(model.state_dict(), "model.pt")                   # weights only — the usual way
torch.save({"epoch": 5, "model": model.state_dict(),          # full checkpoint to resume training
            "optimizer": optimizer.state_dict()}, "checkpoint.pt")

restored = nn.Linear(3, 1)                                    # rebuild the architecture first…
restored.load_state_dict(torch.load("model.pt"))              # …then load the weights
restored.eval()
x = torch.ones(1, 3)
print(torch.equal(model(x), restored(x)))                     # True

ckpt = torch.load("checkpoint.pt")
print(ckpt["epoch"], list(ckpt["model"].keys()))              # 5 ['weight', 'bias']
```

> [!NOTE] Key point
>
> A `state_dict` is an ordered dict of parameter and buffer tensors keyed by name. Save that (not the whole pickled model object) — it survives code refactors and is safe to load with `torch.load(..., weights_only=True)`, the default in recent PyTorch.

# Using a GPU

```python filename:Python
device = torch.device("cuda" if torch.cuda.is_available()
                      else "mps" if torch.backends.mps.is_available() else "cpu")
model = model.to(device)                     # parameters move once
for xb, yb in train_loader:
    xb, yb = xb.to(device), yb.to(device)    # every batch must follow
    ...
# load a GPU checkpoint on a CPU-only machine:
state = torch.load("model.pt", map_location="cpu")
```

> [!TIP] Do
>
> Call `model.eval()` and wrap validation/inference in `torch.no_grad()` (or `torch.inference_mode()`); log `loss.item()`, not the tensor.

> [!DANGER] Avoid
>
> Accumulate `total_loss += loss` — it keeps every step's graph alive and leaks memory.

```question
Walk me through a PyTorch training step.

---

Put the model in train mode, move the batch to the device, run the forward pass to get logits, compute the loss, call `optimizer.zero_grad()`, `loss.backward()` to compute gradients, optionally clip them, then `optimizer.step()` to update the weights (and step the LR scheduler).
```

```question
What does model.eval() change?

---

It switches layers that behave differently at inference: dropout is disabled and BatchNorm uses its running statistics. It does <strong>not</strong> disable gradient tracking — that's what `torch.no_grad()` is for.
```
