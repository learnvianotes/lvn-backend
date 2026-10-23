---
id: b14fb8ae-9df4-79aa-bb05-0e7cab0ffd3b
key: topic:deep-learning/gans
subject: deep-learning
topic: gans
title: GANs
slug: gans
order: 1
---

A generative adversarial network trains two networks against each other: a generator that turns random noise into fake samples, and a discriminator that tries to tell fakes from real data. Each improves by beating the other.

Noise z → Generator G → Fake sample G(z) → Discriminator D ← also sees real data → Real or fake?

`min_G max_D E[ log D(x) ] + E[ log(1 − D(G(z))) ]`

1. <strong>Train D</strong>

   On a batch of real data (label 1) and generated data (label 0): ordinary binary classification.

2. <strong>Train G</strong>

   Generate a batch and label it <strong>real</strong>; backprop through D (frozen for this step) into G. G improves when it fools D.

3. <strong>Alternate</strong>

   Repeat. At the ideal equilibrium, fakes match the data distribution and D outputs 0.5 everywhere.

# A GAN in 1-D

Real data: numbers drawn from `N(4, 1.25²)`. The generator starts out producing values near 0 and must learn to imitate them.

```python filename:Python
import torch
from torch import nn

torch.manual_seed(0)
real_data = lambda n: torch.randn(n, 1) * 1.25 + 4.0

G = nn.Sequential(nn.Linear(1, 16), nn.ReLU(), nn.Linear(16, 1))                # noise → sample
D = nn.Sequential(nn.Linear(1, 16), nn.LeakyReLU(0.2), nn.Linear(16, 1))        # sample → real/fake logit
opt_g = torch.optim.Adam(G.parameters(), lr=1e-3, betas=(0.5, 0.999))
opt_d = torch.optim.Adam(D.parameters(), lr=1e-3, betas=(0.5, 0.999))
bce = nn.BCEWithLogitsLoss()
ones, zeros = torch.ones(64, 1), torch.zeros(64, 1)

with torch.no_grad():
    print(round(G(torch.randn(10000, 1)).mean().item(), 1))    # 0.0 ← before training

for step in range(3000):
    real, fake = real_data(64), G(torch.randn(64, 1))
    loss_d = bce(D(real), ones) + bce(D(fake.detach()), zeros)   # detach: don't update G here
    opt_d.zero_grad(); loss_d.backward(); opt_d.step()

    loss_g = bce(D(fake), ones)                                  # G wants D to say "real"
    opt_g.zero_grad(); loss_g.backward(); opt_g.step()

with torch.no_grad():
    samples = G(torch.randn(10000, 1))
print(round(samples.mean().item(), 1), round(samples.std().item(), 1))   # 4.0 0.5 ← mean learned; spread too narrow
```

The generator found the right centre but its samples are too concentrated (std 0.5 instead of 1.25) — a mild form of <strong>mode collapse</strong>: producing a narrow slice of plausible outputs is enough to fool this discriminator. Real GANs need care to avoid it.

# Why GANs are hard to train

| Problem | What happens | Remedies |
| --- | --- | --- |
| Mode collapse | G produces only a few kinds of output | Minibatch discrimination, Wasserstein loss, unrolled GANs |
| Non-convergence | G and D oscillate instead of settling | Lower LRs, Adam with β₁ = 0.5, two-timescale updates |
| Vanishing G gradient | D wins too easily, `log(1 − D(G(z)))` saturates | Non-saturating loss (train G to maximise `log D(G(z))`, as above) |
| Hard to evaluate | No likelihood to report | FID, Inception Score, human evaluation |

> [!NOTE] DCGAN
>
> Conv generator/discriminator with BatchNorm — the first stable image GAN recipe.

> [!NOTE] WGAN / WGAN-GP
>
> Wasserstein distance + gradient penalty: smoother, more informative gradients.

> [!NOTE] StyleGAN
>
> Style-based generator; photorealistic faces at 1024×1024.

> [!NOTE] CycleGAN / pix2pix
>
> Image-to-image translation: horses ↔ zebras, sketches → photos.

```question
How does a GAN work?

---

Two networks play a minimax game. The generator maps random noise to samples; the discriminator classifies samples as real or generated. The discriminator is trained to classify correctly, the generator to make the discriminator wrong. Over training, generated samples become harder to distinguish from real data.
```

```question
What is mode collapse?

---

The generator learns to produce only a small variety of outputs (one kind of face, one digit) because those reliably fool the discriminator, ignoring the rest of the data distribution.
```
