---
id: 4eff00de-6975-7227-a4f9-d3e52d6e6c91
key: topic:ml-ai/data-leakage
subject: ml-ai
topic: data-leakage
title: Data Leakage
slug: data-leakage
order: 1
---

Leakage is when information that won't be available at prediction time sneaks into training or evaluation. It produces excellent offline scores and a model that fails in production — the most expensive bug in applied ML.

| Type | What happens | Example | Prevention |
| --- | --- | --- | --- |
| Target leakage | A feature is derived from the target or only known after the outcome | `refund_issued` used to predict fraud; `discharge_date` to predict admission | For every feature ask: <em>is it known at prediction time?</em> |
| Preprocessing leakage | Scalers, imputers, encoders, feature selection or resampling fitted on all rows before splitting | `StandardScaler().fit(X)` then `train_test_split`; SMOTE before cross-validation | Split first; fit every step inside a `Pipeline` |
| Duplicate / group leakage | The same entity appears in train and test | Several X-rays of one patient; near-duplicate product listings | Deduplicate; split by group (`GroupKFold`) |
| Temporal leakage | Training uses the future | Random split of time-series data; rolling features that include the current day's outcome | Split by time (`TimeSeriesSplit`); build features only from the past |
| Test-set reuse | Repeatedly tuning against the test set | Trying 50 models and reporting the best test score | Tune with validation/CV; use the test set once |

# Demo: 85% accuracy on pure noise

5,000 random features, random labels — there is nothing to learn, so the honest accuracy is about 50%. Selecting the 20 “best” features on <strong>all</strong> rows before cross-validation lets the selector peek at every fold's labels:

```python filename:Python
import numpy as np
from sklearn.feature_selection import SelectKBest, f_classif
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import cross_val_score
from sklearn.pipeline import make_pipeline

rng = np.random.default_rng(0)
X = rng.normal(size=(100, 5000))       # pure-noise features
y = rng.integers(0, 2, size=100)       # random labels

X_sel = SelectKBest(f_classif, k=20).fit_transform(X, y)          # ✗ selection saw all labels
leaky = cross_val_score(LogisticRegression(), X_sel, y, cv=5).mean()

pipe = make_pipeline(SelectKBest(f_classif, k=20), LogisticRegression())
honest = cross_val_score(pipe, X, y, cv=5).mean()                 # ✓ selection refit per training fold
print(round(leaky, 2), round(honest, 2))                          # 0.85 0.48
```

# Warning signs

- Scores that are too good for the problem (AUC 0.99 on a hard business problem).
- One feature dominates importance, especially one with a name like `status`, `outcome_*`, `*_after`.
- A big drop from offline validation to the first production week.
- Performance collapses when you switch from a random split to a time or group split.

> [!TIP] Do
>
> Split first (by time or group where it applies), wrap all preprocessing in a `Pipeline`, reconstruct features “as of” the prediction timestamp, and keep one untouched test set.

> [!DANGER] Avoid
>
> Cleaning, scaling, imputing, encoding, selecting or oversampling the full dataset before splitting.

```question
What is data leakage? Give examples.

---

Information unavailable at prediction time influencing training or evaluation. Examples: a feature computed from the label (target leakage), a scaler or feature selector fitted on the full data before the split, the same customer in train and test, random splits of time-series data, and tuning on the test set. All inflate offline scores.
```

```question
Your model gets 99% validation accuracy on a hard problem. What do you do?

---

Suspect leakage before celebrating: check the top features and whether each is known at prediction time, look for duplicates or shared entities across splits, confirm preprocessing is fitted inside the training folds, and re-evaluate with a time-based or group-based split.
```
