---
id: 81c08ac8-f7c4-7d37-bc1f-eac68bc0f0cb
key: topic:deep-learning/cnn-architectures
subject: deep-learning
topic: cnn-architectures
title: CNN Architectures & ResNet
slug: cnn-architectures-resnet
order: 1
---

The classic CNNs trace how the field learned to go deeper: bigger datasets and GPUs (AlexNet), small stacked filters (VGG), and finally skip connections (ResNet) that made 100+ layers trainable.

| Model | Year | Key idea | Depth / params |
| --- | --- | --- | --- |
| LeNet-5 | 1998 | Conv → pool → conv → pool → dense; read handwritten digits | 5 layers, 60 K |
| AlexNet | 2012 | ReLU, dropout, data augmentation, trained on GPUs — won ImageNet by a wide margin | 8 layers, 60 M |
| VGG-16 | 2014 | Only 3×3 convs, stacked deep; simple and uniform | 16 layers, 138 M |
| GoogLeNet / Inception | 2014 | Parallel 1×1, 3×3, 5×5 branches; 1×1 convs to cut channels | 22 layers, 7 M |
| ResNet | 2015 | <strong>Residual connections</strong> `y = F(x) + x` | 18–152 layers, 11–60 M |
| MobileNet / EfficientNet | 2017–19 | Depthwise-separable convs; scaling width/depth/resolution together | Few M, for phones |
| ConvNeXt, ViT | 2020–22 | Transformer ideas for vision: patches + attention (ViT), modernised CNNs | — |

# A small CNN, shape by shape

```python filename:Python
import torch
from torch import nn

torch.manual_seed(0)
model = nn.Sequential(
    nn.Conv2d(1, 16, 3, padding=1), nn.BatchNorm2d(16), nn.ReLU(),   # 28×28
    nn.MaxPool2d(2),                                                  # → 14×14
    nn.Conv2d(16, 32, 3, padding=1), nn.BatchNorm2d(32), nn.ReLU(),
    nn.MaxPool2d(2),                                                  # → 7×7
    nn.AdaptiveAvgPool2d(1), nn.Flatten(),                            # → 32 numbers
    nn.Linear(32, 10),                                                # → 10 class logits
)
x = torch.randn(4, 1, 28, 28)             # a batch of 4 MNIST-sized images
shapes = []
for layer in model:
    x = layer(x)
    if isinstance(layer, (nn.MaxPool2d, nn.Flatten, nn.Linear)):
        shapes.append(tuple(x.shape))
print(shapes)                             # [(4, 16, 14, 14), (4, 32, 7, 7), (4, 32), (4, 10)]
print(sum(p.numel() for p in model.parameters()))   # 5226
```

The pattern — conv/BN/ReLU blocks, downsampling that halves the resolution while channels double, global pooling, a linear head — describes most CNNs.

# Residual connections

> [!INFO]
>
> <strong>Residual block</strong> — instead of learning `H(x)` directly, the block learns the change `F(x) = H(x) − x` and outputs `F(x) + x`. If the best thing is to do nothing, it only has to push `F` to zero.

x → conv → BN → ReLU → conv → BN = F(x) → F(x) + x → ReLU

```python filename:Python
import torch
from torch import nn

class ResidualBlock(nn.Module):
    def __init__(self, channels):
        super().__init__()
        self.body = nn.Sequential(
            nn.Conv2d(channels, channels, 3, padding=1, bias=False), nn.BatchNorm2d(channels), nn.ReLU(),
            nn.Conv2d(channels, channels, 3, padding=1, bias=False), nn.BatchNorm2d(channels),
        )

    def forward(self, x):
        return torch.relu(self.body(x) + x)          # the skip connection

torch.manual_seed(0)
block = ResidualBlock(8)
x = torch.randn(2, 8, 16, 16)
print(block(x).shape)                                # torch.Size([2, 8, 16, 16]) ← shape preserved so x can be added

nn.init.zeros_(block.body[4].weight)                 # zero the last BN's scale → F(x) = 0
print(torch.allclose(block(x), torch.relu(x)))       # True ← the block passes x straight through
```

Why it works: the gradient of `F(x) + x` with respect to `x` is `∂F/∂x + 1`. The <strong>+1</strong> path carries gradients straight back through any number of blocks, so early layers keep learning. When the shapes differ (more channels, stride 2), the shortcut uses a 1×1 conv to match them.

> [!NOTE] 1×1 convolutions
>
> Mix channels at each pixel without looking at neighbours — cheap way to shrink or expand channel count (bottlenecks in Inception/ResNet-50).

> [!NOTE] Depthwise-separable conv
>
> A per-channel 3×3 conv followed by a 1×1 conv: \~8–9× fewer operations than a full 3×3 conv (MobileNet).

```question
Why do residual connections help train very deep networks?

---

They give gradients an identity path (the `+x`), so they don't vanish through many layers, and they make it easy for extra layers to do nothing harmful (learn `F = 0`). Plain 56-layer nets trained worse than 20-layer ones; ResNets kept improving past 100 layers.
```

```question
What does a 1×1 convolution do?

---

It's a linear layer applied at every pixel across channels: it changes the number of channels (e.g. 256 → 64) and mixes information between them, cheaply, without changing the spatial size.
```
