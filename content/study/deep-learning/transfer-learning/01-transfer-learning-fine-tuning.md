---
id: d3920111-d6ba-7296-a476-d010ecedf316
key: topic:deep-learning/transfer-learning
subject: deep-learning
topic: transfer-learning
title: Transfer Learning & Fine-Tuning
slug: transfer-learning-fine-tuning
order: 1
---

Don't train from scratch when someone has already trained a model on millions of examples. Reuse its learned features, replace the head for your task, and fine-tune — you need far less data and compute.

Pretrained backbone (e.g. ImageNet ResNet) → Replace the head → Train head (backbone frozen) → Optionally unfreeze &amp; fine-tune with a low LR

| Your data | Similar to pretraining data | Different from it |
| --- | --- | --- |
| <strong>Small</strong> | Feature extraction: freeze everything, train only the head | Freeze early layers, fine-tune later ones carefully |
| <strong>Large</strong> | Fine-tune the whole network | Fine-tune everything (or train longer / from scratch) |

# Freezing and replacing the head

Here a small network stands in for a pretrained backbone; with a real one the code is identical.

```python filename:Python
import torch
from torch import nn

torch.manual_seed(0)
backbone = nn.Sequential(                              # pretend these weights came from ImageNet
    nn.Conv2d(3, 32, 3, padding=1), nn.ReLU(),
    nn.Conv2d(32, 64, 3, padding=1), nn.ReLU(),
    nn.AdaptiveAvgPool2d(1), nn.Flatten(),
)
for p in backbone.parameters():
    p.requires_grad = False                            # freeze: no gradients, no updates

model = nn.Sequential(backbone, nn.Linear(64, 5))      # new head for our 5 classes
trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
total = sum(p.numel() for p in model.parameters())
print(trainable, total)                                # 325 19717 ← only the head trains

optimizer = torch.optim.AdamW((p for p in model.parameters() if p.requires_grad), lr=1e-3)
print(model(torch.randn(2, 3, 32, 32)).shape)          # torch.Size([2, 5])
```

# Fine-tuning with smaller learning rates for the backbone

```python filename:Python
import torch
from torch import nn

backbone, head = nn.Linear(10, 10), nn.Linear(10, 2)
optimizer = torch.optim.AdamW([
    {"params": backbone.parameters(), "lr": 1e-5},     # gentle: keep the pretrained features
    {"params": head.parameters(), "lr": 1e-3},         # the new head learns faster
], weight_decay=0.01)
print([g["lr"] for g in optimizer.param_groups])       # [1e-05, 0.001]
```

# With torchvision

```python filename:Python
import torch
from torch import nn
from torchvision import models

weights = models.ResNet18_Weights.DEFAULT
model = models.resnet18(weights=weights)            # downloads ImageNet weights once
for p in model.parameters():
    p.requires_grad = False
model.fc = nn.Linear(model.fc.in_features, 5)       # 512 → 5 classes (new layer is trainable)
preprocess = weights.transforms()                    # the exact resize/normalisation used in pretraining
```

> [!TIP] Do
>
> Use the pretrained model's own preprocessing (input size, mean/std normalisation); start with a frozen backbone, then unfreeze with an LR 10–100× smaller.

> [!DANGER] Avoid
>
> Fine-tune the whole network at a large learning rate — it wrecks the pretrained features (“catastrophic forgetting”).

> [!NOTE] Key point
>
> The same recipe powers NLP: take a pretrained Transformer (BERT, an LLM) and fine-tune it — fully, or with parameter-efficient methods like LoRA, covered in the <strong>GenAI</strong> notes (Fine-Tuning &amp; PEFT).

```question
What is transfer learning and why does it work?

---

Reusing a model trained on a large dataset as the starting point for a new task. Early layers learn general features (edges, textures; or syntax in language models) that are useful across tasks, so the new task only needs to learn a small head or small adjustments — with much less data and compute.
```

```question
Feature extraction vs fine-tuning?

---

Feature extraction freezes the pretrained network and trains only the new head — fast, safe for small datasets. Fine-tuning also updates some or all pretrained layers (with a lower learning rate) — better accuracy when you have more data or the domain differs.
```
