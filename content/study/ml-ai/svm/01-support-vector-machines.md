---
id: 3682fe13-a8d4-7633-b391-b2515651bd77
key: topic:ml-ai/svm
subject: ml-ai
topic: svm
title: Support Vector Machines
slug: support-vector-machines
order: 1
---

An SVM finds the separating hyperplane with the <strong>widest margin</strong> between classes. Only the points on or inside the margin — the support vectors — define it. Kernels extend the same idea to non-linear boundaries.

`decision: f(x) = w·x + b predict sign(f(x)) margin width = 2 / ‖w‖`

# Hard and soft margins

`hard margin: minimise ½‖w‖² subject to yᵢ(w·xᵢ + b) ≥ 1 for all i (yᵢ ∈ {−1, +1})`

`soft margin: minimise ½‖w‖² + C · Σ max(0, 1 − yᵢ f(xᵢ)) (hinge loss)`

Real data overlaps, so the soft margin lets some points violate the margin at a cost `C`. <strong>Large </strong><strong>`C`</strong> punishes violations → narrow margin, fits training data closely (risk of overfitting). <strong>Small </strong><strong>`C`</strong> → wider margin, more violations tolerated (more regularisation).

```python filename:Python
import numpy as np
from sklearn.datasets import make_blobs
from sklearn.svm import SVC

X, y = make_blobs(n_samples=40, centers=2, random_state=6)
clf = SVC(kernel="linear", C=1000).fit(X, y)          # large C ≈ hard margin on separable data

print(len(clf.support_vectors_))                               # 3 ← only these points define the boundary
print(round(2 / np.linalg.norm(clf.coef_[0]), 3))              # 2.284 ← margin width
print(np.abs(clf.decision_function(clf.support_vectors_)).round(2))   # [1. 1. 1.] ← all on the margin: |f(x)| = 1
```

```python filename:Python
from sklearn.datasets import make_blobs
from sklearn.svm import SVC

X, y = make_blobs(n_samples=200, centers=2, cluster_std=2.5, random_state=0)   # overlapping classes
print([len(SVC(kernel="linear", C=c).fit(X, y).support_) for c in (0.01, 1, 100)])   # [114, 97, 96] ← smaller C, wider margin, more SVs
```

# Kernels

The dual form of the SVM only uses dot products between points. Replacing `xᵢ·xⱼ` with a <strong>kernel</strong> `K(xᵢ, xⱼ)` is equivalent to working in a higher-dimensional feature space without ever computing it — the <strong>kernel trick</strong>.

| Kernel | K(x, x′) | Notes |
| --- | --- | --- |
| Linear | `x·x′` | High-dimensional sparse data (text); use `LinearSVC` for speed |
| Polynomial | `(γ x·x′ + r)ᵈ` | Feature interactions up to degree d |
| RBF (Gaussian) | `exp(−γ‖x − x′‖²)` | Default; smooth, flexible boundaries |
| Sigmoid | `tanh(γ x·x′ + r)` | Rarely the best choice |

```python filename:Python
from sklearn.datasets import make_moons
from sklearn.model_selection import cross_val_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC

X, y = make_moons(n_samples=300, noise=0.2, random_state=0)       # two interleaved half-circles
for kernel in ("linear", "poly", "rbf"):
    acc = cross_val_score(make_pipeline(StandardScaler(), SVC(kernel=kernel)), X, y, cv=5).mean()
    print(kernel, round(acc, 3))
```

```text filename:Output
linear 0.837
poly 0.87
rbf 0.97
```

`gamma` sets how far one training point's influence reaches. Small `gamma` → smooth boundary; large `gamma` → every point gets its own little island (overfitting):

```python filename:Python
from sklearn.datasets import make_moons
from sklearn.model_selection import cross_validate
from sklearn.svm import SVC

X, y = make_moons(n_samples=300, noise=0.2, random_state=0)
for gamma in (0.1, 1, 100):
    r = cross_validate(SVC(gamma=gamma), X, y, cv=5, return_train_score=True)
    print(gamma, round(r["train_score"].mean(), 3), round(r["test_score"].mean(), 3))
```

```text filename:Output
0.1 0.852 0.853
1 0.982 0.983
100 0.991 0.953
```

# Practical notes

- <strong>Scale features</strong> — the margin and RBF distances depend on units.
- Tune `C` and `gamma` together on a log grid (e.g. 0.01 … 1000).
- Kernel SVM training scales between O(n²) and O(n³): fine for thousands of rows, impractical for millions → `LinearSVC`, `SGDClassifier(loss="hinge")`, or kernel approximation (`Nystroem`) + a linear model.
- No native probabilities: `SVC(probability=True)` fits Platt scaling with internal cross-validation — slower, and its argmax can disagree with `predict`. Use `decision_function` for ranking.
- Regression version: `SVR` fits a tube of width `ε` and ignores errors inside it.

```question
What are support vectors?

---

The training points that lie on the margin or violate it. They alone determine the hyperplane; removing any other point leaves the model unchanged — which is why SVMs are memory-efficient at prediction time.
```

```question
What is the kernel trick?

---

Algorithms that only need dot products can replace them with a kernel function equal to a dot product in some (possibly infinite-dimensional) feature space. You get a non-linear boundary in the original space at the cost of computing `K(x, x′)`, without building the high-dimensional features.
```

```question
How do C and gamma affect an RBF SVM?

---

`C` trades margin width against training errors — larger `C` fits the training data harder. `gamma` controls the reach of each point's influence — larger `gamma` gives wigglier boundaries. Both large → overfitting; both small → underfitting.
```
