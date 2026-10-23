---
id: 93a05fdf-0afa-76a7-95e8-6d06bf5339a6
key: topic:deep-learning/diffusion-models
subject: deep-learning
topic: diffusion-models
title: Diffusion Models
slug: diffusion-models
order: 1
---

A diffusion model learns to reverse a gradual noising process. Training: add noise to real data and teach a network to predict that noise. Generation: start from pure noise and remove it step by step. It's the engine behind Stable Diffusion, DALL·E 3 and most image and video generators.

Image x₀ → add a little noise … ×T → Pure noise x\_T → denoise step by step (learned) → New image

# The forward (noising) process

Each step mixes in a little Gaussian noise according to a schedule `β₁ … β_T`. Conveniently, you can jump straight to any step `t` in closed form — no need to loop:

`x_t = √ᾱ_t · x₀ + √(1 − ᾱ_t) · ε ε ~ N(0, I), ᾱ_t = Π (1 − β_s)`

```python filename:Python
import numpy as np

T = 1000
betas = np.linspace(1e-4, 0.02, T)          # the original DDPM linear schedule
alpha_bar = np.cumprod(1 - betas)

for_steps = {t: round(float(np.sqrt(alpha_bar[t])), 3) for t in (0, 250, 500, 999)}
print(for_steps)          # {0: 1.0, 250: 0.722, 500: 0.279, 999: 0.006} ← how much of the original signal remains

rng = np.random.default_rng(0)
x0 = np.array([1.0, -1.0, 0.5])
t = 500
xt = np.sqrt(alpha_bar[t]) * x0 + np.sqrt(1 - alpha_bar[t]) * rng.normal(size=3)
print(xt.round(2).tolist())                 # [0.4, -0.41, 0.75] ← x₀ at step 500: mostly noise
```

# Training: predict the noise

`loss = ‖ ε − ε_θ(x_t, t) ‖² (t random, ε random, x₀ from the data)`

That's the whole objective: a plain mean-squared error. The network (a U-Net or a Transformer — “DiT”) takes the noisy input and the step `t`, and guesses the noise that was added. A toy version on 1-D data — a mixture of two bumps at −2 and +2:

```python filename:Python
import torch
from torch import nn

torch.manual_seed(0)
T = 100
betas = torch.linspace(1e-4, 0.1, T)
alphas, alpha_bar = 1 - betas, torch.cumprod(1 - betas, dim=0)
data = lambda n: torch.where(torch.rand(n, 1) < 0.5, -2.0, 2.0) + 0.3 * torch.randn(n, 1)

model = nn.Sequential(nn.Linear(2, 64), nn.SiLU(), nn.Linear(64, 64), nn.SiLU(), nn.Linear(64, 1))
opt = torch.optim.Adam(model.parameters(), lr=2e-3)

for step in range(3000):                                      # training
    x0 = data(256)
    t = torch.randint(0, T, (256, 1))
    eps = torch.randn_like(x0)
    xt = alpha_bar[t].sqrt() * x0 + (1 - alpha_bar[t]).sqrt() * eps   # jump to step t
    loss = ((model(torch.cat([xt, t / T], dim=1)) - eps) ** 2).mean()
    opt.zero_grad(); loss.backward(); opt.step()

with torch.no_grad():                                         # sampling (DDPM)
    x = torch.randn(2000, 1)                                  # start from pure noise
    for t in reversed(range(T)):
        eps_hat = model(torch.cat([x, torch.full_like(x, t / T)], dim=1))
        x = (x - betas[t] / (1 - alpha_bar[t]).sqrt() * eps_hat) / alphas[t].sqrt()
        if t > 0:
            x = x + betas[t].sqrt() * torch.randn_like(x)     # a little fresh noise each step

print(round(alpha_bar[-1].item(), 3))                         # 0.006 ← x_T is essentially pure noise
print(round((x < 0).float().mean().item(), 2))                # 0.49 ← about half the samples in each bump
print(round(x[x < 0].mean().item(), 1), round(x[x > 0].mean().item(), 1))   # -2.0 2.0 ← centred on the two modes
```

# Making it practical

| Idea | What it does |
| --- | --- |
| DDIM &amp; faster samplers | Deterministic updates that skip steps: 20–50 steps instead of 1000 |
| Latent diffusion | Diffuse in a VAE's small latent space instead of pixels — much cheaper (Stable Diffusion) |
| Text conditioning | Feed a text encoder's embeddings to the denoiser via cross-attention |
| Classifier-free guidance | `ε = ε_uncond + w · (ε_cond − ε_uncond)`, `w` ≈ 3–8: follow the prompt more strongly |
| Distillation / consistency models | Few-step or one-step generation from a trained diffusion model |

# Comparing generative models

|  | VAE | GAN | Diffusion |
| --- | --- | --- | --- |
| Sample quality | Blurry | Sharp | <strong>Sharp and diverse</strong> |
| Diversity / mode coverage | Good | Mode collapse risk | Good |
| Training | Stable | Unstable (adversarial) | Stable (simple MSE) |
| Sampling speed | One pass | One pass | Many steps (slow) — samplers help |
| Likelihood / latent | Yes / yes | No / noise vector | Approximate / no compact latent |

> [!NOTE] Key point
>
> The <strong>GenAI</strong> notes (Diffusion &amp; GANs) cover these models from the product side; the key mechanical idea is simply: learn to denoise at every noise level, then chain the denoising steps.

```question
How do diffusion models generate images?

---

They're trained to predict the noise added to real images at random noise levels. To generate, start from pure Gaussian noise and repeatedly subtract the predicted noise (plus a little fresh noise), moving from step T to 0 until a clean image remains; text prompts steer each step through cross-attention and classifier-free guidance.
```

```question
Why did diffusion models overtake GANs for image generation?

---

Their training objective is a stable regression loss (no adversarial game), they cover the data distribution without mode collapse, and they scale well with data and compute. The main drawback — slow multi-step sampling — was largely solved by better samplers, latent diffusion and distillation.
```
