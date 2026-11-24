---
id: aba38905-4d21-7cc7-aada-420973b7b114
key: topic:data-science/clustering
subject: data-science
topic: clustering
title: K-Means Clustering
slug: k-means-clustering
order: 1
---

K-Means groups unlabelled points into K clusters around centres (centroids). The elbow method helps choose K.

1. <strong>Start</strong>

   Pick K initial centroids (`k-means++` spreads them out smartly).

2. <strong>Assign</strong>

   Each point joins its nearest centroid.

3. <strong>Update</strong>

   Each centroid moves to the mean of its points.

4. <strong>Repeat</strong>

   Until assignments stop changing (or `max_iter`).

```python filename:Python
from collections import Counter
from sklearn.cluster import KMeans
from sklearn.datasets import make_blobs

X, _ = make_blobs(n_samples=300, centers=4, cluster_std=0.60, random_state=0)
km = KMeans(n_clusters=4, init="k-means++", n_init=10, random_state=0).fit(X)
print(km.cluster_centers_.shape)          # (4, 2)
print(sorted(Counter(km.labels_).values()))   # [75, 75, 75, 75]   ← 4 equal clusters
```

# Choosing K: the elbow method

Run K-Means for K = 1…10 and record the <strong>WCSS</strong> (within-cluster sum of squares, `inertia_`). It always falls as K grows; the “elbow” where it stops falling sharply is a good K.

```python filename:Python
from sklearn.cluster import KMeans
from sklearn.datasets import make_blobs

X, _ = make_blobs(n_samples=300, centers=4, cluster_std=0.60, random_state=0)
wcss = [KMeans(n_clusters=k, n_init=10, random_state=0).fit(X).inertia_ for k in range(1, 11)]
drops = [round(wcss[i] - wcss[i + 1]) for i in range(5)]
print(drops)       # [1621, 644, 335, 23, 18]   ← big drops until K = 4, then small ones
```

```python filename:Python
import matplotlib.pyplot as plt
plt.plot(range(1, 11), wcss, marker="o")
plt.xlabel("Number of clusters (K)"); plt.ylabel("WCSS"); plt.title("Elbow Method")
plt.show()
```

# The same with SciPy

```python filename:Python
import numpy as np
from scipy.cluster.vq import kmeans, vq
from sklearn.datasets import make_blobs

X, _ = make_blobs(n_samples=300, centers=4, cluster_std=0.60, random_state=0)
centroids, _ = kmeans(X, 4, seed=0)       # centroids
labels, _ = vq(X, centroids)              # nearest centroid for each point
print(centroids.shape, len(np.unique(labels)))   # (4, 2) 4
```

> [!WARNING] Watch out
>
> K-Means assumes round, similar-sized clusters and is sensitive to feature scales — standardise features first (`StandardScaler`). For odd shapes, try DBSCAN.
