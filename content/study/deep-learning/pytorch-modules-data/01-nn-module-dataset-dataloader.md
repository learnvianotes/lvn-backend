---
id: ef12f731-39c2-78ef-a4d4-8a9b8b09b6cb
key: topic:deep-learning/pytorch-modules-data
subject: deep-learning
topic: pytorch-modules-data
title: nn.Module, Dataset & DataLoader
slug: nn-module-dataset-dataloader
order: 1
---

Models are `nn.Module` subclasses: declare layers in `__init__`, describe the computation in `forward`. Data comes in through a `Dataset` (one example at a time) wrapped in a `DataLoader` (batches, shuffling, workers).

# Writing a model

```python filename:Python
import torch
from torch import nn

class MLP(nn.Module):
    def __init__(self, n_in, n_hidden, n_out, p_drop=0.1):
        super().__init__()                          # always call this first
        self.net = nn.Sequential(
            nn.Linear(n_in, n_hidden), nn.ReLU(), nn.Dropout(p_drop),
            nn.Linear(n_hidden, n_out),
        )

    def forward(self, x):                           # call model(x), never model.forward(x)
        return self.net(x)

torch.manual_seed(0)
model = MLP(4, 32, 3)
print(model(torch.randn(8, 4)).shape)               # torch.Size([8, 3])
print([name for name, _ in model.named_parameters()])   # ['net.0.weight', 'net.0.bias', 'net.3.weight', 'net.3.bias']
print(sum(p.numel() for p in model.parameters() if p.requires_grad))   # 259
```

| Building block | What it is |
| --- | --- |
| `nn.Linear`, `nn.Conv2d`, `nn.LSTM`, `nn.Embedding`… | Layers with learnable parameters |
| `nn.ReLU`, `nn.Dropout`, `nn.LayerNorm`… | Activations, regularisers, normalisers |
| `nn.Sequential` | Chains modules; `forward` is automatic |
| `nn.ModuleList` / `nn.ModuleDict` | Lists/dicts of layers that are <strong>registered</strong> (a plain Python list is not) |
| `model.parameters()` | Every learnable tensor — what you hand to the optimizer |
| `model.to(device)` | Moves all parameters and buffers to CPU/GPU |

> [!WARNING] Watch out
>
> Layers kept in a plain Python `list` are invisible to `model.parameters()`, `.to(device)` and `state_dict()` — they silently never train. Use `nn.ModuleList`.

# Dataset and DataLoader

```python filename:Python
import torch
from torch.utils.data import Dataset, DataLoader, TensorDataset

class SquaresDataset(Dataset):
    """x → x², generated on demand."""
    def __init__(self, n):
        self.x = torch.arange(n, dtype=torch.float32)
    def __len__(self):
        return len(self.x)
    def __getitem__(self, i):                      # one (input, target) pair
        return self.x[i:i + 1], self.x[i:i + 1] ** 2

ds = SquaresDataset(10)
print(len(ds), ds[3])                              # 10 (tensor([3.]), tensor([9.]))

loader = DataLoader(ds, batch_size=4, shuffle=False)
print([xb.shape[0] for xb, yb in loader])          # [4, 4, 2] ← last batch is smaller
xb, yb = next(iter(loader))
print(xb.shape, yb.ravel().tolist())               # torch.Size([4, 1]) [0.0, 1.0, 4.0, 9.0]

# For tensors already in memory, TensorDataset does the same job:
tds = TensorDataset(torch.randn(100, 5), torch.randint(0, 2, (100,)))
train_loader = DataLoader(tds, batch_size=32, shuffle=True, drop_last=True)
print(len(train_loader))                           # 3 ← 100 // 32 full batches
```

| `DataLoader` argument | Meaning |
| --- | --- |
| `batch_size` | Examples per batch |
| `shuffle=True` | New random order each epoch — <strong>training only</strong> |
| `num_workers` | Background processes that load/augment data in parallel |
| `pin_memory=True` | Faster CPU → GPU copies |
| `drop_last=True` | Skip the smaller final batch (keeps BatchNorm statistics sane) |
| `collate_fn` | Custom batching — e.g. padding variable-length sequences |

```question
What's the difference between a Dataset and a DataLoader?

---

A `Dataset` knows how many examples there are and how to fetch example `i` (`__len__`, `__getitem__`). A `DataLoader` wraps it to produce shuffled mini-batches, stacking examples into tensors and optionally loading in parallel worker processes.
```
