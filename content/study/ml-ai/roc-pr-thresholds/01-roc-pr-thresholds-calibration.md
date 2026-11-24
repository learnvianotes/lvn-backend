---
id: 93e17297-5c4b-7522-9cf8-0ecdc5a543ab
key: topic:ml-ai/roc-pr-thresholds
subject: ml-ai
topic: roc-pr-thresholds
title: ROC, PR, Thresholds & Calibration
slug: roc-pr-thresholds-calibration
order: 1
---

Most classifiers output a <strong>score</strong>; a threshold turns it into a decision. Curves summarise performance over every threshold, threshold tuning picks the operating point, and calibration makes the scores trustworthy probabilities.

# ROC curve and ROC-AUC

The ROC curve plots the <strong>true positive rate (recall)</strong> on the y-axis against the <strong>false positive rate</strong> on the x-axis as the threshold sweeps from high to low. The diagonal is a random classifier; the top-left corner is perfect.

> [!INFO]
>
> <strong>ROC-AUC</strong> — the area under the ROC curve = the probability that a randomly chosen positive gets a higher score than a randomly chosen negative. 1.0 = perfect ranking, 0.5 = random, below 0.5 = ranked backwards.

```python filename:Python
import numpy as np
from sklearn.metrics import roc_auc_score, roc_curve

y = np.array([0, 0, 1, 0, 1, 1, 0, 1])
score = np.array([0.1, 0.3, 0.35, 0.4, 0.6, 0.7, 0.8, 0.9])

pos, neg = score[y == 1], score[y == 0]
pairs = [(p > n) + 0.5 * (p == n) for p in pos for n in neg]
print(np.mean(pairs), roc_auc_score(y, score))       # 0.75 0.75 ← AUC = P(positive ranked above negative)

fpr, tpr, thr = roc_curve(y, score)
print(fpr.tolist())                                   # [0.0, 0.0, 0.25, 0.25, 0.5, 0.5, 1.0] ← x-axis
print(tpr.tolist())                                   # [0.0, 0.25, 0.25, 0.75, 0.75, 1.0, 1.0] ← y-axis
```

# Precision–recall curve

The PR curve plots <strong>precision</strong> (y) against <strong>recall</strong> (x). It ignores true negatives, so it reflects how many false alarms come with each level of recall. Its baseline is the <strong>positive-class prevalence</strong>: a random classifier has precision ≈ prevalence at every recall, and at recall = 1 (everything predicted positive) precision equals the prevalence — not 0. The area is summarised by <strong>average precision</strong> (AP ≈ PR-AUC).

```python filename:Python
from sklearn.datasets import make_classification
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, roc_auc_score
from sklearn.model_selection import train_test_split

X, y = make_classification(n_samples=20000, weights=[0.99], class_sep=1.2, flip_y=0, random_state=0)
X_tr, X_te, y_tr, y_te = train_test_split(X, y, stratify=y, random_state=0)
p = LogisticRegression().fit(X_tr, y_tr).predict_proba(X_te)[:, 1]

print(round(y_te.mean(), 4))                        # 0.01 ← prevalence = PR baseline
print(round(roc_auc_score(y_te, p), 3))             # 0.946 ← looks excellent
print(round(average_precision_score(y_te, p), 3))   # 0.587 ← the harder truth about the positives
```

> [!NOTE] Key point
>
> ROC-AUC isn't “wrong” on imbalanced data — TPR and FPR are each computed within one class, so it is insensitive to the class ratio. But a tiny FPR can still mean more false alarms than true hits when negatives outnumber positives 100:1. PR-AUC shows that directly.

|  | ROC-AUC | PR-AUC (average precision) |
| --- | --- | --- |
| Axes | TPR vs FPR | Precision vs recall |
| Random baseline | 0.5 | Prevalence |
| Uses true negatives | Yes | No |
| Best for | Ranking quality with reasonably balanced classes; comparing models across datasets | Rare positives where false alarms matter (fraud, retrieval) |

# Choosing the threshold

0.5 is only the right cut-off for calibrated probabilities with equal error costs. Choose the threshold on <strong>validation data</strong> (never the test set) from the business requirement — a minimum recall, a maximum alert volume, or the lowest expected cost:

```python filename:Python
import numpy as np
from sklearn.datasets import make_classification
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import precision_recall_curve, precision_score, recall_score
from sklearn.model_selection import train_test_split

X, y = make_classification(n_samples=4000, weights=[0.9], class_sep=0.8, random_state=1)
X_tr, X_val, y_tr, y_val = train_test_split(X, y, stratify=y, random_state=0)
p = LogisticRegression().fit(X_tr, y_tr).predict_proba(X_val)[:, 1]

for t in (0.3, 0.5, 0.7):
    pred = p >= t
    print(t, round(precision_score(y_val, pred), 3), round(recall_score(y_val, pred), 3))

prec, rec, thr = precision_recall_curve(y_val, p)
ok = rec[:-1] >= 0.8                          # requirement: catch at least 80% of positives
best = np.argmax(np.where(ok, prec[:-1], -1))  # … with the best precision
print("threshold", round(thr[best], 3), "precision", round(prec[best], 3), "recall", round(rec[best], 3))

cost_fn, cost_fp = 10, 1                      # a miss costs 10× a false alarm
costs = [cost_fn * np.sum((p < t) & (y_val == 1)) + cost_fp * np.sum((p >= t) & (y_val == 0)) for t in thr]
print("min-cost threshold", round(thr[int(np.argmin(costs))], 3))
```

```text filename:Output
0.3 0.938 0.892
0.5 0.977 0.824
0.7 0.987 0.735
threshold 0.449 precision 0.977 recall 0.843
min-cost threshold 0.154
```

scikit-learn can tune the threshold by cross-validation for you with `TunedThresholdClassifierCV(estimator, scoring=...)`, or fix one with `FixedThresholdClassifier`.

# Calibration

> [!INFO]
>
> <strong>Calibrated classifier</strong> — among all cases predicted with probability 0.8, about 80% are positive. Needed whenever the probability itself is used — expected-cost decisions, risk scores, combining models.

- Logistic regression is usually well calibrated. Naive Bayes is overconfident; SVM scores aren't probabilities; random forests are under-confident near 0 and 1; boosted trees vary.
- Oversampling or class weights shift predicted probabilities upward — recalibrate afterwards.
- Measure with a <strong>reliability diagram</strong> (`calibration_curve`), the <strong>Brier score</strong> `mean((p − y)²)` and log-loss.
- Fix with `CalibratedClassifierCV`: `method="sigmoid"` (Platt scaling, good for small data) or `"isotonic"` (more flexible, needs more data). It fits the calibrator on held-out folds.

```python filename:Python
from sklearn.calibration import CalibratedClassifierCV
from sklearn.datasets import make_classification
from sklearn.metrics import brier_score_loss, log_loss
from sklearn.model_selection import train_test_split
from sklearn.naive_bayes import GaussianNB

X, y = make_classification(n_samples=5000, n_features=20, n_informative=5, n_redundant=10, random_state=0)
X_tr, X_te, y_tr, y_te = train_test_split(X, y, random_state=0)

raw = GaussianNB().fit(X_tr, y_tr).predict_proba(X_te)[:, 1]
cal = CalibratedClassifierCV(GaussianNB(), method="isotonic", cv=5).fit(X_tr, y_tr).predict_proba(X_te)[:, 1]
print(round(brier_score_loss(y_te, raw), 4), round(brier_score_loss(y_te, cal), 4))   # 0.1217 0.1074 ← lower is better
print(round(log_loss(y_te, raw), 3), round(log_loss(y_te, cal), 3))                   # 0.612 0.351 ← NB's overconfidence punished
```

```question
ROC-AUC or PR-AUC for a fraud model with 0.1% positives?

---

PR-AUC (average precision). With so few positives, ROC-AUC can be very high while most alerts are still false alarms, because FPR divides by the huge number of negatives. PR-AUC's baseline is the prevalence (0.001), and it directly reflects alert precision at each recall level.
```

```question
What does an AUC of 0.5 mean? And 0.3?

---

0.5: the scores rank positives above negatives no better than chance. 0.3: the ranking is systematically backwards — flipping the scores would give 0.7, which usually indicates a label or sign bug.
```

```question
How do you pick a classification threshold?

---

On a validation set, from the business constraint: maximise expected profit/minimise expected cost given the cost of FP and FN, hit a required recall or precision, or match a capacity limit (top k alerts per day). Re-check it when base rates drift.
```
