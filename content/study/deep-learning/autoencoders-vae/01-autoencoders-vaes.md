---
id: 7a26942a-f52e-7852-8d0d-4586e8eba880
key: topic:deep-learning/autoencoders-vae
subject: deep-learning
topic: autoencoders-vae
title: Autoencoders & VAEs
slug: autoencoders-vaes
order: 1
---

An autoencoder squeezes its input through a narrow bottleneck and learns to rebuild it — so the bottleneck must capture what matters. A variational autoencoder (VAE) makes that bottleneck a smooth probability space you can sample new data from.

Input x → Encoder → Latent code z (small) → Decoder → Reconstruction x̂

# A plain autoencoder

Trained only to minimise reconstruction error `‖x − x̂‖²` — no labels needed (self-supervised). Here the 10-D data secretly lives on a 2-D plane, and a 2-unit bottleneck is enough to rebuild it:

```python filename:Python
import torch
from torch import nn

torch.manual_seed(0)
basis = torch.randn(2, 10)
X = torch.randn(512, 2) @ basis                   # 512 points in 10-D that lie on a 2-D plane

encoder = nn.Sequential(nn.Linear(10, 32), nn.ReLU(), nn.Linear(32, 2))
decoder = nn.Sequential(nn.Linear(2, 32), nn.ReLU(), nn.Linear(32, 10))
params = list(encoder.parameters()) + list(decoder.parameters())
opt = torch.optim.Adam(params, lr=1e-2)

for step in range(1000):
    loss = ((decoder(encoder(X)) - X) ** 2).mean()
    opt.zero_grad(); loss.backward(); opt.step()

print(encoder(X).shape)                                 # torch.Size([512, 2]) ← 10 numbers compressed to 2
print(round(X.var().item(), 2), loss.item() < 0.05)     # 2.46 True ← data variance vs reconstruction error
```

| Use | How |
| --- | --- |
| Dimensionality reduction | Use `z` as compact features (a non-linear PCA) |
| Denoising | Train on noisy inputs to reconstruct clean ones |
| Anomaly detection | Normal data reconstructs well; high reconstruction error flags anomalies |
| Pretraining / compression | Learn features from unlabelled data; latent space for diffusion models (Stable Diffusion's VAE) |

> [!WARNING] Watch out
>
> A plain autoencoder's latent space has gaps: decoding a random `z` usually gives garbage. It compresses, but it isn't a generator.

# Variational autoencoder

The VAE encoder outputs a <strong>distribution</strong> — a mean `μ` and a standard deviation `σ` per latent dimension. We sample `z` from it, decode, and add a penalty that keeps every such distribution close to a standard normal `N(0, I)`. The latent space becomes smooth and filled in, so decoding `z ~ N(0, I)` produces new, plausible data.

`loss = reconstruction(x, x̂) + KL( N(μ, σ²) ‖ N(0, 1) ) KL = ½ Σ ( μ² + σ² − log σ² − 1 )`

> [!INFO]
>
> <strong>Reparameterisation trick</strong> — sampling isn't differentiable, so write `z = μ + σ ⊙ ε` with `ε ~ N(0, I)`. The randomness sits in `ε`; gradients flow through `μ` and `σ`.

```python filename:Python
import torch
from torch import nn
import torch.nn.functional as F

class VAE(nn.Module):
    def __init__(self, d_in=784, d_hidden=256, d_latent=16):
        super().__init__()
        self.enc = nn.Sequential(nn.Linear(d_in, d_hidden), nn.ReLU())
        self.mu = nn.Linear(d_hidden, d_latent)
        self.log_var = nn.Linear(d_hidden, d_latent)       # predict log σ² — any real number is valid
        self.dec = nn.Sequential(nn.Linear(d_latent, d_hidden), nn.ReLU(), nn.Linear(d_hidden, d_in))

    def forward(self, x):
        h = self.enc(x)
        mu, log_var = self.mu(h), self.log_var(h)
        z = mu + torch.exp(0.5 * log_var) * torch.randn_like(mu)   # reparameterisation
        return self.dec(z), mu, log_var

def vae_loss(logits, x, mu, log_var):
    recon = F.binary_cross_entropy_with_logits(logits, x, reduction="sum") / len(x)
    kl = 0.5 * (mu ** 2 + log_var.exp() - log_var - 1).sum() / len(x)
    return recon + kl, kl

torch.manual_seed(0)
vae = VAE()
x = torch.rand(8, 784)                                # a batch of 8 "images" with pixels in [0, 1]
logits, mu, log_var = vae(x)
loss, kl = vae_loss(logits, x, mu, log_var)
print(logits.shape, mu.shape)                         # torch.Size([8, 784]) torch.Size([8, 16])
print(loss.item() > 0, kl.item() >= 0)                # True True

new_images = torch.sigmoid(vae.dec(torch.randn(4, 16)))   # generate: decode samples from the prior
print(new_images.shape)                               # torch.Size([4, 784])
```

```python filename:Python
import numpy as np

kl = lambda mu, sigma: 0.5 * np.sum(mu ** 2 + sigma ** 2 - np.log(sigma ** 2) - 1)
print(kl(np.array([0.0]), np.array([1.0])))            # 0.0 ← already N(0, 1): no penalty
print(round(kl(np.array([2.0]), np.array([0.5])), 3))  # 2.318 ← far from N(0, 1): penalised
```

> [!NOTE] Key point
>
> The two terms pull against each other: reconstruction wants distinct, precise codes; KL wants everything to look like `N(0, 1)`. That's why VAE samples tend to be slightly blurry — and why β-VAE adds a weight on the KL term to trade one for the other.

```question
Autoencoder vs VAE?

---

An autoencoder maps each input to a single point and is trained only to reconstruct — good for compression and anomaly detection, but its latent space has holes. A VAE maps each input to a distribution and adds a KL penalty toward `N(0, I)`, giving a continuous latent space you can sample from to generate new data.
```

```question
What is the reparameterization trick?

---

Writing a sample as `z = μ + σ·ε` with `ε` drawn from a fixed `N(0, 1)`. The random draw no longer depends on the parameters, so backpropagation can compute gradients with respect to `μ` and `σ`.
```
