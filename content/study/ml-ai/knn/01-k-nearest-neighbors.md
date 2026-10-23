---
id: 9c811805-bd9d-71b2-9407-9d2c41419262
key: topic:ml-ai/knn
subject: ml-ai
topic: knn
title: k-Nearest Neighbors
slug: k-nearest-neighbors
order: 1
---

k-NN makes a prediction from the `k` training points closest to the query: a majority vote for classification, an average for regression. There is no training step — the model <em>is</em> the data.

1. <strong>Store</strong>

   Keep the (scaled) training data.

2. <strong>Measure</strong>

   Compute the distance from the query to every training point.

3. <strong>Select</strong>

   Take the `k` nearest.

4. <strong>Predict</strong>

   Majority class (optionally distance-weighted) or mean target.

| Distance | Formula | Notes |
| --- | --- | --- |
| Euclidean (L2) | `√Σ(aᵢ − bᵢ)²` | Default (Minkowski with p = 2) |
| Manhattan (L1) | `Σ&#124;aᵢ − bᵢ&#124;` | Less dominated by one large difference |
| Minkowski | `(Σ&#124;aᵢ − bᵢ&#124;ᵖ)^(1/p)` | p = 1 Manhattan, p = 2 Euclidean |
| Cosine distance | `1 − a·b / (‖a‖‖b‖)` | Direction only — text and embeddings |

```python filename:Python
import numpy as np
from sklearn.neighbors import KNeighborsClassifier

X = np.array([[1, 1], [2, 1], [1, 2], [6, 5], [7, 7], [6, 6]])
y = np.array(["red", "red", "red", "blue", "blue", "blue"])
query = np.array([3, 3])

d = np.sqrt(((X - query) ** 2).sum(axis=1))
nearest = np.argsort(d)[:3]
print(d.round(2))                  # [2.83 2.24 2.24 3.61 5.66 4.24]
print(nearest, y[nearest])         # [1 2 0] ['red' 'red' 'red'] ← vote: red wins
print(KNeighborsClassifier(n_neighbors=3).fit(X, y).predict([query]))   # ['red']
```

# Choosing k

Small `k` → jagged boundary that follows noise (low bias, high variance); large `k` → over-smoothed (high bias). `k = 1` always scores 100% on its own training data. Pick `k` by cross-validation, <strong>with the features scaled</strong>:

```python filename:Python
from sklearn.datasets import load_breast_cancer
from sklearn.model_selection import cross_val_score
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

X, y = load_breast_cancer(return_X_y=True)
scores = {k: cross_val_score(make_pipeline(StandardScaler(), KNeighborsClassifier(n_neighbors=k)), X, y, cv=5).mean()
          for k in (1, 3, 7, 15, 51, 151)}
print({k: round(float(s), 3) for k, s in scores.items()})   # {1: 0.954, 3: 0.96, 7: 0.97, 15: 0.961, 51: 0.951, 151: 0.912}
```

# The curse of dimensionality

As the number of features grows, space becomes vast and empty. Distances between random points <strong>concentrate</strong>: the nearest and the farthest neighbour end up almost equally far away, so “nearest” stops meaning “similar”.

```python filename:Python
import numpy as np

rng = np.random.default_rng(0)
def contrast(d, n=500):
    X = rng.uniform(size=(n, d))
    dist = np.linalg.norm(X - rng.uniform(size=d), axis=1)
    return round(float((dist.max() - dist.min()) / dist.min()), 2)     # relative gap farthest vs nearest

print([contrast(d) for d in (2, 10, 100, 1000)])   # [40.73, 4.65, 0.36, 0.11] ← shrinks toward 0 as dimensions grow
```

Another view: to capture a fraction `r` of uniformly spread data with a small cube around a point, the cube's side must be `r^(1/d)`. For 1% of the data that is 0.01 of the range in 1-D, 0.63 in 10-D and 0.95 in 100-D — the “neighbourhood” spans almost the whole range of every feature.

```python filename:Python
print([round(0.01 ** (1 / d), 2) for d in (1, 10, 100)])   # [0.01, 0.63, 0.95]
```

- Distance-based methods (k-NN, k-means, RBF kernels) suffer most.
- The data needed to cover the space grows exponentially with the dimension; models overfit more easily.
- Fixes: feature selection, dimensionality reduction (PCA), more data, models that don't rely on raw distances (trees, linear models).
- Real data usually lies near a lower-dimensional structure, which is why k-NN still works on, e.g., 64-pixel digits.

> [!TIP] Do
>
> Use for small-to-medium, low-dimensional data with meaningful distances; as a baseline; for similarity search (with approximate-neighbour indexes at scale).

> [!DANGER] Avoid
>
> Use without scaling; with many irrelevant features; when predictions must be fast on large training sets — each prediction scans the data (KD/ball trees help only in low dimensions).

```question
How does k affect the bias–variance trade-off in k-NN?

---

Small k: flexible, low bias, high variance (k = 1 memorises the training set). Large k: smoother, higher bias, lower variance; k = n predicts the majority class everywhere. Choose k by cross-validation; an odd k avoids ties in binary problems.
```

```question
What is the curse of dimensionality?

---

In high dimensions data becomes sparse and distances concentrate, so neighbourhoods are no longer local and the amount of data needed to generalise grows exponentially. It hurts distance-based methods most; the remedies are fewer or better features, dimensionality reduction and more data.
```
