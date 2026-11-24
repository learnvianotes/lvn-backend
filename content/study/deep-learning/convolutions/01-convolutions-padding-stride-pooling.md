---
id: 8a8bed76-e366-7d88-8ada-23bfe894db26
key: topic:deep-learning/convolutions
subject: deep-learning
topic: convolutions
title: Convolutions, Padding, Stride & Pooling
slug: convolutions-padding-stride-pooling
order: 1
---

A convolutional layer slides small learned filters over an image. Each filter detects one local pattern (an edge, a texture) everywhere in the image, using the same few weights at every position.

# Why not a dense layer?

> [!NOTE] Locality
>
> Nearby pixels are related; a 3×3 filter looks only at a small neighbourhood.

> [!NOTE] Weight sharing
>
> The same filter is used at every position — far fewer parameters than connecting every pixel to every unit.

> [!NOTE] Translation equivariance
>
> Shift the input and the feature map shifts the same way: a cat is detected wherever it is.

> [!NOTE] Hierarchy
>
> Stacked layers see larger regions: edges → textures → parts → objects.

# The operation

At each position, multiply the filter element-wise with the patch underneath and sum (deep-learning “convolution” is technically cross-correlation — the filter isn't flipped).

```python filename:Python
import numpy as np

def conv2d(img, k):
    kh, kw = k.shape
    out = np.zeros((img.shape[0] - kh + 1, img.shape[1] - kw + 1))
    for i in range(out.shape[0]):
        for j in range(out.shape[1]):
            out[i, j] = np.sum(img[i:i + kh, j:j + kw] * k)
    return out

img = np.array([[0, 0, 0, 9, 9, 9]] * 5, dtype=float)    # dark left half, bright right half
vertical_edge = np.array([[-1, 0, 1],
                          [-1, 0, 1],
                          [-1, 0, 1]], dtype=float)     # Sobel-like filter
out = conv2d(img, vertical_edge)
print(out.shape)            # (3, 4) ← 5×6 input, 3×3 filter
print(out[0].tolist())      # [0.0, 27.0, 27.0, 0.0] ← fires only where brightness changes
```

# Output size: padding and stride

`out = ⌊ (n + 2p − k) / s ⌋ + 1 n = input size, k = kernel, p = padding, s = stride`

| Setting | Effect |
| --- | --- |
| Padding `p = (k−1)/2` (“same”) | Output keeps the input size (stride 1) — edges get processed too |
| No padding (“valid”) | Output shrinks by `k − 1` |
| Stride 2 | Moves the filter 2 pixels at a time — roughly halves height and width |
| Dilation `d` | Spreads the filter taps out — larger view, same parameters |

```python filename:Python
import torch
from torch import nn

out_size = lambda n, k, p=0, s=1: (n + 2 * p - k) // s + 1
print(out_size(32, 3), out_size(32, 3, p=1), out_size(32, 3, p=1, s=2), out_size(224, 7, p=3, s=2))   # 30 32 16 112

x = torch.randn(8, 3, 32, 32)                    # (batch, channels, height, width)
conv = nn.Conv2d(in_channels=3, out_channels=16, kernel_size=3, padding=1, stride=2)
print(conv(x).shape)                             # torch.Size([8, 16, 16, 16])
print(conv.weight.shape, conv.bias.shape)        # torch.Size([16, 3, 3, 3]) torch.Size([16]) ← 16 filters, each 3×3×3
print(sum(p.numel() for p in conv.parameters()))   # 448 ← 16·(3·3·3) + 16
```

`conv parameters = C_out × (C_in × k × k) + C_out — independent of the image size`

> [!NOTE] Key point
>
> Each filter spans <strong>all</strong> input channels: a 3×3 filter on an RGB image has 3×3×3 = 27 weights. The layer's output has one channel (feature map) per filter. Compare: a dense layer from a 32×32×3 image to 16×16×16 outputs would need about 12.6 million weights; this conv has 448.

# Pooling

```python filename:Python
import torch
from torch import nn

x = torch.tensor([[[[1.0, 3.0, 2.0, 0.0],
                    [4.0, 2.0, 1.0, 1.0],
                    [0.0, 1.0, 5.0, 6.0],
                    [2.0, 2.0, 7.0, 8.0]]]])            # (1, 1, 4, 4)
print(nn.MaxPool2d(2)(x).squeeze().tolist())          # [[4.0, 2.0], [2.0, 8.0]] ← max of each 2×2 block
print(nn.AvgPool2d(2)(x).squeeze().tolist())          # [[2.5, 1.0], [1.25, 6.5]]
print(nn.AdaptiveAvgPool2d(1)(x).flatten().tolist())  # [2.8125] ← global average pooling
```

Pooling shrinks feature maps (less compute, bigger receptive field) and adds a little tolerance to small shifts. It has <strong>no parameters</strong>. Modern CNNs often use stride-2 convolutions instead, and end with <strong>global average pooling</strong> — one number per channel — before the classifier.

# Receptive field

The receptive field is the patch of the input that can influence one output unit. Each 3×3 conv (stride 1) adds 2 pixels; each stride multiplies how fast later layers grow it.

```python filename:Python
def receptive_field(layers):          # layers: list of (kernel, stride)
    rf, jump = 1, 1
    for k, s in layers:
        rf += (k - 1) * jump
        jump *= s
    return rf

print(receptive_field([(3, 1)] * 2))                 # 5 ← two 3×3 convs see 5×5 (like one 5×5)
print(receptive_field([(3, 1)] * 3))                 # 7 ← three see 7×7
print(receptive_field([(3, 1), (2, 2), (3, 1), (2, 2), (3, 1)]))   # 18 ← pooling speeds growth
```

> [!NOTE] Key point
>
> Two stacked 3×3 convs see the same 5×5 area as one 5×5 conv but use `2·9 = 18` weights per channel pair instead of 25 — and add an extra non-linearity. That's VGG's key insight.

```question
How do you compute the output size of a conv layer?

---

`⌊(n + 2p − k)/s⌋ + 1`. Example: 224×224 input, 7×7 kernel, padding 3, stride 2 → `⌊(224 + 6 − 7)/2⌋ + 1 = 112`.
```

```question
Why are CNNs better than MLPs for images?

---

They exploit image structure: local connectivity and weight sharing cut parameters by orders of magnitude, translation equivariance means a pattern is recognised anywhere, and stacking builds a feature hierarchy. An MLP on raw pixels has to learn every pattern separately at every position.
```
