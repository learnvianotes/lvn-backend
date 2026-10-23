---
id: ffd15854-7df6-77f6-a9d9-c6055873063d
key: topic:ml-ai/missing-values-outliers
subject: ml-ai
topic: missing-values-outliers
title: Missing Values & Outliers
slug: missing-values-outliers
order: 1
---

Real data has gaps and extreme values. Handle them deliberately: understand <strong>why</strong> a value is missing or extreme, then choose a strategy — and fit that strategy on the training data only.

# Why values go missing

| Mechanism | Meaning | Example | Consequence |
| --- | --- | --- | --- |
| MCAR — missing completely at random | Missingness unrelated to anything | A sensor randomly drops packets | Dropping rows loses data but doesn't bias |
| MAR — missing at random | Depends on <em>observed</em> columns | Older users skip the income question more often | Impute using the other columns |
| MNAR — missing not at random | Depends on the missing value itself | High earners hide their income | Missingness is informative — add an indicator |

# Strategies

| Strategy | When | Caveat |
| --- | --- | --- |
| Drop rows | Few rows affected, MCAR | Throws data away; can bias if not MCAR |
| Drop column | Mostly empty <em>and</em> uninformative | Check first whether missingness predicts the target |
| Mean / median / most-frequent / constant | Quick baseline (`SimpleImputer`) | Shrinks variance; median is robust to outliers |
| Missing-indicator column | Missingness may carry signal | `add_indicator=True` |
| KNN / iterative imputation | Features are related to each other | Slower; still fit on train only |
| Native support | `HistGradientBoosting*`, scikit-learn trees (≥ 1.3), XGBoost, LightGBM | The model learns where missing values should go |

```python filename:Python
import numpy as np
from sklearn.impute import KNNImputer, SimpleImputer

X_train = np.array([[1.0, 10.0], [2.0, np.nan], [np.nan, 30.0], [4.0, 40.0]])
X_test = np.array([[np.nan, np.nan]])

imp = SimpleImputer(strategy="median", add_indicator=True).fit(X_train)
print(imp.statistics_)                   # [ 2. 30.] ← medians learned from TRAIN only
print(imp.transform(X_test))             # [[ 2. 30.  1.  1.]] ← filled values + one indicator per column with gaps

knn = KNNImputer(n_neighbors=2).fit(X_train)
print(knn.transform([[2.0, np.nan]]))    # [[ 2. 25.]] ← mean of column 2 over the 2 nearest rows (x = 1 and x = 4)
```

> [!WARNING] Watch out
>
> Computing the imputation value on the full dataset before splitting leaks test information into training. Put imputers inside a `Pipeline` so each cross-validation fold fits its own.

# Outliers: detect

`IQR rule: outlier if x < Q1 − 1.5·IQR or x > Q3 + 1.5·IQR z-score rule: |x − mean| / std > 3`

```python filename:Python
import numpy as np

x = np.array([12, 14, 13, 15, 14, 13, 16, 14, 95])
q1, q3 = np.percentile(x, [25, 75])
lo, hi = q1 - 1.5 * (q3 - q1), q3 + 1.5 * (q3 - q1)
print(q1, q3, lo, hi)                      # 13.0 15.0 10.0 18.0
print(x[(x < lo) | (x > hi)])              # [95] ← IQR flags the 95

z = (x - x.mean()) / x.std()
print(round(z.max(), 2))                   # 2.83 ← below 3: the outlier inflates the std and hides itself
print(np.clip(x, lo, hi))                  # [12. 14. 13. 15. 14. 13. 16. 14. 18.] ← capping (winsorising) instead of deleting
```

The z-score rule assumes roughly normal data and is distorted by the very outliers it looks for (<strong>masking</strong>); median/IQR-based rules are more robust. For many features at once use a model-based detector such as Isolation Forest (see <strong>Anomaly Detection</strong>).

# Outliers: decide

| Kind of outlier | Action |
| --- | --- |
| Data error (age 250, negative price) | Fix or set to missing |
| Real but rare (a genuine 250k salary) | Keep; reduce its leverage with a log transform, capping, or a robust model/loss |
| The thing you want to find (fraud) | Definitely keep — it's the signal |

- Tree-based models split on thresholds, so extreme feature values barely affect them.
- Linear models, k-NN, k-means and anything using means or squared errors are sensitive to them.
- Robust choices: median instead of mean, `RobustScaler`, MAE or Huber loss instead of MSE.

```question
Mean or median imputation?

---

Median for skewed features or when outliers are present — the mean is pulled toward extreme values. Either way, add a missing indicator when missingness may carry information, and compare against a model that handles NaN natively.
```

```question
Should you remove outliers?

---

Only if they are errors. Real extreme values are information — removing them makes the model overconfident on exactly the cases that matter. Prefer transformation, capping or robust methods, and never remove outliers from the test set to make scores look better.
```
