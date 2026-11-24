---
id: 169965e3-c980-7207-ab99-6aef52789aed
key: topic:deep-learning/attention
subject: deep-learning
topic: attention
title: Attention & Self-Attention
slug: attention-self-attention
order: 1
---

Attention lets every position look at every other position and take a weighted average of what it finds, with weights computed from the data. It's the core operation of Transformers.

The analogy is a soft dictionary lookup. Each token produces a <strong>query</strong> (what am I looking for?), a <strong>key</strong> (what do I contain?) and a <strong>value</strong> (what I'll hand over). A query is compared with every key; the softmax of those scores says how much of each value to take.

`Attention(Q, K, V) = softmax( Q Kᵀ / √d_k ) V`

1. <strong>Project</strong>

   `Q = X W_Q`, `K = X W_K`, `V = X W_V` — three learned linear maps of the same input (that's what makes it <em>self</em>-attention).

2. <strong>Score</strong>

   `Q Kᵀ` — dot product of every query with every key: an (n × n) matrix.

3. <strong>Scale</strong>

   Divide by `√d_k` so the scores don't grow with the vector size.

4. <strong>Mask (optional)</strong>

   Set forbidden scores to `−∞` — future tokens in a decoder, padding.

5. <strong>Softmax</strong>

   Row-wise: each token's weights over all tokens sum to 1.

6. <strong>Mix</strong>

   Multiply by `V`: each output is a weighted average of value vectors.

# From scratch

```python filename:Python
import numpy as np

def softmax(z):
    e = np.exp(z - z.max(axis=-1, keepdims=True))
    return e / e.sum(axis=-1, keepdims=True)

def attention(Q, K, V, mask=None):
    scores = Q @ K.T / np.sqrt(K.shape[-1])
    if mask is not None:
        scores = np.where(mask, scores, -np.inf)
    weights = softmax(scores)
    return weights @ V, weights

rng = np.random.default_rng(0)
n, d_model, d_k = 4, 8, 8                      # 4 tokens
X = rng.normal(size=(n, d_model))
W_q, W_k, W_v = (rng.normal(0, d_model ** -0.5, (d_model, d_k)) for _ in range(3))
Q, K, V = X @ W_q, X @ W_k, X @ W_v

out, w = attention(Q, K, V)
print(out.shape, w.shape)                      # (4, 8) (4, 4) ← one output per token; n × n weights
print(w.sum(axis=1).round(6).tolist())         # [1.0, 1.0, 1.0, 1.0] ← each row sums to 1

causal = np.tril(np.ones((n, n), dtype=bool))  # token i may only look at tokens ≤ i
_, w_causal = attention(Q, K, V, mask=causal)
print(w_causal[2].round(2).tolist())           # [0.31, 0.34, 0.35, 0.0] ← token 2 sees tokens 0–2; token 3 is masked
print(w_causal[0].round(2).tolist())           # [1.0, 0.0, 0.0, 0.0] ← token 0 can only attend to itself
```

```python filename:Python
import numpy as np
import torch
import torch.nn.functional as F

torch.manual_seed(0)
Q, K, V = torch.randn(1, 4, 8), torch.randn(1, 4, 8), torch.randn(1, 4, 8)   # (batch, tokens, d_k)

manual = torch.softmax(Q @ K.transpose(-2, -1) / 8 ** 0.5, dim=-1) @ V
fused = F.scaled_dot_product_attention(Q, K, V)          # PyTorch's optimised kernel (FlashAttention on GPUs)
print(torch.allclose(manual, fused, atol=1e-6))          # True
first = F.scaled_dot_product_attention(Q, K, V, is_causal=True)[0, 0]
print(torch.allclose(first, V[0, 0]))                    # True ← causal: the first token can only copy its own value
```

# Why divide by √d\_k?

```python filename:Python
import numpy as np

rng = np.random.default_rng(0)
for_d = {}
for d in (4, 64, 1024):
    q, k = rng.normal(size=(10000, d)), rng.normal(size=(10000, d))
    dots = (q * k).sum(axis=1)
    for_d[d] = (round(float(dots.std()), 1), round(float((dots / np.sqrt(d)).std()), 2))
print(for_d)       # {4: (2.0, 1.0), 64: (8.1, 1.01), 1024: (32.0, 1.0)} ← raw std ≈ √d; scaled std ≈ 1
```

Dot products of random `d`-dimensional vectors have standard deviation `√d`. Large scores push softmax into saturation — nearly one-hot, with vanishing gradients. Dividing by `√d_k` keeps the scores at unit scale.

| Variant | Q comes from | K, V come from | Used in |
| --- | --- | --- | --- |
| Self-attention | The sequence | The same sequence | Encoders (BERT), decoders (GPT) |
| Masked (causal) self-attention | The sequence | Earlier positions only | Decoders / LLMs — no peeking at the future |
| Cross-attention | The decoder | The encoder's output | Translation, image captioning, diffusion text conditioning |

> [!WARNING] Watch out
>
> Attention compares every token with every other: time and memory grow as <strong>O(n²)</strong> in sequence length. Doubling the context quadruples the attention cost — the reason for FlashAttention, sparse/sliding-window attention and KV caching.

```question
Explain self-attention.

---

Each token is projected into a query, key and value. A token's output is a weighted average of all value vectors, where the weights are the softmax of its query's (scaled) dot products with every key. This lets each token gather information from the most relevant other tokens, in parallel for the whole sequence.
```

```question
Why is attention better than an RNN for long sequences?

---

Any two positions interact directly in one step (path length 1 instead of n), so long-range dependencies are easy to learn and gradients don't vanish across time; and all positions are processed in parallel on a GPU. The cost is O(n²) compute and memory in the sequence length.
```
