---
id: 2aee3e17-669b-723f-8a6e-57c76812cfea
key: topic:ml-ai/evaluation_metrics
subject: ml-ai
topic: evaluation_metrics
title: Classification Metrics
slug: classification-metrics
order: 1
---

Every classification metric is built from the four cells of the confusion matrix. Pick the one that reflects what errors <strong>cost</strong> in your problem — accuracy alone is rarely enough.

# The confusion matrix

|  | Predicted positive | Predicted negative |
| --- | --- | --- |
| <strong>Actual positive</strong> | True positive (TP) | False negative (FN) — Type II error, a miss |
| <strong>Actual negative</strong> | False positive (FP) — Type I error, a false alarm | True negative (TN) |

```python filename:Python
from sklearn.metrics import confusion_matrix

y_true = [1, 1, 1, 1, 0, 0, 0, 0, 0, 0]
y_pred = [1, 1, 1, 0, 1, 1, 0, 0, 0, 0]
cm = confusion_matrix(y_true, y_pred)
print(cm.tolist())                     # [[4, 2], [1, 3]] ← rows = actual, columns = predicted, labels sorted: 0 then 1
tn, fp, fn, tp = cm.ravel()
print(tp, fp, fn, tn)                  # 3 2 1 4
```

> [!WARNING] Watch out
>
> scikit-learn orders labels ascending, so for 0/1 labels the matrix is `[[TN, FP], [FN, TP]]` — negatives first, the opposite of most textbook diagrams. Unpack with `tn, fp, fn, tp = cm.ravel()`.

# The metrics

| Metric | Formula | Question it answers |
| --- | --- | --- |
| Accuracy | `(TP + TN) / all` | What fraction of predictions are right? |
| Precision | `TP / (TP + FP)` | When the model says positive, how often is it right? |
| Recall (sensitivity, TPR) | `TP / (TP + FN)` | What fraction of actual positives does it find? |
| Specificity (TNR) | `TN / (TN + FP)` | What fraction of actual negatives does it clear? |
| False positive rate | `FP / (FP + TN)` = 1 − specificity | How many negatives get a false alarm? |
| F1 | `2·P·R / (P + R)` | Harmonic mean of precision and recall |
| Fβ | `(1 + β²)·P·R / (β²·P + R)` | β &gt; 1 weights recall more; β &lt; 1 precision |
| Balanced accuracy | `(TPR + TNR) / 2` | Accuracy that isn't fooled by imbalance |
| MCC | `(TP·TN − FP·FN) / √((TP+FP)(TP+FN)(TN+FP)(TN+FN))` | Correlation between prediction and truth, −1 … 1 |
| Log-loss | `−mean[y·log p + (1 − y)·log(1 − p)]` | How good are the predicted <strong>probabilities</strong>? |

```python filename:Python
from sklearn.metrics import (accuracy_score, balanced_accuracy_score, f1_score, fbeta_score,
                             matthews_corrcoef, precision_score, recall_score)

y_true = [1, 1, 1, 1, 0, 0, 0, 0, 0, 0]
y_pred = [1, 1, 1, 0, 1, 1, 0, 0, 0, 0]        # TP=3, FN=1, FP=2, TN=4
print(accuracy_score(y_true, y_pred))                                         # 0.7 ← 7/10
print(precision_score(y_true, y_pred), recall_score(y_true, y_pred))          # 0.6 0.75 ← 3/5, 3/4
print(round(f1_score(y_true, y_pred), 3), round(fbeta_score(y_true, y_pred, beta=2), 3))   # 0.667 0.714
print(round(balanced_accuracy_score(y_true, y_pred), 3), round(matthews_corrcoef(y_true, y_pred), 3))   # 0.708 0.408
```

> [!NOTE] Key point
>
> Precision and recall pull against each other: raising the decision threshold usually increases precision and lowers recall. F1 is high only when <strong>both</strong> are high — the harmonic mean is dragged toward the smaller one.

# The accuracy paradox

```python filename:Python
import numpy as np
from sklearn.metrics import (accuracy_score, balanced_accuracy_score, f1_score,
                             matthews_corrcoef, recall_score)

y_true = np.array([1] * 10 + [0] * 990)       # 1% positives
y_pred = np.zeros(1000, dtype=int)            # a "model" that never predicts positive
print(accuracy_score(y_true, y_pred))                                        # 0.99 ← looks great
print(recall_score(y_true, y_pred), f1_score(y_true, y_pred, zero_division=0))  # 0.0 0.0 ← finds nothing
print(balanced_accuracy_score(y_true, y_pred), matthews_corrcoef(y_true, y_pred))  # 0.5 0.0 ← chance level
```

# Multi-class: averaging

| Average | How | Use when |
| --- | --- | --- |
| Macro | Compute the metric per class, then the plain mean | Every class matters equally (rare classes count as much as common ones) |
| Weighted | Per-class metric weighted by class support | Summarise overall performance, respecting class sizes |
| Micro | Pool all TP/FP/FN, then compute | Overall per-prediction performance; for single-label multi-class, micro-F1 = accuracy |

```python filename:Python
from sklearn.metrics import classification_report, f1_score

y_true = ["cat"] * 6 + ["dog"] * 3 + ["bird"] * 1
y_pred = ["cat"] * 5 + ["dog"] + ["dog", "dog", "cat"] + ["cat"]
print(classification_report(y_true, y_pred, zero_division=0))
print(round(f1_score(y_true, y_pred, average="micro"), 3),
      round(f1_score(y_true, y_pred, average="macro", zero_division=0), 3))
```

```text filename:Output
              precision    recall  f1-score   support

        bird       0.00      0.00      0.00         1
         cat       0.71      0.83      0.77         6
         dog       0.67      0.67      0.67         3

    accuracy                           0.70        10
   macro avg       0.46      0.50      0.48        10
weighted avg       0.63      0.70      0.66        10

0.7 0.479
```

The rare class “bird” is never predicted: macro-F1 exposes that, while accuracy and micro-F1 (both 0.7) hide it.

# Which metric?

| Situation | Prefer |
| --- | --- |
| Balanced classes, equal error costs | Accuracy (plus the confusion matrix) |
| False positives are expensive (spam filter, a costly intervention) | Precision (at a minimum recall) |
| False negatives are expensive (disease screening, fraud) | Recall (at a minimum precision), F2 |
| Imbalanced, need one threshold-free number | PR-AUC (average precision); also MCC at a chosen threshold |
| Ranking quality, roughly balanced | ROC-AUC |
| Probabilities will be used as probabilities | Log-loss, Brier score, calibration curve |
| Real costs known | Expected cost / profit at the chosen threshold |

```question
Explain precision and recall with an example.

---

A fraud model flags 100 transactions; 80 are really fraud → precision 0.8. There were 200 frauds in total; it caught 80 → recall 0.4. Precision is about the trustworthiness of alarms, recall about coverage of the positives.
```

```question
When is F1 a poor choice?

---

When error costs are very asymmetric (use Fβ or expected cost), when true negatives matter (F1 ignores them), when you care about probabilities rather than a single threshold, and when the positive class is not the one of interest — F1 depends on which class is labelled positive.
```

```question
What is the difference between macro and micro averaging?

---

Macro averages the per-class scores, so each class counts equally and poor performance on a rare class shows up. Micro pools all decisions before computing, so frequent classes dominate; for single-label multi-class problems micro-precision, micro-recall and micro-F1 all equal accuracy.
```
