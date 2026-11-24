---
id: e7dddb06-9952-7291-8179-31c2f34b8611
key: topic:ml-ai/common_pitfalls
subject: ml-ai
topic: common_pitfalls
title: Common Pitfalls
slug: common-pitfalls
order: 1
---

Most ML failures are process bugs, not algorithm choices. This checklist collects the classic ones with their symptoms and fixes.

| Pitfall | Symptom | Fix |
| --- | --- | --- |
| Data leakage | Offline scores too good; collapse in production | Split first, `Pipeline`, check feature availability at prediction time (see <strong>Data Leakage</strong>) |
| Duplicates / same entity across splits | Near-perfect validation scores | Deduplicate; group splits |
| Random split of time-ordered data | Production worse than validation | Time-based split / `TimeSeriesSplit` |
| Accuracy on imbalanced data | High accuracy, useless model | PR-AUC, recall/precision, cost; baseline comparison |
| No baseline | Can't tell if the model adds value | Dummy model + existing rule |
| Tuning on the test set | Test score optimistic; disappointment later | Validation/CV for all choices; nested CV |
| Overfitting the validation set | Many experiments, tiny “wins” that don't replicate | Larger validation set, repeated CV, report variance |
| Preprocessing fitted on all data | Slightly-to-very optimistic scores | Fit scalers/encoders/imputers/selectors inside CV |
| Training–serving skew | Same input, different prediction online vs offline | One shared feature pipeline; log production features and compare |
| Distribution shift | Slow decay after launch | Monitor inputs/outputs, retrain (see <strong>Deployment, Monitoring &amp; MLOps</strong>) |
| Spurious correlations (shortcut learning) | Great on validation, fails on new sources | Error analysis, explainability, test on data from other sources/times |
| Selection / sampling bias | Model fails on groups under-represented in training | Fix collection; slice metrics |
| Label noise | Plateaued accuracy; confident “errors” that are right | Audit labels, agreement metrics, clean the test set |
| Unscaled features for distance/regularised models | k-NN/SVM/Lasso behave oddly | Scale inside the pipeline |
| Single run, no uncertainty | Improvements within noise | CV mean ± std, confidence intervals, significance tests |
| Deep learning on small tabular data | Hours of tuning, worse than a forest | Start with linear models and gradient boosting |

# Demo: duplicates across the split

Random labels — nothing to learn — but each row appears three times. A random split puts copies of test rows into training, and a 1-nearest-neighbour model “recognises” them:

```python filename:Python
import numpy as np
from sklearn.model_selection import GroupShuffleSplit, train_test_split
from sklearn.neighbors import KNeighborsClassifier

rng = np.random.default_rng(0)
X0 = rng.normal(size=(300, 5))
y0 = rng.integers(0, 2, size=300)                  # random labels
X, y = np.repeat(X0, 3, axis=0), np.repeat(y0, 3)  # every row duplicated 3×
row_id = np.repeat(np.arange(300), 3)

X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.3, random_state=0)
print(round(KNeighborsClassifier(1).fit(X_tr, y_tr).score(X_te, y_te), 2))   # 0.97 ← "learned" noise

tr, te = next(GroupShuffleSplit(test_size=0.3, random_state=0).split(X, y, groups=row_id))
print(round(KNeighborsClassifier(1).fit(X[tr], y[tr]).score(X[te], y[te]), 2))   # 0.53 ← honest: chance level
```

# Before you trust a result

1. Is there a baseline, and does the model clearly beat it?
2. Was the split done first, and by time/group where needed?
3. Is every feature available at prediction time?
4. Is all preprocessing inside the pipeline?
5. Is the metric the one the business cares about, at the threshold that will be used?
6. Is the improvement larger than the run-to-run variance?
7. Has the test set been used only once?

```question
What are the most common mistakes in ML projects?

---

Leakage (target leakage, preprocessing before splitting, duplicates or groups across splits, random splits of time series), evaluating with the wrong metric (accuracy on imbalanced data), no baseline, tuning on the test set, and ignoring training–serving skew and drift after deployment.
```

```question
A model does great offline but poorly in production. What could be wrong?

---

Leakage in offline evaluation, training–serving skew (features computed differently online), distribution or concept drift since the training data, a different population in production (selection bias), or a threshold chosen for a different base rate. Compare logged production features and predictions with the training data to find out which.
```
