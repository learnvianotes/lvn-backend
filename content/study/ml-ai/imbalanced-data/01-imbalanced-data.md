---
id: 53171874-f178-712d-8696-a8d8b4cc2cdb
key: topic:ml-ai/imbalanced-data
subject: ml-ai
topic: imbalanced-data
title: Imbalanced Data
slug: imbalanced-data
order: 1
---

When one class is rare (fraud 0.1%, disease 2%), a model can score high accuracy by ignoring it. Fix the <strong>evaluation</strong> first, then the <strong>decision threshold</strong>, and only then the training data or loss.

1. <strong>Measure the right thing</strong>

   Precision/recall, PR-AUC, recall at a fixed precision, expected cost — never accuracy alone.

2. <strong>Split carefully</strong>

   Stratified splits and stratified CV so every fold has positives.

3. <strong>Tune the threshold</strong>

   Often the single most effective step (see <strong>ROC, PR, Thresholds &amp; Calibration</strong>).

4. <strong>Re-weight the loss</strong>

   `class_weight="balanced"` or explicit weights make each positive count more.

5. <strong>Resample the training data</strong>

   Random over/under-sampling, SMOTE — inside the training folds only.

6. <strong>Get more positives</strong>

   More data, better labels, or reframe as anomaly detection when positives are extremely rare.

# Class weights

`balanced weight of class c = n_samples / (n_classes × n_c)`

```python filename:Python
from sklearn.datasets import make_classification
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, precision_score, recall_score
from sklearn.model_selection import train_test_split

X, y = make_classification(n_samples=10000, weights=[0.97], class_sep=1.5, flip_y=0, random_state=0)
X_tr, X_te, y_tr, y_te = train_test_split(X, y, stratify=y, random_state=0)

for cw in (None, "balanced"):
    m = LogisticRegression(class_weight=cw).fit(X_tr, y_tr)
    p = m.predict_proba(X_te)[:, 1]
    pred = m.predict(X_te)
    print(cw, round(precision_score(y_te, pred), 3), round(recall_score(y_te, pred), 3),
          round(average_precision_score(y_te, p), 3), round(p.mean(), 3))
```

```text filename:Output
None 0.824 0.56 0.725 0.03
balanced 0.263 0.947 0.713 0.141
```

Columns: precision, recall (at the default 0.5 threshold), PR-AUC, mean predicted probability (the true positive rate is 0.03). Class weights mainly move the <strong>effective threshold</strong>: recall rises, precision falls, while the ranking quality (PR-AUC) barely changes. Note the mean predicted probability — weighted models overestimate how often positives occur, so recalibrate if probabilities matter.

# Resampling

| Technique | How | Risk |
| --- | --- | --- |
| Random undersampling | Drop majority rows | Throws information away; fine when data is plentiful |
| Random oversampling | Duplicate minority rows | Overfitting to the duplicated rows |
| SMOTE | Synthesise minority points between a minority row and one of its minority neighbours: `x_new = xᵢ + λ(x_nn − xᵢ)`, `λ ~ U(0, 1)` | Can create points in overlapping/noisy regions; numeric features only (SMOTENC for categoricals) |

```python filename:Python
import numpy as np
from sklearn.neighbors import NearestNeighbors

rng = np.random.default_rng(0)
minority = np.array([[1.0, 1.0], [1.2, 0.9], [0.9, 1.3], [1.4, 1.2]])

def smote(X, n_new, k=2):
    nn = NearestNeighbors(n_neighbors=k + 1).fit(X)
    _, idx = nn.kneighbors(X)                     # idx[:, 0] is the point itself
    out = []
    for _ in range(n_new):
        i = rng.integers(len(X))
        j = idx[i, rng.integers(1, k + 1)]        # one of its k minority neighbours
        out.append(X[i] + rng.random() * (X[j] - X[i]))
    return np.array(out)

print(smote(minority, 3).round(3).tolist())   # [[1.292, 1.146], [1.197, 0.902], [0.909, 1.274]] ← new points on segments between minority neighbours
```

In practice use the `imbalanced-learn` package (`SMOTE`, `RandomUnderSampler`) and its `imblearn.pipeline.Pipeline`, which applies samplers during `fit` only.

> [!WARNING] Watch out
>
> Resample <strong>only the training data, inside each CV fold</strong>. Oversampling before the split copies (or interpolates) minority rows into the validation fold, so the model is tested on near-duplicates of its training rows — a classic leakage bug. Never resample the test set: it must keep the real class ratio.

Undersampling negatives inflates predicted probabilities. If negatives were kept with probability `β`, a score `pₛ` from the resampled model corresponds to the true-prior probability `p = β·pₛ / (β·pₛ − pₛ + 1)`.

```question
How do you handle a highly imbalanced classification problem?

---

Use metrics that focus on the rare class (PR-AUC, recall at a precision target, cost), stratified CV, and tune the decision threshold. Then try class weights or resampling within training folds, gather more positive examples, and consider anomaly detection if positives are extremely rare. Recalibrate probabilities if they're used downstream.
```

```question
Does SMOTE always help?

---

No. It often helps weak learners a little, but with strong models (gradient boosting) threshold tuning or class weights usually match it. It can hurt by generating minority points inside majority regions, and it distorts probabilities. Evaluate it with correctly nested CV against simple baselines.
```
