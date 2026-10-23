---
id: b24b1621-c849-78ef-af71-2f8adcf3523d
key: topic:ml-ai/k-means
subject: ml-ai
topic: k-means
title: k-Means Clustering
slug: k-means-clustering
order: 1
---

k-means splits the data into `k` groups by placing `k` centroids and assigning every point to the nearest one. It is fast and simple — and it quietly assumes round, similarly sized clusters.

`minimise inertia = Σₖ Σ_{x ∈ Cₖ} ‖x − μₖ‖² (within-cluster sum of squared distances)`

1. <strong>Initialise</strong>

   Pick k starting centroids — <strong>k-means++</strong> spreads them out (scikit-learn's default).

2. <strong>Assign</strong>

   Put each point in the cluster of its nearest centroid.

3. <strong>Update</strong>

   Move each centroid to the mean of its points.

4. <strong>Repeat</strong>

   Until assignments stop changing. Each step lowers inertia, so it converges — but to a <strong>local</strong> minimum.

Because the result depends on the starting centroids, scikit-learn runs several initialisations (`n_init`) and keeps the one with the lowest inertia.

```python filename:Python
import numpy as np
from sklearn.cluster import KMeans
from sklearn.datasets import make_blobs

X, y_true = make_blobs(n_samples=300, centers=4, cluster_std=0.8, random_state=0)
km = KMeans(n_clusters=4, n_init=10, random_state=0).fit(X)

print(km.cluster_centers_.round(2).tolist())        # [[0.85, 4.44], [1.98, 0.83], [-1.44, 7.78], [-1.66, 2.76]]
print(round(km.inertia_, 1))                         # 369.5
print(np.bincount(km.labels_).tolist())              # [81, 74, 73, 72] ← cluster sizes
print(km.predict([[0, 4], [2, 1]]))                  # [0 1] ← new points go to the nearest centroid
```

# Choosing k

Inertia always falls as `k` grows (k = n gives 0), so you can't just minimise it. Two common heuristics:

- <strong>Elbow method</strong> — plot inertia against k and look for the bend after which gains flatten.
- <strong>Silhouette score</strong> — for each point `s = (b − a) / max(a, b)`, where `a` is its mean distance to its own cluster and `b` to the nearest other cluster. Ranges from −1 to 1; pick the k with the highest average.

```python filename:Python
from sklearn.cluster import KMeans
from sklearn.datasets import make_blobs
from sklearn.metrics import silhouette_score

X, _ = make_blobs(n_samples=300, centers=4, cluster_std=0.8, random_state=0)
inertia, silhouette = {}, {}
for k in range(2, 8):
    km = KMeans(n_clusters=k, n_init=10, random_state=0).fit(X)
    inertia[k] = round(km.inertia_)
    silhouette[k] = round(silhouette_score(X, km.labels_), 3)
print(inertia)       # {2: 1349, 3: 709, 4: 370, 5: 326, 6: 292, 7: 260} ← big drops up to k = 4, small after: the elbow
print(silhouette)    # {2: 0.496, 3: 0.515, 4: 0.58, 5: 0.503, 6: 0.43, 7: 0.396} ← highest at k = 4
```

> [!NOTE] Key point
>
> Let the use case have the final say: five customer segments the marketing team can act on beat seven segments with a marginally better silhouette.

# Assumptions and failure modes

| k-means assumes… | So it struggles with… | Try instead |
| --- | --- | --- |
| Clusters are roughly spherical (isotropic) | Elongated or curved clusters (moons, rings) | Gaussian mixtures, DBSCAN, spectral clustering |
| Clusters have similar size and density | One big sparse cluster next to a small dense one | Gaussian mixtures, HDBSCAN |
| Euclidean distance is meaningful | Unscaled features; categorical data | Scale first; k-modes / k-prototypes for categories |
| Every point belongs to a cluster | Outliers dragging centroids | DBSCAN (labels noise), k-medoids |
| You know k | Unknown number of groups | DBSCAN/HDBSCAN, silhouette/BIC to choose |

```python filename:Python
from sklearn.cluster import KMeans
from sklearn.datasets import make_moons
from sklearn.metrics import adjusted_rand_score

X, y = make_moons(n_samples=300, noise=0.05, random_state=0)      # two curved clusters
labels = KMeans(n_clusters=2, n_init=10, random_state=0).fit_predict(X)
print(round(adjusted_rand_score(y, labels), 2))    # 0.24 ← far from 1: straight boundary cuts both moons
```

- <strong>Scale features</strong> first (k-means is distance-based).
- `MiniBatchKMeans` handles very large datasets.
- Evaluating without labels: silhouette, Davies–Bouldin (lower is better), Calinski–Harabasz (higher is better). With ground truth: adjusted Rand index (ARI), normalised mutual information.

```question
How does k-means work and what does it optimise?

---

It alternates between assigning each point to its nearest centroid and moving each centroid to the mean of its assigned points, which monotonically decreases the within-cluster sum of squares. It converges to a local optimum, so it's restarted from several k-means++ initialisations.
```

```question
How do you choose k?

---

Elbow in the inertia curve, the maximum average silhouette score, the gap statistic, or BIC with a Gaussian mixture — combined with whether the clusters are useful and stable for the business question.
```

```question
When does k-means fail?

---

Non-spherical or nested clusters, clusters of very different size or density, unscaled or categorical features, strong outliers, and high dimensions where distances concentrate.
```
