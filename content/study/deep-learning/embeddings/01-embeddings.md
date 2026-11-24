---
id: c849644f-1b38-72c2-b68a-ff886622ac86
key: topic:deep-learning/embeddings
subject: deep-learning
topic: embeddings
title: Embeddings
slug: embeddings
order: 1
---

An embedding maps each discrete item — a word, token, user or product — to a learned dense vector. Similar items end up close together, and the vectors feed straight into a network.

|  | One-hot | Embedding |
| --- | --- | --- |
| Size | Vocabulary size (e.g. 50,000), all zeros but one | Small and dense (e.g. 64–4096) |
| Similarity | Every pair equally different | Learned: `cat` is near `dog` |
| Parameters | None | `vocab × dim` table, trained with the model |

# An embedding layer is a lookup table

```python filename:Python
import torch
from torch import nn

torch.manual_seed(0)
emb = nn.Embedding(num_embeddings=5, embedding_dim=3)     # 5 tokens, 3-D vectors
ids = torch.tensor([[1, 4, 1]])                           # a batch with one sequence of token ids
vectors = emb(ids)
print(vectors.shape)                                      # torch.Size([1, 3, 3]) ← (batch, sequence, dim)
print(torch.equal(vectors[0, 0], emb.weight[1]))          # True ← row 1 of the table

one_hot = nn.functional.one_hot(torch.tensor(4), 5).float()
print(torch.allclose(one_hot @ emb.weight, emb.weight[4]))   # True ← same as one-hot × matrix, but cheaper
```

Mathematically, an embedding is a linear layer applied to a one-hot vector — but indexing a row is far cheaper than multiplying a 50,000-wide sparse vector. Gradients only update the rows that were used in the batch.

# Similarity between vectors

`cosine similarity(a, b) = (a · b) / (‖a‖ ‖b‖) 1 = same direction, 0 = unrelated, −1 = opposite`

```python filename:Python
import numpy as np

# toy 4-D vectors (real ones are learned and have hundreds of dimensions)
vec = {"king":  np.array([0.9, 0.8, 0.1, 0.7]),
       "queen": np.array([0.9, 0.1, 0.8, 0.7]),
       "man":   np.array([0.1, 0.9, 0.1, 0.2]),
       "woman": np.array([0.1, 0.2, 0.8, 0.2]),
       "apple": np.array([0.0, 0.1, 0.1, -0.9])}

cos = lambda a, b: a @ b / (np.linalg.norm(a) * np.linalg.norm(b))
print(round(cos(vec["king"], vec["queen"]), 2), round(cos(vec["king"], vec["apple"]), 2))   # 0.75 -0.42

target = vec["king"] - vec["man"] + vec["woman"]         # the famous analogy
best = max((w for w in vec if w not in ("king", "man", "woman")), key=lambda w: cos(vec[w], target))
print(best)                                              # queen
```

| Kind | How it's learned | Examples |
| --- | --- | --- |
| Static word embeddings | Predict neighbouring words | word2vec, GloVe, fastText |
| Task embeddings | End-to-end with the model (`nn.Embedding`) | Token embeddings in every Transformer |
| Contextual embeddings | Transformer hidden states — the vector depends on the sentence | BERT (“bank” of a river vs a bank account) |
| Sentence / document embeddings | Contrastive training on similar pairs | Semantic search, RAG (see the <strong>GenAI</strong> notes) |
| Entity embeddings | Learned inside a recommender or tabular model | Users, products, categories |

> [!NOTE] Key point
>
> `padding_idx=0` keeps the padding token's vector fixed at zero and excluded from updates. Embedding tables are often the largest part of small language models: 50,000 tokens × 768 dims = 38 M parameters.

```question
What is an embedding, and why not use one-hot vectors?

---

A dense, learned vector for each discrete item. One-hot vectors are huge, sparse and make every pair of items equally distant; embeddings are compact and place related items near each other, which lets the model generalise from one item to similar ones.
```
