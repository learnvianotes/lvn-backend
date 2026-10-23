---
id: 8fdc98cb-6c83-74e2-9939-dc941c8afcad
key: topic:deep-learning/regularization
subject: deep-learning
topic: regularization
title: Regularization
slug: regularization
order: 1
---

Big networks can memorise their training set. Regularisation makes memorising harder or less attractive, so the model learns patterns that generalise: weight decay, dropout, early stopping, data augmentation and more.

First diagnose (see the <strong>Machine Learning</strong> notes on train/test protocols): training loss far below validation loss means <strong>overfitting</strong> → regularise or get more data. Both losses high means <strong>underfitting</strong> → bigger model, train longer, less regularisation.

# L2 regularisation / weight decay

`L_total = L_data + (λ/2) Σ w² ⇒ w ← w − η(∇L_data + λw) = (1 − ηλ)·w − η∇L_data`

Each step shrinks (“decays”) every weight towards zero; only weights that keep earning their place in the loss stay large. Smaller weights mean a smoother function. In PyTorch: `AdamW(..., weight_decay=0.01)`; it's usual to exclude biases and normalisation parameters.

# Dropout

During training, dropout zeroes each activation with probability `p` and scales the survivors by `1/(1−p)` (<strong>inverted dropout</strong>), so the expected value is unchanged and nothing needs rescaling at test time. The network can't rely on any single unit — like training an ensemble of thinned networks.

```python filename:Python
import torch
from torch import nn

torch.manual_seed(0)
drop = nn.Dropout(p=0.5)
x = torch.ones(8)

drop.train()
print(drop(x))             # tensor([0., 0., 2., 0., 0., 0., 2., 2.]) ← half zeroed, survivors scaled ×2
drop.eval()
print(drop(x))             # tensor([1., 1., 1., 1., 1., 1., 1., 1.]) ← identity at inference
```

> [!NOTE] Key point
>
> Typical rates: 0.1 in Transformers, 0.2–0.5 in MLP heads. Dropout is used less in modern CNNs (BatchNorm + augmentation do the job).

# Early stopping

Track the validation loss every epoch, keep the best weights, and stop when it hasn't improved for `patience` epochs.

```python filename:Python
val_losses = [0.90, 0.72, 0.61, 0.55, 0.53, 0.54, 0.56, 0.55, 0.58, 0.60]

best, best_epoch, patience, waited = float("inf"), None, 3, 0
for epoch, loss in enumerate(val_losses):
    if loss < best:
        best, best_epoch, waited = loss, epoch, 0     # save a checkpoint here
    else:
        waited += 1
        if waited >= patience:
            break
print(epoch, best_epoch, best)     # 7 4 0.53 ← stopped at epoch 7, restore epoch 4
```

# Data augmentation

Create new, label-preserving variations of the training data so the model sees more diversity. Applied on the fly, only to the training set.

```python filename:Python
import torch

torch.manual_seed(0)
img = torch.arange(9.0).reshape(1, 3, 3)                 # (channels, height, width)
flipped = torch.flip(img, dims=[2])                      # horizontal flip
noisy = img + 0.1 * torch.randn_like(img)                # small Gaussian noise
print(img[0, 0].tolist(), flipped[0, 0].tolist())        # [0.0, 1.0, 2.0] [2.0, 1.0, 0.0]
print(noisy.shape == img.shape)                          # True
```

| Data | Common augmentations |
| --- | --- |
| Images | Random crop &amp; resize, horizontal flip, colour jitter, rotation, Cutout, MixUp/CutMix (`torchvision.transforms.v2`) |
| Text | Back-translation, synonym replacement, token masking |
| Audio | Time shift, pitch shift, added noise, SpecAugment (masking spectrogram bands) |

> [!WARNING] Watch out
>
> Augmentations must keep the label valid: flipping a “6” vertically makes a “9”; flipping a road sign mirrors its text. Never augment the validation or test sets.

# The toolbox

| Technique | How it regularises |
| --- | --- |
| More data | The best regulariser of all |
| Weight decay (L2) | Penalises large weights |
| Dropout | Random unit removal — no co-adaptation |
| Early stopping | Stops before memorisation starts |
| Data augmentation | More diverse training examples |
| Label smoothing | Targets like 0.9 / 0.1 instead of 1 / 0 — discourages over-confidence (`CrossEntropyLoss(label_smoothing=0.1)`) |
| Smaller model | Less capacity to memorise |
| Transfer learning | Start from features learned on lots of data |

```question
How does dropout work, and what changes at test time?

---

During training each unit is zeroed with probability `p` and the rest are scaled by `1/(1−p)`, so the network learns redundant features and can't depend on any one unit. At test time dropout is switched off (`model.eval()`); thanks to the inverted scaling no further adjustment is needed.
```

```question
L2 regularisation vs weight decay — are they the same?

---

For plain SGD, yes: adding `λw` to the gradient is the same as shrinking the weights each step. For adaptive optimisers like Adam they differ, because the L2 term gets divided by the adaptive denominator. AdamW implements true (decoupled) weight decay.
```

```question
Your model has 99% training accuracy and 70% validation accuracy. What do you do?

---

It's overfitting. Get more data or augment it, add weight decay/dropout, use early stopping, reduce model size, or start from a pretrained model. Also check the validation set comes from the same distribution and there's no leakage or label noise.
```
