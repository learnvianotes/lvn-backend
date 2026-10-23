---
id: 4b2ae76c-366d-7caf-bc61-071955b93a3c
key: topic:ml-ai/clustering-methods
subject: ml-ai
topic: clustering-methods
title: Hierarchical, DBSCAN & Gaussian Mixtures
slug: hierarchical-dbscan-gaussian-mixtures
order: 1
---

Beyond k-means: hierarchical clustering builds a tree of merges, DBSCAN finds dense regions of any shape and labels noise, and Gaussian mixtures give soft, elliptical clusters with probabilities.

# Hierarchical (agglomerative) clustering

Start with every point as its own cluster and repeatedly merge the two closest clusters until one remains. The merge history is a <strong>dendrogram</strong>; cutting it at a height (or asking for `n_clusters`) gives the clusters.

| Linkage | Distance between clusters | Tends to produce |
| --- | --- | --- |
| Single | Closest pair of points | Long chains; finds non-convex shapes but is fooled by bridges of noise |
| Complete | Farthest pair of points | Compact clusters of similar diameter |
| Average | Mean of all pairwise distances | A compromise |
| Ward | Increase in total within-cluster variance | Compact, similar-sized clusters (like k-means) — the default |

```python filename:Python
import numpy as np
from scipy.cluster.hierarchy import fcluster, linkage
from sklearn.cluster import AgglomerativeClustering

X = np.array([[1.0], [1.2], [1.1], [5.0], [5.3], [9.0]])
Z = linkage(X, method="ward")                            # merge history
print(Z[:, 2].round(2).tolist())                         # [0.1, 0.17, 0.3, 4.45, 9.24] ← merge heights: a big jump = natural cut
print(fcluster(Z, t=3, criterion="maxclust").tolist())   # [1, 1, 1, 2, 2, 3] ← cut into 3 clusters
print(AgglomerativeClustering(n_clusters=3).fit_predict(X).tolist())   # [1, 1, 1, 0, 0, 2] ← same grouping (ids arbitrary)
```

No need to pick k up front and the dendrogram is informative — but the standard algorithm needs O(n²) memory, so it suits thousands of points, not millions.

# DBSCAN — density-based clustering

A point is a <strong>core point</strong> if at least `min_samples` points (itself included) lie within distance `eps`. Clusters are chains of core points plus the <strong>border points</strong> they reach; everything else is <strong>noise</strong> (label `−1`). No `k` needed, any shape works:

```python filename:Python
import numpy as np
from sklearn.cluster import DBSCAN, KMeans
from sklearn.datasets import make_moons
from sklearn.metrics import adjusted_rand_score

X, y = make_moons(n_samples=300, noise=0.05, random_state=0)
X = np.vstack([X, [[2.5, 1.5], [-1.5, -0.8]]])            # two far-away outliers
y = np.r_[y, -1, -1]

db = DBSCAN(eps=0.2, min_samples=5).fit(X)
print(sorted(set(db.labels_.tolist())))                   # [-1, 0, 1] ← two clusters + noise (−1)
print(np.where(db.labels_ == -1)[0].tolist())             # [300, 301] ← the outliers we added
km = KMeans(n_clusters=2, n_init=10, random_state=0).fit(X)
print(round(adjusted_rand_score(y, db.labels_), 2), round(adjusted_rand_score(y, km.labels_), 2))   # 1.0 0.23 ← DBSCAN vs k-means
```

- Choosing `eps`: plot each point's distance to its `min_samples`-th nearest neighbour, sorted; pick the knee (the “k-distance plot”).
- Struggles when clusters have <strong>very different densities</strong> (one `eps` can't fit all) and in high dimensions. <strong>HDBSCAN</strong> (`sklearn.cluster.HDBSCAN`) handles varying densities and needs only a minimum cluster size.
- Scale features first — `eps` is a distance.

# Gaussian mixture models

`p(x) = Σₖ πₖ · N(x | μₖ, Σₖ) fitted by expectation–maximisation (EM)`

A GMM assumes the data comes from `k` Gaussian blobs with their own means, covariances (so <strong>elliptical</strong> shapes and different sizes) and weights. EM alternates between computing each point's membership probabilities (E-step) and re-estimating the blobs from them (M-step). It gives <strong>soft</strong> assignments; k-means is roughly the special case with equal spherical covariances and hard assignments.

```python filename:Python
import numpy as np
from sklearn.cluster import KMeans
from sklearn.datasets import make_blobs
from sklearn.metrics import adjusted_rand_score
from sklearn.mixture import GaussianMixture

X, y = make_blobs(n_samples=400, centers=3, random_state=170)
X = X @ np.array([[0.6, -0.6], [-0.4, 0.8]])              # stretch into elongated ellipses

km = KMeans(n_clusters=3, n_init=10, random_state=0).fit(X)
gmm = GaussianMixture(n_components=3, covariance_type="full", random_state=0).fit(X)
print(round(adjusted_rand_score(y, km.labels_), 2), round(adjusted_rand_score(y, gmm.predict(X)), 2))   # 0.55 1.0 ← k-means vs GMM
print(gmm.predict_proba(X[:2]).round(3).tolist())         # [[0.0, 0.0, 1.0], [0.0, 1.0, 0.0]] ← soft memberships
print([round(GaussianMixture(n_components=k, random_state=0).fit(X).bic(X)) for k in (1, 2, 3, 4, 5)])   # [2858, 2417, 2103, 2474, 2168] ← lowest BIC → 3 components
```

# Which clustering method?

| Method | Needs k? | Cluster shapes | Noise handling | Scales to |
| --- | --- | --- | --- | --- |
| k-means | Yes | Spherical, similar size | None — outliers pull centroids | Millions (mini-batch) |
| Agglomerative | No (cut the tree) | Depends on linkage | Poor | Thousands |
| DBSCAN / HDBSCAN | No | Arbitrary | Labels noise points | Large, low-dimensional data |
| Gaussian mixture | Yes (choose with BIC) | Ellipses of any orientation | Low-probability points can be flagged | Medium |

```question
What is the difference between k-means and a Gaussian mixture model?

---

k-means makes hard assignments and implicitly assumes spherical clusters of equal size. A GMM models each cluster as a Gaussian with its own mean, covariance and weight, gives soft (probabilistic) assignments, and can fit elliptical clusters; it's trained with EM and k can be chosen with BIC.
```

```question
When would you use DBSCAN?

---

When clusters have arbitrary shapes, the number of clusters is unknown, and you want outliers labelled as noise — e.g. GPS points into places. Avoid it when densities vary a lot (use HDBSCAN) or in high dimensions.
```

```question
What does the linkage choose in hierarchical clustering?

---

How the distance between two clusters is measured — closest pair (single), farthest pair (complete), average of all pairs (average) or the increase in within-cluster variance (Ward). It changes the shapes of clusters the method prefers.
```
