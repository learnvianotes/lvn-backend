---
id: b32fe18f-eb78-7b5b-9a01-4d8b177f58a3
key: topic:ml-ai/error_analysis
subject: ml-ai
topic: error_analysis
title: Error Analysis
slug: error-analysis
order: 1
---

Aggregate metrics say <em>how much</em> a model is wrong; error analysis finds <em>where</em> and <em>why</em>, so the next hour of work goes to the change that helps most.

# First: which kind of error?

| Compare | Gap means | Typical fixes |
| --- | --- | --- |
| Human-level (≈ Bayes) error → training error | <strong>Avoidable bias</strong> | Bigger/more flexible model, better features, train longer, less regularisation |
| Training → validation error | <strong>Variance</strong> (overfitting) | More data, regularisation, simpler model, augmentation |
| Validation on training-like data → validation on target data | <strong>Data mismatch</strong> | Collect data like production, re-weight, domain features |
| Validation → test error | <strong>Overfitting the validation set</strong> (too many experiments) | Bigger/fresh validation set, fewer comparisons |

> [!TIP] Example
>
> Human error 1%, training 8%, validation 10% → avoidable bias 7 points dominates variance 2 points: work on the model's capacity or features, not on regularisation.

# The procedure

1. <strong>Collect the errors</strong>

   Take \~100 misclassified validation examples (or the worst regression residuals). Also look at the most <strong>confidently</strong> wrong ones.

2. <strong>Tag them</strong>

   Read each one and tag the apparent cause: blurry image, sarcasm, missing feature, rare category, <strong>label error</strong>…

3. <strong>Count</strong>

   A spreadsheet of tag frequencies shows where the errors concentrate.

4. <strong>Prioritise</strong>

   Expected gain ≈ share of errors in the category × how fixable it is. Fixing 5% of errors can at most gain 5% of the error rate — the <em>ceiling</em>.

5. <strong>Act and repeat</strong>

   Targeted data collection, features, relabelling or a separate model for a segment; then re-measure.

# Slice the metrics

An overall score can hide a segment where the model fails. Compute metrics per slice — country, device, new vs returning users, time period:

```python filename:Python
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression

rng = np.random.default_rng(0)
n = 3000
segment = rng.choice(["returning", "new"], size=n, p=[0.85, 0.15])
x = rng.normal(size=(n, 3))
logit = 2 * x[:, 0] - x[:, 1]
logit[segment == "new"] = 2 * x[segment == "new", 2]     # new users behave differently
y = (rng.random(n) < 1 / (1 + np.exp(-logit))).astype(int)

model = LogisticRegression().fit(x[:2000], y[:2000])
test = pd.DataFrame({"segment": segment[2000:], "correct": model.predict(x[2000:]) == y[2000:]})
print(round(test["correct"].mean(), 3))
print(test.groupby("segment")["correct"].agg(["mean", "size"]).round(3))
```

```text filename:Output
0.778
            mean  size
segment
new        0.541   146
returning  0.819   854
```

The overall accuracy looks acceptable, yet for new users the model is barely better than a coin flip — invisible without slicing. Slicing is also the basis of <strong>fairness</strong> audits (see <strong>Fairness, Privacy &amp; Responsible AI</strong>).

# Which classes get confused?

```python filename:Python
import numpy as np
from sklearn.datasets import load_digits
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import confusion_matrix
from sklearn.model_selection import cross_val_predict
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

X, y = load_digits(return_X_y=True)
pred = cross_val_predict(make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000)), X, y, cv=5)
cm = confusion_matrix(y, pred)
np.fill_diagonal(cm, 0)                                   # keep only the mistakes
top = np.dstack(np.unravel_index(np.argsort(cm.ravel())[::-1][:3], cm.shape))[0]
print([(int(a), int(b), int(cm[a, b])) for a, b in top])  # [(8, 1, 13), (3, 8, 12), (7, 9, 12)] ← (true, predicted, count): most frequent confusions
```

`cross_val_predict` gives every row an out-of-fold prediction — ideal for error analysis without touching the test set.

# Checklist

- Are some “errors” actually <strong>label mistakes</strong>? Confidently wrong predictions often are — fix labels in the evaluation set first.
- Do errors cluster in a slice, a time period or a data source (a new app version, one sensor)?
- Is there a feature the model would need but doesn't have?
- Are errors near the decision threshold (threshold/calibration issue) or far from it (model/data issue)?

```question
Your model's accuracy is 85%. How do you decide what to improve?

---

Compare training, validation and (if available) human-level error to see whether bias or variance dominates. Then do error analysis: sample misclassified validation examples, tag causes, count them, and estimate the ceiling gain per category; slice metrics by key segments. Work on the largest, most fixable source first.
```

```question
What is slice-based evaluation?

---

Computing metrics separately for meaningful subgroups (region, device, demographic, data source). It reveals failures hidden by the average and is required for fairness and reliability checks before deployment.
```
