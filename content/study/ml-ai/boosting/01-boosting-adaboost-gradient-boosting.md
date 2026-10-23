---
id: 5803f25d-48e0-76b0-9f82-52590661a01b
key: topic:ml-ai/boosting
subject: ml-ai
topic: boosting
title: "Boosting: AdaBoost & Gradient Boosting"
slug: boosting-adaboost-gradient-boosting
order: 1
---

Boosting builds an ensemble <strong>sequentially</strong>: each new weak model concentrates on what the current ensemble gets wrong. It mainly <strong>reduces bias</strong>, and gradient-boosted trees (XGBoost, LightGBM, CatBoost, scikit-learn's HistGradientBoosting) are the go-to models for tabular data.

|  | Bagging / random forest | Boosting |
| --- | --- | --- |
| Training | Parallel, independent models | Sequential, each depends on the previous ones |
| Base learners | Deep, low-bias trees | Shallow, high-bias trees (stumps to depth \~8) |
| Mainly reduces | Variance | Bias (and some variance) |
| Overfits when adding learners? | No | <strong>Yes</strong> — control with learning rate and early stopping |
| Sensitivity to noisy labels | Robust | More sensitive (keeps chasing hard/mislabelled points) |

# AdaBoost

AdaBoost (labels ±1) re-weights the training rows after each round: misclassified rows gain weight, so the next weak learner focuses on them. Each learner gets a vote proportional to its accuracy:

`εₜ = weighted error of learner t αₜ = ½ · ln((1 − εₜ) / εₜ) wᵢ ← wᵢ · exp(−αₜ yᵢ hₜ(xᵢ)), then normalise F(x) = sign(Σₜ αₜ hₜ(x))`

```python filename:Python
import numpy as np
from sklearn.datasets import make_classification
from sklearn.ensemble import AdaBoostClassifier
from sklearn.model_selection import cross_val_score
from sklearn.tree import DecisionTreeClassifier

print([round(float(0.5 * np.log((1 - e) / e)), 3) for e in (0.1, 0.3, 0.5)])   # [1.099, 0.424, 0.0] ← a coin-flip learner (ε = 0.5) gets no vote

X, y = make_classification(n_samples=600, n_features=20, n_informative=6, random_state=1)
stump = DecisionTreeClassifier(max_depth=1)
print(round(cross_val_score(stump, X, y, cv=5).mean(), 3))                                    # 0.827 ← one stump
print(round(cross_val_score(AdaBoostClassifier(stump, n_estimators=200, random_state=0), X, y, cv=5).mean(), 3))   # 0.94
```

# Gradient boosting

`Fₘ(x) = Fₘ₋₁(x) + η · hₘ(x) hₘ is fitted to the negative gradient −∂L(y, F)/∂F at Fₘ₋₁`

Start from a constant (the mean for squared error), then repeatedly fit a small regression tree to the <strong>pseudo-residuals</strong> and add a shrunken copy of it (learning rate `η`). For squared-error loss the negative gradient is exactly the residual `y − F(x)`; for log-loss it is `y − p`. Other losses give other pseudo-residuals — that's what “gradient” boosting means.

```python filename:Python
import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.tree import DecisionTreeRegressor

rng = np.random.default_rng(0)
X = rng.uniform(0, 6, size=(200, 1))
y = np.sin(X[:, 0]) + rng.normal(0, 0.2, 200)

lr, F = 0.1, np.full(200, y.mean())                      # start from the mean
for m in range(100):
    residuals = y - F                                    # negative gradient of ½(y − F)²
    tree = DecisionTreeRegressor(max_depth=2, random_state=0).fit(X, residuals)
    F += lr * tree.predict(X)                            # add a shrunken copy of the tree
    if m in (0, 9, 99):
        print(m + 1, round(np.mean((y - F) ** 2), 4))

sk = GradientBoostingRegressor(n_estimators=100, learning_rate=0.1, max_depth=2, random_state=0).fit(X, y)
print(np.allclose(F, sk.predict(X)))                     # ← scikit-learn does the same thing
```

```text filename:Output
1 0.4458
10 0.1216
100 0.0268
True
```

# Learning rate, number of trees and early stopping

A smaller learning rate needs more trees but usually generalises better. Too many trees overfit — so hold out validation data and stop when it stops improving:

```python filename:Python
from sklearn.datasets import make_classification
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.model_selection import train_test_split

X, y = make_classification(n_samples=2000, n_features=20, n_informative=6, flip_y=0.1, random_state=0)
X_tr, X_te, y_tr, y_te = train_test_split(X, y, random_state=0)

full = HistGradientBoostingClassifier(learning_rate=0.3, max_iter=500, early_stopping=False, random_state=0).fit(X_tr, y_tr)
early = HistGradientBoostingClassifier(learning_rate=0.3, max_iter=500, early_stopping=True,
                                       validation_fraction=0.2, n_iter_no_change=10, random_state=0).fit(X_tr, y_tr)
print(full.n_iter_, round(full.score(X_tr, y_tr), 3), round(full.score(X_te, y_te), 3))     # 500 1.0 0.858 ← trees, train acc, test acc
print(early.n_iter_, round(early.score(X_tr, y_tr), 3), round(early.score(X_te, y_te), 3))  # 21 0.975 0.862 ← stopped early
```

# The modern libraries

| Library | Key ideas |
| --- | --- |
| scikit-learn `HistGradientBoosting*` | Bins features into ≤ 255 buckets for fast split finding (inspired by LightGBM); native missing-value and categorical support; built-in early stopping |
| XGBoost | Second-order (gradient + Hessian) updates; explicit regularisation of the tree (`lambda`, `alpha` on leaf weights, `gamma` per extra leaf); sparsity-aware splits; histogram method; GPU support |
| LightGBM | Histogram-based; <strong>leaf-wise</strong> growth (control with `num_leaves`); gradient-based one-side sampling (GOSS) and exclusive feature bundling (EFB) for speed |
| CatBoost | Ordered target statistics for categorical features and ordered boosting to avoid target leakage; symmetric (oblivious) trees; strong defaults |

| Hyperparameter | Typical range | Effect |
| --- | --- | --- |
| Learning rate (`eta`) | 0.01 – 0.3 | Smaller = more trees needed, usually better |
| Number of trees | 100s – 1000s (use early stopping) | Too many overfits |
| Tree depth / `num_leaves` | depth 3–8 / 15–255 leaves | Interaction order and capacity |
| Row / column subsampling | 0.5 – 1.0 | Adds randomness, reduces variance (stochastic gradient boosting) |
| `min_child_weight` / `min_samples_leaf` | Problem-dependent | Prevents tiny, noisy leaves |
| L1/L2 on leaf weights | 0 – 10 | Regularisation |

```question
What is the difference between bagging and boosting?

---

Bagging trains models independently on bootstrap samples and averages them — it reduces variance and doesn't overfit as models are added. Boosting trains models sequentially, each correcting the current ensemble's errors — it reduces bias, is usually more accurate on tabular data, but can overfit and needs a learning rate and early stopping.
```

```question
Why is it called gradient boosting?

---

Each new tree is fitted to the negative gradient of the loss with respect to the current predictions — gradient descent in function space. For squared error those are the ordinary residuals, but any differentiable loss (log-loss, Huber, quantile) works the same way.
```

```question
Why do gradient-boosted trees often beat neural networks on tabular data?

---

Tabular features are heterogeneous, often uninformative, and relationships have sharp thresholds; trees handle mixed scales, missing values and irregular functions naturally and need less data and tuning. Neural networks shine when there is spatial/sequential structure (images, text) or very large datasets.
```
