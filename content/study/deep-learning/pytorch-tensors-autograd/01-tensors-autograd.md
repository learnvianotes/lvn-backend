---
id: 801faf00-7c5d-7854-8366-0974ecef418e
key: topic:deep-learning/pytorch-tensors-autograd
subject: deep-learning
topic: pytorch-tensors-autograd
title: Tensors & Autograd
slug: tensors-autograd
order: 1
---

PyTorch is NumPy with two superpowers: tensors can live on a GPU, and every operation can be recorded so gradients are computed automatically.

# Creating tensors

```python filename:Python
import torch

a = torch.tensor([[1.0, 2.0], [3.0, 4.0]])
print(a.shape, a.dtype)                      # torch.Size([2, 2]) torch.float32
print(torch.zeros(2, 3).shape, torch.ones(4).tolist())   # torch.Size([2, 3]) [1.0, 1.0, 1.0, 1.0]
print(torch.arange(0, 10, 3).tolist())       # [0, 3, 6, 9]
print(torch.tensor([1, 2]).dtype)            # torch.int64 ← integers default to int64

torch.manual_seed(0)
r = torch.randn(3)                           # standard normal, reproducible with the seed
print(r.round(decimals=4))                   # tensor([ 1.5410, -0.2934, -2.1788])
```

# Shapes, maths and broadcasting

```python filename:Python
import torch

x = torch.arange(6.0)
m = x.reshape(2, 3)                         # or x.view(2, 3) — same data, new shape
print(m.tolist())                           # [[0.0, 1.0, 2.0], [3.0, 4.0, 5.0]]
print(m.T.shape, m.unsqueeze(0).shape, m.flatten().shape)   # torch.Size([3, 2]) torch.Size([1, 2, 3]) torch.Size([6])

print((m @ m.T).tolist())                   # [[5.0, 14.0], [14.0, 50.0]] ← matrix multiply (2×3 @ 3×2)
print((m * 10).tolist())                    # [[0.0, 10.0, 20.0], [30.0, 40.0, 50.0]] ← element-wise
print((m + torch.tensor([100.0, 200.0, 300.0])).tolist())   # [[100.0, 201.0, 302.0], [103.0, 204.0, 305.0]] ← broadcast over rows
print(m.sum(dim=0).tolist(), m.mean(dim=1).tolist())        # [3.0, 5.0, 7.0] [1.0, 4.0] ← per column / per row
print(m.argmax(dim=1).tolist())             # [2, 2]
```

| Operation | PyTorch | NumPy equivalent |
| --- | --- | --- |
| Change shape | `x.view(...)`, `x.reshape(...)` | `x.reshape(...)` |
| Add / remove a size-1 axis | `x.unsqueeze(0)`, `x.squeeze()` | `x[None]`, `x.squeeze()` |
| Reorder axes | `x.permute(0, 2, 1)`, `x.T` | `x.transpose(0, 2, 1)` |
| Join | `torch.cat([a, b], dim=0)`, `torch.stack` | `np.concatenate`, `np.stack` |
| Reduce along an axis | `x.sum(dim=1)` | `x.sum(axis=1)` |

# NumPy bridge and devices

```python filename:Python
import numpy as np
import torch

arr = np.array([1.0, 2.0, 3.0])
t = torch.from_numpy(arr)          # shares memory with arr
arr[0] = 99
print(t.tolist())                  # [99.0, 2.0, 3.0] ← the change shows up
print(t.dtype)                     # torch.float64 ← NumPy's float64 is kept

device = "cuda" if torch.cuda.is_available() else "cpu"
x = torch.ones(2, device=device)   # create directly on the device
print(x.cpu().numpy().tolist())    # [1.0, 1.0] ← back to NumPy (must be on the CPU)
```

> [!WARNING] Watch out
>
> Tensors in one operation must be on the same device and usually the same dtype: `float32` weights × `float64` data raises an error. Convert data with `torch.tensor(arr, dtype=torch.float32)` or `.float()`. On Apple silicon the GPU device is `"mps"`.

# Autograd

Set `requires_grad=True` on a tensor and PyTorch records every operation on it in a graph. `loss.backward()` walks that graph backwards and stores `∂loss/∂x` in `x.grad`.

```python filename:Python
import torch

x = torch.tensor(3.0, requires_grad=True)
y = x ** 2 + 2 * x              # y = x² + 2x
y.backward()
print(x.grad)                   # tensor(8.) ← dy/dx = 2x + 2 = 8

w = torch.tensor([1.0, -2.0], requires_grad=True)
loss = (w ** 2).sum()
loss.backward()
print(w.grad)                   # tensor([ 2., -4.]) ← 2w
loss = (w ** 2).sum()
loss.backward()
print(w.grad)                   # tensor([ 4., -8.]) ← gradients ACCUMULATE
w.grad.zero_()                  # what optimizer.zero_grad() does
print(w.grad)                   # tensor([0., 0.])
```

```python filename:Python
import torch

w = torch.tensor([1.0, 2.0], requires_grad=True)
with torch.no_grad():                   # no graph: for evaluation and manual weight updates
    y = w * 2
print(y.requires_grad)                  # False

z = (w * 3).detach()                    # a copy cut off from the graph
print(z.requires_grad, z.tolist())      # False [3.0, 6.0]
print((w * 3).grad_fn is not None)      # True ← operations remember how they were made
```

| Tool | Use it for |
| --- | --- |
| `requires_grad=True` | Tensors you want gradients for (model parameters have it already) |
| `loss.backward()` | Compute gradients of a <strong>scalar</strong> loss |
| `.grad` / `.zero_()` | Read / reset accumulated gradients |
| `torch.no_grad()` | Inference and evaluation — saves memory and time |
| `.detach()` | Use a value without letting gradients flow back through it |
| `.item()` | Pull a Python number out of a one-element tensor (e.g. for logging) |

```question
Why do we call zero\_grad() every iteration?

---

PyTorch adds new gradients to whatever is in `.grad` (useful for gradient accumulation across micro-batches). Without resetting, each step would use the sum of all past gradients.
```

```question
view vs reshape?

---

`view` never copies — it needs the tensor's memory to be laid out compatibly (contiguous) and errors otherwise. `reshape` returns a view when it can and copies when it must.
```
