---
id: 280a4cde-b0cc-73e4-879a-980be5904f89
key: topic:ml-ai/cross-validation
subject: ml-ai
topic: cross-validation
title: Cross-Validation
slug: cross-validation
order: 1
---

Cross-validation (CV) rotates which part of the data is held out, so every row is used for both training and validation. It gives a more reliable estimate than a single split — especially on small datasets — plus a sense of its variability.

> [!INFO]
>
> <strong>k-fold cross-validation</strong> — split the training data into k folds; train k models, each on k−1 folds, and score each on the remaining fold. Report the mean (and standard deviation) of the k scores. Typical k: 5 or 10.

Fold 1 held out → Fold 2 held out → … → Fold k held out → Average the k scores

```python filename:Python
from sklearn.datasets import load_breast_cancer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold, cross_val_score, cross_validate
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

X, y = load_breast_cancer(return_X_y=True)
model = make_pipeline(StandardScaler(), LogisticRegression())      # scaler refit inside every fold

cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=0)
scores = cross_val_score(model, X, y, cv=cv, scoring="accuracy")
print(scores.round(3))                                   # [0.956 0.974 0.982 1.    0.982]
print(round(scores.mean(), 3), round(scores.std(), 3))   # 0.979 0.014

res = cross_validate(model, X, y, cv=cv, scoring=["accuracy", "roc_auc"], return_train_score=True)
print(round(res["train_accuracy"].mean(), 3), round(res["test_roc_auc"].mean(), 3))   # 0.988 0.995
```

> [!NOTE] Key point
>
> CV <strong>estimates</strong> how well a modelling <em>recipe</em> generalises; it doesn't produce a model. After choosing the recipe, refit it once on all the training data. And CV only reduces the variance of the estimate — with 50 rows, it is still noisy.

# Choosing the splitter

| Splitter | Use when |
| --- | --- |
| `KFold` | Regression, i.i.d. rows (use `shuffle=True` if rows are ordered) |
| `StratifiedKFold` | Classification — keeps class proportions in every fold (the default for classifiers when you pass `cv=5`) |
| `GroupKFold` / `StratifiedGroupKFold` | Several rows per patient/user/session — a group never appears on both sides |
| `TimeSeriesSplit` | Time-ordered data — always train on the past, validate on the future |
| `LeaveOneOut` | Very small datasets (n models; high-variance estimate, expensive) |
| `RepeatedStratifiedKFold` | Small data — repeat k-fold with different shuffles to stabilise the estimate |

# Group leakage in action

30 patients, 10 samples each. Every patient has a distinctive feature “signature”, and the label is a per-patient property unrelated to that signature — so there is nothing general to learn. Plain k-fold puts each patient's samples on both sides and k-NN simply recognises the patient:

```python filename:Python
import numpy as np
from sklearn.model_selection import GroupKFold, KFold, cross_val_score
from sklearn.neighbors import KNeighborsClassifier

rng = np.random.default_rng(0)
groups = np.repeat(np.arange(30), 10)                       # patient id of each row
signature = rng.normal(size=(30, 5))
X = signature[groups] + rng.normal(scale=0.1, size=(300, 5))
y = rng.integers(0, 2, size=30)[groups]                     # label depends only on who the patient is

model = KNeighborsClassifier(n_neighbors=3)
kfold = cross_val_score(model, X, y, cv=KFold(5, shuffle=True, random_state=0)).mean()
group = cross_val_score(model, X, y, cv=GroupKFold(n_splits=5), groups=groups).mean()
print(round(kfold, 2), round(group, 2))                     # 1.0 0.38 ← memorised patients vs honest (chance-level) estimate
```

# Time-series splits

```python filename:Python
import numpy as np
from sklearn.model_selection import TimeSeriesSplit

days = np.arange(10)                                        # rows already in time order
for train_idx, test_idx in TimeSeriesSplit(n_splits=3).split(days):
    print(train_idx.tolist(), "→", test_idx.tolist())
```

```text filename:Output
[0, 1, 2, 3] → [4, 5]
[0, 1, 2, 3, 4, 5] → [6, 7]
[0, 1, 2, 3, 4, 5, 6, 7] → [8, 9]
```

An expanding window: each fold trains on everything before the validation period. Use `gap=` to leave a buffer when labels take time to arrive, and `max_train_size=` for a sliding window.

# Nested cross-validation

If you tune hyperparameters with CV and report that same CV score, it is optimistically biased — you picked the best of many. <strong>Nested CV</strong> wraps the tuning (inner loop) inside an outer CV that only scores the whole tune-then-fit procedure:

```python filename:Python
from sklearn.datasets import load_breast_cancer
from sklearn.model_selection import GridSearchCV, cross_val_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC

X, y = load_breast_cancer(return_X_y=True)
inner = GridSearchCV(make_pipeline(StandardScaler(), SVC()), {"svc__C": [0.1, 1, 10]}, cv=3)
outer_scores = cross_val_score(inner, X, y, cv=5)          # each outer fold runs its own grid search
print(round(outer_scores.mean(), 3))                       # 0.974 ← estimate for "SVC tuned by grid search"
```

```question
Why use stratified k-fold for classification?

---

It keeps the class ratio the same in every fold. With imbalanced classes, plain k-fold can produce folds with very few (or zero) positives, making fold scores noisy or undefined (e.g. ROC-AUC needs both classes).
```

```question
How do you cross-validate a time-series model?

---

With forward-chaining splits (`TimeSeriesSplit`): train on data up to time t, validate on the period after t, move t forward. Never shuffle; build lag/rolling features from past values only; leave a gap if labels arrive late.
```

```question
What is nested cross-validation for?

---

An unbiased performance estimate when hyperparameters are tuned by CV. The inner loop selects hyperparameters; the outer loop evaluates the complete selection procedure on folds the inner loop never saw.
```
