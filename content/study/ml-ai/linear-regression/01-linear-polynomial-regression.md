---
id: 3f2653de-79ec-7df9-bfe5-0da67cafc6db
key: topic:ml-ai/linear-regression
subject: ml-ai
topic: linear-regression
title: Linear & Polynomial Regression
slug: linear-polynomial-regression
order: 1
---

Linear regression predicts a number as a weighted sum of the features. It is fast, interpretable, the baseline for every regression problem — and, with polynomial features, it can fit curves too.

`ŷ = w₀ + w₁x₁ + w₂x₂ + … + wₚxₚ`

# Ordinary least squares

OLS chooses the weights that minimise the sum of squared residuals `Σ(yᵢ − ŷᵢ)²`. The minimiser has a closed form, the <strong>normal equation</strong> (in practice solved with a stable least-squares routine rather than an explicit inverse):

`w = (XᵀX)⁻¹ Xᵀ y (X includes a column of 1s for the intercept)`

```python filename:Python
import numpy as np
from sklearn.linear_model import LinearRegression

rng = np.random.default_rng(0)
X = rng.normal(size=(100, 2))
y = 1.5 + 2.0 * X[:, 0] - 3.0 * X[:, 1] + rng.normal(0, 0.5, size=100)

Xb = np.c_[np.ones(len(X)), X]
w = np.linalg.solve(Xb.T @ Xb, Xb.T @ y)           # normal equation
print(w.round(3))                                   # [ 1.418  1.946 -2.913] ← [intercept, w1, w2]

m = LinearRegression().fit(X, y)
print(round(m.intercept_, 3), m.coef_.round(3))     # 1.418 [ 1.946 -2.913] ← identical
print(round(m.score(X, y), 3))                      # 0.97 ← R² on the training data
```

# Reading the coefficients

`wⱼ` is the expected change in `ŷ` when `xⱼ` increases by one unit <strong>with the other features held fixed</strong>. Two cautions: coefficients depend on the feature's units (standardise features to compare magnitudes), and they describe association in this data, not cause and effect.

# Assumptions (and what breaks when they fail)

| Assumption | Check | If violated |
| --- | --- | --- |
| <strong>Linearity</strong> — `E[y &#124; x]` is linear in the parameters | Residuals vs fitted values show no pattern | Biased predictions → transform features, add polynomial terms, or use a non-linear model |
| <strong>Independent errors</strong> | No autocorrelation in residuals over time/order (Durbin-Watson) | Standard errors too small → time-series models, clustered errors |
| <strong>Homoscedasticity</strong> — constant error variance | No funnel shape in residuals vs fitted | Unreliable intervals/p-values → log-transform `y`, weighted least squares, robust standard errors |
| <strong>Normal errors</strong> | Q–Q plot of residuals | Only affects small-sample confidence intervals and p-values — not the predictions |
| <strong>No perfect multicollinearity</strong> | Variance inflation factor (VIF) — above \~5–10 is a warning | Unstable, uninterpretable coefficients → drop/combine features, Ridge |

> [!NOTE] Key point
>
> Under linearity, exogeneity (`E[ε | X] = 0`) and uncorrelated constant-variance errors, OLS is the <strong>best linear unbiased estimator</strong> (Gauss–Markov). Normality is <em>not</em> required for that — only for exact small-sample tests. For p-values and confidence intervals use `statsmodels`' OLS; scikit-learn focuses on prediction.

```python filename:Python
import numpy as np
from sklearn.linear_model import LinearRegression

rng = np.random.default_rng(0)
x = np.linspace(0, 10, 60)
y = x ** 2 + rng.normal(0, 3, size=60)          # the truth is curved

m = LinearRegression().fit(x.reshape(-1, 1), y)
resid = y - m.predict(x.reshape(-1, 1))
print([round(float(r.mean()), 1) for r in np.array_split(resid, 3)])   # [3.6, -7.7, 4.1] ← +, −, +: a pattern = missed curvature
```

Multicollinearity check — `x3` is almost `x1 + x2`, so each of them is well predicted by the others:

```python filename:Python
import numpy as np
from sklearn.linear_model import LinearRegression

rng = np.random.default_rng(0)
x1, x2 = rng.normal(size=(2, 200))
x3 = x1 + x2 + rng.normal(0, 0.1, 200)
X = np.c_[x1, x2, x3]

def vif(X, j):                                  # VIF_j = 1 / (1 − R²_j), R²_j from regressing x_j on the rest
    others = np.delete(X, j, axis=1)
    r2 = LinearRegression().fit(others, X[:, j]).score(others, X[:, j])
    return 1 / (1 - r2)

print([round(vif(X, j), 1) for j in range(3)])   # [95.4, 108.2, 189.6]
```

# Polynomial regression

Add powers (and products) of the features, then fit an ordinary linear model. The model is still <strong>linear in its parameters</strong>, so OLS applies unchanged. Choose the degree with cross-validation — too high overfits:

```python filename:Python
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import cross_val_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import PolynomialFeatures

rng = np.random.default_rng(0)
x = rng.uniform(-3, 3, size=(60, 1))
y = 0.5 * x[:, 0] ** 3 - x[:, 0] ** 2 + rng.normal(0, 2, size=60)

def cv_rmse(degree):
    model = make_pipeline(PolynomialFeatures(degree), LinearRegression())
    return round(float(-cross_val_score(model, x, y, cv=5, scoring="neg_root_mean_squared_error").mean()), 2)

print([cv_rmse(d) for d in (1, 2, 3, 6, 12)])   # [4.64, 2.89, 2.34, 2.81, 7.47] ← lowest at the true degree, 3
```

> [!WARNING] Watch out
>
> With several features, `PolynomialFeatures(degree=d)` creates every product up to degree d — the column count explodes (10 features, degree 3 → 286 columns). Combine it with scaling and Ridge, or use splines (`SplineTransformer`) or a tree model.

> [!TIP] Do
>
> Use as a fast, interpretable baseline; when relationships are roughly linear; when you need coefficients to explain.

> [!DANGER] Avoid
>
> Expect it to capture interactions or thresholds you didn't engineer; trust coefficients of correlated features; extrapolate far beyond the training range.

```question
What is the difference between R² and adjusted R²?

---

R² never decreases when you add a feature, even a useless one. Adjusted R² = `1 − (1 − R²)(n − 1)/(n − p − 1)` penalises the number of predictors `p`, so it only rises if a new feature helps more than chance would.
```

```question
Why not use linear regression for classification?

---

Its outputs aren't bounded to \[0, 1\], so they aren't probabilities, and squared error on 0/1 labels lets far-away, correctly classified points drag the boundary. Logistic regression models the log-odds instead and is fitted by maximum likelihood.
```

```question
What does multicollinearity do to a linear regression?

---

Predictions can remain fine, but coefficients become unstable (large standard errors, signs that flip with small data changes) because the model can't tell the correlated features' effects apart. Detect with VIF; fix by dropping or combining features, or with Ridge regularisation.
```
