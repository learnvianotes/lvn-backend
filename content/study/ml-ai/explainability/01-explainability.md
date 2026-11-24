---
id: d8080f63-ff1a-7754-91bb-36b945204c93
key: topic:ml-ai/explainability
subject: ml-ai
topic: explainability
title: Explainability
slug: explainability
order: 1
---

Explainability answers <em>why</em> a model predicts what it does — globally (which features drive the model) and locally (why this one prediction). It builds trust, finds bugs and leakage, and is required in regulated decisions.

| Method | Scope | Idea | Caveats |
| --- | --- | --- | --- |
| Interpretable model (linear, small tree) | Global + local | The model <em>is</em> the explanation | Coefficients need comparable scales; correlated features muddle them |
| Impurity importance (MDI) | Global | Total impurity decrease from a feature's splits | Training-data based; biased toward continuous/high-cardinality features |
| Permutation importance | Global | Score drop when a feature's values are shuffled | Correlated features share/hide importance; shuffling creates unrealistic rows |
| Partial dependence (PDP) / ICE | Global / per row | Average prediction as one feature varies | Averages can hide interactions; assumes feature independence |
| SHAP | Local (aggregates to global) | Shapley-value attribution of each feature's contribution | Costly for general models; depends on the background data; not causal |
| LIME | Local | Fit a simple surrogate model on perturbed samples around one row | Unstable across runs; depends on the perturbation scheme |
| Counterfactuals | Local | Smallest input change that flips the decision | May suggest changes that aren't actionable |

# Permutation vs impurity importance

Five generated features (0–2 informative, 3–4 pure noise), plus a random continuous column (5) and a random 3-level category (6). Labels are noisy, so the forest's deep trees happily split on noise:

```python filename:Python
import numpy as np
from sklearn.datasets import make_classification
from sklearn.ensemble import RandomForestClassifier
from sklearn.inspection import permutation_importance
from sklearn.model_selection import train_test_split

X, y = make_classification(n_samples=1000, n_features=5, n_informative=3, n_redundant=0,
                           flip_y=0.15, shuffle=False, random_state=0)   # informative = 0, 1, 2
rng = np.random.default_rng(0)
X = np.c_[X, rng.normal(size=len(X)), rng.integers(0, 3, len(X))]  # 5: random numbers, 6: random category
X_tr, X_te, y_tr, y_te = train_test_split(X, y, stratify=y, random_state=0)

rf = RandomForestClassifier(n_estimators=200, random_state=0).fit(X_tr, y_tr)
perm = permutation_importance(rf, X_te, y_te, n_repeats=10, random_state=0)
print(rf.feature_importances_.round(3).tolist())       # [0.21, 0.267, 0.206, 0.1, 0.1, 0.092, 0.025] ← MDI: noise columns 3–5 get ~0.1 each
print(perm.importances_mean.round(3).tolist())         # [0.162, 0.228, 0.184, -0.002, -0.004, 0.003, 0.001] ← permutation on test data: noise ≈ 0
```

Impurity importance hands the continuous noise column almost half the credit of a real feature — and much more than the equally useless 3-level category, because a feature with many distinct values offers many candidate splits. Permutation importance on held-out data correctly gives all noise columns about zero.

# Partial dependence

```python filename:Python
import numpy as np
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.inspection import partial_dependence

rng = np.random.default_rng(0)
X = rng.uniform(-3, 3, size=(2000, 2))
y = X[:, 0] ** 2 + 0.5 * X[:, 1] + rng.normal(0, 0.3, 2000)      # U-shape in x0, linear in x1
model = HistGradientBoostingRegressor(random_state=0).fit(X, y)

pd0 = partial_dependence(model, X, features=[0], grid_resolution=5)
print(pd0["grid_values"][0].round(1).tolist())         # [-2.7, -1.4, -0.0, 1.3, 2.7]
print(pd0["average"][0].round(1).tolist())             # [4.5, -1.1, -3.0, -1.3, 4.1] ← recovers the U-shape
```

# SHAP in one idea

SHAP treats features as players in a cooperative game whose payout is the prediction. A feature's <strong>Shapley value</strong> is its average marginal contribution over all orders in which features could be added. Key property (<em>efficiency</em>): the contributions add up exactly to `prediction − baseline` (the average prediction). Other properties: symmetric features get equal credit; a feature that never changes the output gets 0.

`f(x) = φ₀ + Σⱼ φⱼ φ₀ = E[f(X)] linear model, independent features: φⱼ = wⱼ · (xⱼ − E[xⱼ])`

```python filename:Python
import numpy as np
from sklearn.linear_model import LinearRegression

rng = np.random.default_rng(0)
X = rng.normal(size=(500, 3))
y = 3 * X[:, 0] - 2 * X[:, 1] + 0.5 * X[:, 2] + rng.normal(0, 0.1, 500)
m = LinearRegression().fit(X, y)

x = X[0]
phi = m.coef_ * (x - X.mean(axis=0))                   # exact SHAP values for a linear model
base = m.predict(X).mean()
print(phi.round(3).tolist())                           # [0.755, 0.424, 0.324] ← each feature's push away from the average
print(round(base + phi.sum(), 4), round(m.predict([x])[0], 4))   # 0.9597 0.9597 ← baseline + contributions = prediction
```

The `shap` package computes these for any model — exactly and quickly for tree ensembles (TreeSHAP), approximately for others (KernelSHAP) — and draws summary, dependence and waterfall plots.

> [!WARNING] Watch out
>
> Explanations describe the <strong>model</strong>, not the world: a large SHAP value means the model relies on the feature, not that changing the feature would change the outcome. With correlated features, credit is split in ways that depend on the method.

```question
What is the difference between interpretability and explainability?

---

Interpretability usually means the model is understandable by design (linear model, small tree). Explainability means post-hoc techniques (permutation importance, PDP, SHAP, LIME, counterfactuals) that explain a model that may be a black box.
```

```question
Why prefer permutation importance over a random forest's feature\_importances\_?

---

Impurity-based importance is computed on training data and inflates features with many possible split points (continuous or high-cardinality), even pure noise. Permutation importance measures the actual drop in a held-out score when a feature is scrambled, so irrelevant features score about zero.
```

```question
How does SHAP work?

---

It assigns each feature its Shapley value — the average change in the prediction when that feature is added, over all possible orders of adding features, relative to a background expectation. The values are additive (they sum to prediction minus the baseline), consistent and fair in the game-theoretic sense; TreeSHAP computes them exactly for tree models.
```
