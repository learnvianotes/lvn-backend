---
id: ef20a91b-0702-712c-ad80-aa3651981d27
key: topic:ml-ai/feature-engineering
subject: ml-ai
topic: feature-engineering
title: Feature Engineering & Selection
slug: feature-engineering-selection
order: 1
---

Feature engineering creates inputs that make the pattern easier to learn; feature selection removes inputs that add noise, cost or leakage. On tabular data, good features usually beat a fancier algorithm.

# Engineering ideas

| Idea | Example |
| --- | --- |
| Ratios &amp; differences | `price_per_item = total / items`, `debt_to_income` |
| Aggregates over history | Purchases in the last 7 / 30 days, average basket size per user |
| Date &amp; time parts | Hour, weekday, month, is\_weekend, days since signup |
| Cyclical encoding | `sin(2π·hour/24)`, `cos(2π·hour/24)` so 23:00 is next to 00:00 |
| Binning | Age bands — can help linear models capture non-linear effects |
| Interactions &amp; polynomials | `area × quality`, `x²` for linear models (`PolynomialFeatures`) |
| Text | Length, keyword flags, TF-IDF (see <strong>Data Science</strong>) |
| Domain knowledge | BMI from height and weight; distance from coordinates |

```python filename:Python
import numpy as np
import pandas as pd

df = pd.DataFrame({
    "ts": pd.to_datetime(["2024-01-05 09:15", "2024-01-06 23:40", "2024-01-08 00:20"]),
    "total": [120.0, 80.0, 300.0],
    "items": [4, 1, 6],
})
df["hour"] = df["ts"].dt.hour
df["is_weekend"] = df["ts"].dt.dayofweek >= 5          # Monday = 0 … Sunday = 6
df["price_per_item"] = df["total"] / df["items"]
print(df[["hour", "is_weekend", "price_per_item"]].values.tolist())   # [[9, False, 30.0], [23, True, 80.0], [0, False, 50.0]]

angle = 2 * np.pi * df["hour"] / 24
pts = np.c_[np.sin(angle), np.cos(angle)]
print(abs(23 - 0), round(np.linalg.norm(pts[1] - pts[2]), 2))   # 23 0.26 ← raw gap vs cyclical distance
```

# Selecting features

| Family | How it works | scikit-learn | Trade-off |
| --- | --- | --- | --- |
| Filter | Score each feature against the target, independently of any model | `VarianceThreshold`, `SelectKBest(f_classif / chi2 / mutual_info_classif)` | Fast; misses interactions |
| Wrapper | Search subsets by repeatedly training a model | `RFE`, `RFECV`, `SequentialFeatureSelector` | Model-aware; expensive, can overfit the selection |
| Embedded | Selection happens during training | L1 (Lasso) coefficients, tree importances via `SelectFromModel` | Cheap; tied to one model's view |

```python filename:Python
import numpy as np
from sklearn.feature_selection import RFE, SelectFromModel, SelectKBest, f_classif
from sklearn.linear_model import LogisticRegression

rng = np.random.default_rng(0)
X = rng.normal(size=(400, 10))                                    # 10 features …
y = (2 * X[:, 0] - 1.5 * X[:, 1] + X[:, 2] + rng.normal(0, 0.5, 400) > 0).astype(int)   # … only 0, 1, 2 matter

print(SelectKBest(f_classif, k=3).fit(X, y).get_support(indices=True))                     # [0 1 2] ← filter
print(RFE(LogisticRegression(), n_features_to_select=3).fit(X, y).get_support(indices=True))    # [0 1 2] ← wrapper
l1 = LogisticRegression(l1_ratio=1, solver="liblinear", C=0.05)                            # L1 penalty
print(SelectFromModel(l1).fit(X, y).get_support(indices=True))                            # [0 1 2] ← embedded
```

> [!WARNING] Watch out
>
> Feature selection is part of training. Selecting features on the full dataset and <em>then</em> cross-validating produces badly optimistic scores — the <strong>Data Leakage</strong> topic demonstrates a model scoring far above chance on pure noise this way. Put the selector inside the `Pipeline`.

# Why bother selecting?

- Fewer irrelevant features → less overfitting, especially with few rows (see <strong>Curse of Dimensionality</strong> in the k-NN topic).
- Faster training and prediction; fewer data pipelines to maintain in production.
- Easier explanations.
- Removing features that are available in training but not at prediction time prevents leakage.

```question
Filter vs wrapper vs embedded feature selection?

---

Filters score features with a statistic (correlation, ANOVA F, mutual information) without training the final model — fast but blind to interactions. Wrappers (RFE, forward/backward selection) train models on candidate subsets — accurate but expensive and prone to overfitting the selection. Embedded methods select during training — Lasso zeroes coefficients, trees rank features by importance.
```

```question
How would you encode the hour of day?

---

As a categorical (one-hot, 24 columns) if each hour behaves differently, or cyclically with `sin(2π·h/24)` and `cos(2π·h/24)` so the model sees 23:00 and 00:00 as neighbours. Tree models can also use the raw hour directly, splitting it into ranges.
```
