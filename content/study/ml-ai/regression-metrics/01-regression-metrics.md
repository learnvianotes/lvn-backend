---
id: 9d128e0e-586b-79f7-8ece-c8174523ef7b
key: topic:ml-ai/regression-metrics
subject: ml-ai
topic: regression-metrics
title: Regression Metrics
slug: regression-metrics
order: 1
---

Regression metrics measure how far predictions are from the true values. They differ in how they punish large errors, in their units, and in what baseline they compare against.

| Metric | Formula | Units | Notes |
| --- | --- | --- | --- |
| MAE | `mean &#124;y − ŷ&#124;` | Target's | Every unit of error counts the same; less sensitive to outliers than MSE |
| MSE | `mean (y − ŷ)²` | Target's squared | Punishes large errors heavily; the usual training loss |
| RMSE | `√MSE` | Target's | Like MSE but interpretable; always ≥ MAE |
| R² | `1 − SS_res / SS_tot` | Unitless | Share of variance explained relative to predicting the mean |
| Adjusted R² | `1 − (1 − R²)(n − 1)/(n − p − 1)` | Unitless | Penalises extra predictors |
| MAPE | `mean &#124;y − ŷ&#124; / &#124;y&#124;` | % | Scale-free, but undefined at y = 0, explodes near 0, asymmetric |
| RMSLE | RMSE of `log(1 + y)` | ≈ relative | For targets spanning orders of magnitude; penalises under-prediction more |
| Median absolute error | `median &#124;y − ŷ&#124;` | Target's | Robust to a few huge errors |

`SS_res = Σ(yᵢ − ŷᵢ)² SS_tot = Σ(yᵢ − ȳ)² R² = 1 − SS_res / SS_tot`

```python filename:Python
import numpy as np
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score, root_mean_squared_error

y = np.array([100, 150, 200, 250, 300])
y_hat = np.array([110, 140, 210, 240, 380])            # one big miss

print(mean_absolute_error(y, y_hat), mean_squared_error(y, y_hat))    # 24.0 1360.0
print(round(root_mean_squared_error(y, y_hat), 2))                    # 36.88 ← pulled up by the 80 error
ss_res, ss_tot = np.sum((y - y_hat) ** 2), np.sum((y - y.mean()) ** 2)
print(round(1 - ss_res / ss_tot, 4), round(r2_score(y, y_hat), 4))    # 0.728 0.728
```

# R² can be negative

R² compares the model with always predicting the mean of the true values. A model worse than that baseline has R² &lt; 0 — common on a test set when a model has overfit or the data has drifted. R² = 1 is perfect; there is no lower bound.

```python filename:Python
import numpy as np
from sklearn.metrics import r2_score

y = np.array([3.0, 5.0, 7.0, 9.0])
print(r2_score(y, np.full(4, y.mean())))              # 0.0 ← predicting the mean
print(r2_score(y, np.array([9.0, 7.0, 5.0, 3.0])))    # -3.0 ← worse than the mean
```

# MAE vs RMSE, and the MAPE trap

```python filename:Python
import numpy as np
from sklearn.metrics import mean_absolute_error, mean_absolute_percentage_error, root_mean_squared_error

y = np.array([10.0, 10.0, 10.0, 10.0])
spread = np.array([12.0, 8.0, 12.0, 8.0])      # four errors of 2
one_big = np.array([10.0, 10.0, 10.0, 18.0])   # one error of 8
print(mean_absolute_error(y, spread), mean_absolute_error(y, one_big))            # 2.0 2.0 ← MAE: same
print(root_mean_squared_error(y, spread), root_mean_squared_error(y, one_big))    # 2.0 4.0 ← RMSE prefers spread-out errors

demand = np.array([0.5, 100.0])                 # a near-zero actual
print(round(mean_absolute_percentage_error(demand, np.array([1.5, 100.0])), 2))   # 1.0 ← off by 1 unit → 100% MAPE
```

| Choose | When |
| --- | --- |
| MAE | Errors cost proportionally; outliers shouldn't dominate; you want the median-type prediction |
| RMSE | Large errors are disproportionately bad; matches a squared-error training loss |
| R² | Communicating fit relative to a naive baseline (always report an error metric too) |
| MAPE / sMAPE / WAPE | Stakeholders think in percentages and actuals are far from 0 (WAPE = Σ\|e\| / Σ\|y\| is more stable) |
| RMSLE | Targets such as prices or counts spanning orders of magnitude |

```question
Can R² be negative?

---

Yes. R² = 1 − SS\_res/SS\_tot, and if the model's squared errors exceed those of predicting the mean of the true values, it is below 0. On training data with an intercept, OLS can't do worse than the mean, but on test data any model can.
```

```question
MAE or RMSE?

---

RMSE squares errors before averaging, so it penalises large errors more and is sensitive to outliers; MAE treats all errors linearly. Pick the one that matches the cost of errors in the business. RMSE ≥ MAE always; a large gap signals a few big errors.
```
