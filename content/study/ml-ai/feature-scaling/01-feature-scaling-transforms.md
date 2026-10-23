---
id: d4539eee-f693-766e-af14-4314104c7af5
key: topic:ml-ai/feature-scaling
subject: ml-ai
topic: feature-scaling
title: Feature Scaling & Transforms
slug: feature-scaling-transforms
order: 1
---

Scaling puts features on comparable ranges. It matters for models that use <strong>distances, dot products or gradient descent</strong>, and not at all for tree-based models.

| Scaler | Formula | Result | Use when |
| --- | --- | --- | --- |
| `StandardScaler` | `z = (x − mean) / std` | Mean 0, std 1 (unbounded) | Default for linear models, SVM, PCA, k-NN, neural nets |
| `MinMaxScaler` | `(x − min) / (max − min)` | Range \[0, 1\] | Bounded inputs needed (pixel values); no big outliers |
| `RobustScaler` | `(x − median) / IQR` | Median 0, IQR 1 | Outliers present |
| `MaxAbsScaler` | `x / max(&#124;x&#124;)` | Range \[−1, 1\], keeps zeros | Sparse data |
| `Normalizer` | Each <strong>row</strong> divided by its norm | Every row has length 1 | Text vectors / cosine similarity — not a per-feature scaler |

```python filename:Python
import numpy as np
from sklearn.preprocessing import MinMaxScaler, RobustScaler, StandardScaler

x = np.array([[1.0], [2.0], [3.0], [4.0], [100.0]])      # one outlier
print(StandardScaler().fit_transform(x).ravel().round(2))  # [-0.54 -0.51 -0.49 -0.46  2.  ]
print(MinMaxScaler().fit_transform(x).ravel().round(2))    # [0.   0.01 0.02 0.03 1.  ] ← normal values squashed near 0
print(RobustScaler().fit_transform(x).ravel().round(2))    # [-1.  -0.5  0.   0.5 48.5] ← normal values keep their spread
```

# Why it matters: k-NN on the wine data

Two of the 13 wine features (magnesium, proline) have far larger numbers than the rest, so they dominate Euclidean distance until everything is standardised:

```python filename:Python
from sklearn.datasets import load_wine
from sklearn.model_selection import cross_val_score
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

X, y = load_wine(return_X_y=True)
print(X.std(axis=0)[[4, 7, 12]].round(1).tolist())   # [14.2, 0.1, 314.0] ← magnesium, nonflavanoid phenols, proline

raw = cross_val_score(KNeighborsClassifier(), X, y, cv=5).mean()
scaled = cross_val_score(make_pipeline(StandardScaler(), KNeighborsClassifier()), X, y, cv=5).mean()
print(round(raw, 3), round(scaled, 3))           # 0.691 0.949
```

| Needs scaling | Doesn't need scaling |
| --- | --- |
| k-NN, k-means, SVM, PCA, linear/logistic regression <strong>with regularisation</strong>, anything trained by gradient descent (including neural nets) | Decision trees, random forests, gradient-boosted trees, Naive Bayes (each feature handled separately) |

# Fit on train, transform everything

```python filename:Python
import numpy as np
from sklearn.preprocessing import StandardScaler

X_train = np.array([[10.0], [20.0], [30.0]])
X_test = np.array([[40.0]])

scaler = StandardScaler().fit(X_train)            # learns mean 20 and std 8.165 from TRAIN
print(scaler.mean_, scaler.scale_.round(3))       # [20.] [8.165]
print(scaler.transform(X_test).round(3))          # [[2.449]] ← test uses the TRAIN statistics
```

> [!TIP] Do
>
> Fit the scaler on the training data (inside a `Pipeline` for cross-validation) and use `transform` on validation/test/production data.

> [!DANGER] Avoid
>
> `fit_transform` on the whole dataset before splitting, or re-fitting on the test set — both leak or shift information.

# Transforming skewed features

```python filename:Python
import numpy as np
from scipy.stats import skew
from sklearn.preprocessing import PowerTransformer

rng = np.random.default_rng(0)
income = rng.lognormal(mean=10, sigma=1, size=1000)       # right-skewed, like real incomes
print(round(skew(income), 2))                                             # 3.87
print(round(skew(np.log1p(income)), 2))                                   # -0.07 ← log: roughly symmetric
print(round(skew(PowerTransformer().fit_transform(income.reshape(-1, 1)).ravel()), 2))  # 0.0 ← Yeo-Johnson
```

> [!WARNING] Watch out
>
> Standardising changes the <strong>scale</strong>, not the <strong>shape</strong>: a skewed feature stays skewed with mean 0 and std 1. Use a log / Box-Cox / Yeo-Johnson transform (or `QuantileTransformer`) to change the shape.

```question
Normalization vs standardization?

---

Min-max normalization maps a feature to \[0, 1\] using its min and max — sensitive to outliers. Standardization subtracts the mean and divides by the standard deviation — unbounded, usually a safer default. Both are fitted on the training data. (Confusingly, sklearn's `Normalizer` does something else: it scales each <em>row</em> to unit length.)
```

```question
Does a random forest need feature scaling?

---

No. Trees split on thresholds of one feature at a time, and any monotonic rescaling leaves the ordering — and therefore the splits — unchanged.
```
