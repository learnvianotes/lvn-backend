---
id: 75990f2b-5d6e-788d-a1e0-914654761d12
key: topic:ml-ai/recommender-systems
subject: ml-ai
topic: recommender-systems
title: Recommender Systems
slug: recommender-systems
order: 1
---

Recommenders predict which items a user will like from past interactions (ratings, clicks, purchases, watch time) and item information. The core families are content-based filtering, collaborative filtering and matrix factorisation — usually combined.

| Approach | Idea | Strength | Weakness |
| --- | --- | --- | --- |
| Popularity | Recommend what's popular (per segment) | Strong baseline, no cold start for users | Not personal; reinforces popularity |
| Content-based | Items similar to what the user liked, using item features (text, genre, tags) | Works for new items; explainable | Over-specialised; needs good item features |
| Collaborative filtering (neighbourhood) | Users who agreed before will agree again / items liked by the same users are similar | No item features needed; finds surprising items | Cold start for new users and items; sparse data |
| Matrix factorisation | Learn a latent vector per user and per item; score = their dot product | Scales, captures hidden tastes | Cold start; less explainable |
| Hybrid / two-stage | Candidate generation (fast retrieval of hundreds of items) → ranking model with rich features | Industry standard at scale | More components to build and monitor |

# Content-based: similar items

```python filename:Python
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

titles = ["space adventure alien war", "romantic comedy wedding", "alien invasion space thriller",
          "wedding drama romance", "robot space exploration"]
tfidf = TfidfVectorizer().fit_transform(titles)
sim = cosine_similarity(tfidf)

liked = 0                                                # the user liked "space adventure alien war"
ranked = [int(i) for i in np.argsort(sim[liked])[::-1] if i != liked]
print(ranked[:2])                                        # [2, 4] ← the other space/alien films
print(sim[liked].round(2).tolist())                      # [1.0, 0.0, 0.35, 0.0, 0.16]
```

# Collaborative filtering: item–item similarity

```python filename:Python
import numpy as np

# ratings: rows = users, columns = items A..E; 0 = not rated
R = np.array([[5, 4, 0, 1, 0],
              [4, 5, 1, 0, 1],
              [1, 0, 5, 4, 5],
              [0, 1, 4, 5, 4],
              [5, 5, 0, 0, 1]], dtype=float)

norms = np.linalg.norm(R, axis=0)
item_sim = (R.T @ R) / np.outer(norms, norms)            # cosine similarity between item columns
print(item_sim[0].round(2).tolist())                     # [1.0, 0.97, 0.17, 0.17, 0.26] ← item A is most like item B

user, item = 0, 2                                         # predict user 0's rating of item C
rated = R[user] > 0
w = item_sim[item, rated]
print(round(float(w @ R[user, rated] / w.sum()), 2))     # 1.92 ← similarity-weighted average of their ratings
```

# Matrix factorisation

`r̂ᵤᵢ = pᵤ · qᵢ minimise Σ_(u,i observed) (rᵤᵢ − pᵤ·qᵢ)² + λ(‖pᵤ‖² + ‖qᵢ‖²)`

Each user and item gets a vector of `k` latent factors (think “how much action / romance”). Only <strong>observed</strong> ratings enter the loss — treating missing ratings as 0 (plain SVD) would teach the model that unseen means disliked. Alternating least squares (ALS) fixes the items and solves a small ridge regression per user, then swaps:

```python filename:Python
import numpy as np

R = np.array([[5, 4, 0, 1, 0],
              [4, 5, 1, 0, 1],
              [1, 0, 5, 4, 5],
              [0, 1, 4, 5, 4],
              [5, 5, 0, 0, 1]], dtype=float)
observed = R > 0
k, lam = 2, 0.1
rng = np.random.default_rng(0)
P = rng.normal(0, 0.1, (5, k))                            # user factors
Q = rng.normal(0, 0.1, (5, k))                            # item factors

for _ in range(50):                                       # alternating least squares
    for u in range(5):
        Qo = Q[observed[u]]
        P[u] = np.linalg.solve(Qo.T @ Qo + lam * np.eye(k), Qo.T @ R[u, observed[u]])
    for i in range(5):
        Po = P[observed[:, i]]
        Q[i] = np.linalg.solve(Po.T @ Po + lam * np.eye(k), Po.T @ R[observed[:, i], i])

pred = P @ Q.T
print(round(float(np.sqrt(np.mean((pred - R)[observed] ** 2))), 3))   # 0.345 ← training RMSE on observed ratings
print(np.clip(pred[0], 1, 5).round(1).tolist())         # [4.4, 4.5, 1.0, 1.1, 1.0] ← user 0, clipped to the 1–5 scale: C and E filled in
```

User 0 loves A and B and dislikes D; the factors place C and E with D, so both get low predicted ratings — the recommender won't suggest them. (Raw dot products can leave the rating scale, hence the clipping; real systems also add a global mean plus user and item <strong>bias</strong> terms: `r̂ = μ + bᵤ + bᵢ + pᵤ·qᵢ`.)

# Evaluating recommendations

| Metric | Meaning |
| --- | --- |
| Precision@k / Recall@k | Share of the top-k that are relevant / share of relevant items that appear in the top-k |
| Hit rate@k | Did at least one relevant item appear in the top-k? |
| MRR | Mean of 1 / rank of the first relevant item |
| NDCG@k | Rewards relevant items near the top with a log discount, normalised by the ideal ordering |
| Coverage, diversity, novelty | Is the system recommending more than the same popular items? |

`DCG@k = Σᵢ₌₁ᵏ relᵢ / log₂(i + 1) NDCG@k = DCG@k / IDCG@k`

```python filename:Python
import numpy as np

def ndcg_at_k(relevance, k):
    rel = np.asarray(relevance, dtype=float)[:k]
    discounts = 1 / np.log2(np.arange(2, len(rel) + 2))
    ideal = np.sort(np.asarray(relevance, dtype=float))[::-1][:k]
    return float(rel @ discounts / (ideal @ discounts))

print(round(ndcg_at_k([3, 2, 0, 1], 4), 3))    # 0.985 ← good items near the top
print(round(ndcg_at_k([0, 1, 2, 3], 4), 3))    # 0.614 ← same items, worst order
```

- <strong>Implicit feedback</strong> (clicks, views) is far more plentiful than ratings but has no explicit negatives — unobserved ≠ disliked; sample negatives carefully.
- <strong>Cold start</strong>: new users → popularity, onboarding questions, context; new items → content features.
- Split <strong>by time</strong> for offline evaluation, and confirm with an online A/B test — offline metrics only partly predict online engagement.
- Watch <strong>feedback loops</strong> and popularity bias: the model only learns from what it chose to show.

```question
Content-based vs collaborative filtering?

---

Content-based recommends items whose features resemble what the user liked — handles new items, but stays within the user's known tastes. Collaborative filtering uses the behaviour of similar users/items — needs no item features and can surprise, but suffers from cold start and sparsity. Production systems combine them.
```

```question
How does matrix factorisation work for recommendations?

---

It represents each user and item by a low-dimensional latent vector and predicts a rating (or preference) as their dot product, learning the vectors by minimising error on observed interactions plus L2 regularisation, with ALS or SGD. Missing entries are not treated as zeros.
```

```question
How do you solve the cold-start problem?

---

For new users: popularity or trending items, onboarding preferences, context (location, device, time), then quickly adapt to the first interactions. For new items: content features and embeddings, and deliberate exploration (e.g. bandits) to gather interactions.
```
