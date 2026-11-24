---
id: b2c62f90-18d1-7c1f-8a14-fd484225ad91
key: topic:ml-ai/random-forests
subject: ml-ai
topic: random-forests
title: Bagging & Random Forests
slug: bagging-random-forests
order: 1
---

Averaging many high-variance models cancels much of their variance. <strong>Bagging</strong> trains each model on a bootstrap sample; a <strong>random forest</strong> also restricts each split to a random subset of features so the trees are less alike.

# Why averaging works

`Var(average of B models) = ρσ² + (1 − ρ)σ² / B σ² = variance of one model, ρ = correlation between models`

More trees shrink the second term toward 0 but the first stays: highly correlated trees can't cancel each other's errors. Random feature subsets lower `ρ` — that is the whole idea of a random forest. Bagging mainly <strong>reduces variance</strong>; it does little for bias, so it suits deep, low-bias trees.

# Bootstrap samples and out-of-bag rows

A bootstrap sample draws n rows <strong>with replacement</strong>. Each row is left out with probability `(1 − 1/n)ⁿ → 1/e ≈ 0.368`, so each tree sees about 63.2% of the distinct rows. The unseen \~36.8% are that tree's <strong>out-of-bag (OOB)</strong> rows — a free validation set.

```python filename:Python
import numpy as np

n = 1000
print(round(1 - (1 - 1 / n) ** n, 4))                   # 0.6323 ← expected share of distinct rows
rng = np.random.default_rng(0)
sample = rng.integers(0, n, size=n)                     # one bootstrap sample
print(len(np.unique(sample)) / n)                       # 0.622
```

# One tree vs bagging vs random forest

```python filename:Python
from sklearn.datasets import make_classification
from sklearn.ensemble import BaggingClassifier, RandomForestClassifier
from sklearn.model_selection import cross_val_score
from sklearn.tree import DecisionTreeClassifier

X, y = make_classification(n_samples=600, n_features=20, n_informative=6, random_state=1)
models = {
    "tree": DecisionTreeClassifier(random_state=0),
    "bagging": BaggingClassifier(DecisionTreeClassifier(), n_estimators=100, random_state=0),
    "forest": RandomForestClassifier(n_estimators=100, random_state=0),
}
print({name: round(float(cross_val_score(m, X, y, cv=5).mean()), 3) for name, m in models.items()})   # {'tree': 0.892, 'bagging': 0.923, 'forest': 0.937}

rf = RandomForestClassifier(n_estimators=200, oob_score=True, random_state=0).fit(X, y)
print(round(rf.oob_score_, 3))                          # 0.938 ← OOB accuracy: close to the CV estimate
```

# Key hyperparameters

| Parameter | Meaning | Guidance |
| --- | --- | --- |
| `n_estimators` | Number of trees | More never overfits — it only stops improving; a few hundred is typical |
| `max_features` | Features considered at each split | `"sqrt"` (classifier default); lower → less correlated trees. Note `RandomForestRegressor` defaults to `1.0` (all features = plain bagging) |
| `max_depth`, `min_samples_leaf` | Tree size | Defaults grow full trees; limit them on noisy data |
| `class_weight` | Weights for imbalanced classes | `"balanced"` or `"balanced_subsample"` |
| `n_jobs` | Parallel training | Trees are independent — bagging parallelises perfectly |

> [!WARNING] Watch out
>
> `feature_importances_` (mean decrease in impurity) is computed on training data and is biased toward continuous and high-cardinality features. Prefer permutation importance on held-out data (see <strong>Explainability</strong>).

> [!TIP] Do
>
> Use as a strong, low-effort default for tabular data: little tuning, no scaling, robust to outliers, OOB estimate included.

> [!DANGER] Avoid
>
> Expect it to extrapolate beyond the training range, to be small or fast at prediction time with thousands of deep trees, or to be as interpretable as one tree. `ExtraTreesClassifier` (random thresholds too) is a faster, even more randomised cousin.

```question
Why does a random forest generalise better than a single decision tree?

---

Each deep tree has low bias but high variance. Averaging many trees trained on bootstrap samples, with a random subset of features at each split to decorrelate them, cancels much of that variance while keeping the bias low.
```

```question
What is the out-of-bag score?

---

Each tree skips \~37% of the rows in its bootstrap sample. Predicting each row using only the trees that didn't see it gives an almost free validation estimate, similar to cross-validation.
```

```question
Can adding more trees to a random forest overfit?

---

No — adding trees only reduces the variance of the average; the error converges to a limit. The forest can still overfit through its individual trees (too deep on noisy data), which is controlled with depth/leaf-size settings.
```
