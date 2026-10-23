---
id: e01a7f53-4c97-7ac0-a0ae-79deabf45ffe
key: topic:ml-ai/pca
subject: ml-ai
topic: pca
title: PCA & Dimensionality Reduction
slug: pca-dimensionality-reduction
order: 1
---

Principal component analysis finds new, uncorrelated axes — the directions along which the data varies most — and lets you keep only the first few. It compresses, denoises and visualises data, but only captures linear structure.

1. <strong>Standardise</strong>

   Centre every feature (PCA does this) and usually scale to unit variance (you must do this).

2. <strong>Covariance</strong>

   Compute the covariance matrix of the features.

3. <strong>Eigen-decompose</strong>

   Its eigenvectors are the principal components; each eigenvalue is the variance along that component.

4. <strong>Project</strong>

   Keep the top-k components: `Z = X_centred · W_k`.

```python filename:Python
import numpy as np
from sklearn.decomposition import PCA

rng = np.random.default_rng(0)
x = rng.normal(size=500)
X = np.c_[x, 0.5 * x + rng.normal(scale=0.3, size=500)]     # two correlated features

eigvals, eigvecs = np.linalg.eigh(np.cov(X, rowvar=False))  # by hand
print((eigvals[::-1] / eigvals.sum()).round(3))             # [0.954 0.046] ← share of variance per component

pca = PCA().fit(X)
print(pca.explained_variance_ratio_.round(3))              # [0.954 0.046] ← same
print(np.abs(pca.components_[0]).round(3))                 # [0.882 0.471] ← PC1 direction (sign is arbitrary)
```

# Scale first

PCA maximises variance, so a feature measured in large units dominates. On the wine data, proline (values in the hundreds to thousands) alone makes up almost all the “variance” until the features are standardised:

```python filename:Python
from sklearn.datasets import load_wine
from sklearn.decomposition import PCA
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

X, _ = load_wine(return_X_y=True)
print(PCA(n_components=3).fit(X).explained_variance_ratio_.round(3))   # [0.998 0.002 0.   ] ← PC1 is just proline
scaled = make_pipeline(StandardScaler(), PCA(n_components=3)).fit(X)
print(scaled[-1].explained_variance_ratio_.round(3))                   # [0.362 0.192 0.111] ← real structure
```

# How many components?

```python filename:Python
import numpy as np
from sklearn.datasets import load_digits
from sklearn.decomposition import PCA

X, _ = load_digits(return_X_y=True)                     # 64 pixel features
cum = np.cumsum(PCA().fit(X).explained_variance_ratio_)
print(int(np.argmax(cum >= 0.95)) + 1)                  # 29 ← components needed for 95% of the variance

pca = PCA(n_components=0.95).fit(X)                     # or ask for the fraction directly
X_back = pca.inverse_transform(pca.transform(X))
print(pca.n_components_, round(np.mean((X - X_back) ** 2), 2))   # 29 0.85 ← reconstruction error is small
```

Common rules: keep enough components for 90–99% of the variance, look for an elbow in the scree plot, or treat k as a hyperparameter and pick it by the downstream model's cross-validated score.

# Uses and caveats

| Use | Caveat |
| --- | --- |
| Visualise high-dimensional data in 2-D/3-D | Only linear structure; clusters may overlap in a linear projection |
| Compress, denoise, speed up downstream models | Fit PCA on the training split only (inside the `Pipeline`) |
| Remove multicollinearity (components are uncorrelated) | Components are mixtures of all features — harder to explain |
| Fight the curse of dimensionality | PCA ignores the target: a low-variance direction can be the predictive one |

Relatives: `TruncatedSVD` works on sparse matrices (text — “latent semantic analysis”); <strong>LDA</strong> (linear discriminant analysis) is supervised and finds directions that separate classes; `KernelPCA` handles non-linear structure.

# t-SNE and UMAP — for looking, not for modelling

|  | t-SNE | UMAP |
| --- | --- | --- |
| Preserves | Local neighbourhoods | Local neighbourhoods, somewhat more global structure |
| Key setting | `perplexity` (\~5–50) | `n_neighbors`, `min_dist` |
| Speed | Slow on large data | Faster |
| New points | No `transform` in scikit-learn — refit | Can transform new data |
| Where | `sklearn.manifold.TSNE` | `umap-learn` package |

> [!WARNING] Watch out
>
> In t-SNE/UMAP plots, cluster <strong>sizes</strong> and the <strong>distances between clusters</strong> are not meaningful, and results change with the random seed and hyperparameters. Use them to explore, not as features or as evidence that clusters exist.

```question
What does PCA do?

---

It rotates the (centred) data onto orthogonal axes ordered by how much variance they capture — the eigenvectors of the covariance matrix — and optionally drops the low-variance ones. The result is a lower-dimensional, uncorrelated representation that keeps as much variance as possible.
```

```question
Why must you scale data before PCA?

---

PCA maximises variance, and variance depends on units. Unscaled, the feature with the largest numeric range dominates the first components regardless of how informative it is. Standardising gives every feature an equal starting weight.
```

```question
PCA vs t-SNE?

---

PCA is linear, deterministic, fast, preserves global variance and can project new data — good for preprocessing. t-SNE is non-linear and stochastic, preserves local neighbourhoods for 2-D visualisation, distorts global distances and isn't used to transform new data for models.
```
