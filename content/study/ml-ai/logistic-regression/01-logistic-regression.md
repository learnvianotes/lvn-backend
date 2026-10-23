---
id: 365d860b-30c8-721a-aae4-c9a545622522
key: topic:ml-ai/logistic-regression
subject: ml-ai
topic: logistic-regression
title: Logistic Regression
slug: logistic-regression
order: 1
---

Logistic regression is the standard linear <strong>classifier</strong>: it computes a weighted sum of the features and squashes it through the sigmoid to get a probability.

`z = w·x + b p = P(y = 1 | x) = σ(z) = 1 / (1 + e⁻ᶻ) log(p / (1 − p)) = z`

The model is linear in the <strong>log-odds</strong>. Predict class 1 when `p ≥ 0.5` — equivalently `z ≥ 0` — so the decision boundary `w·x + b = 0` is a straight line (hyperplane). The threshold can and often should be moved (see <strong>ROC, PR, Thresholds &amp; Calibration</strong>).

```python filename:Python
import numpy as np

sigmoid = lambda z: 1 / (1 + np.exp(-z))
print(sigmoid(np.array([-4, -1, 0, 1, 4])).round(3))    # [0.018 0.269 0.5   0.731 0.982]
print(round(np.log(0.8 / 0.2), 3))                      # 1.386 ← logit: p = 0.8 means z ≈ 1.386
```

# Training: maximum likelihood = minimum log-loss

`J(w, b) = −(1/n) Σ [ yᵢ log pᵢ + (1 − yᵢ) log(1 − pᵢ) ] ∂J/∂w = (1/n) Σ (pᵢ − yᵢ) xᵢ`

The cost is convex, so solvers (`lbfgs` by default) find the global minimum; there is no closed form. scikit-learn adds an <strong>L2 penalty by default</strong> (`C=1.0`, where smaller `C` = stronger regularisation), so scale your features.

# Interpreting a coefficient: odds ratios

```python filename:Python
import numpy as np
from sklearn.linear_model import LogisticRegression

rng = np.random.default_rng(0)
hours = rng.uniform(0, 10, 300)
passed = rng.random(300) < 1 / (1 + np.exp(-1.2 * (hours - 5)))   # true w = 1.2, boundary at 5 h

m = LogisticRegression(C=np.inf).fit(hours.reshape(-1, 1), passed)   # C=inf → no penalty
w, b = m.coef_[0, 0], m.intercept_[0]
print(round(w, 2), round(b, 2))                         # 1.11 -5.79
print(round(np.exp(w), 2))                              # 3.04 ← each extra hour multiplies the odds of passing by this
print(round(-b / w, 2))                                 # 5.21 ← hours where p = 0.5 (the decision boundary)
print(m.predict_proba([[3.0], [7.0]])[:, 1].round(3))   # [0.079 0.88 ]
```

# A real dataset

```python filename:Python
from sklearn.datasets import load_breast_cancer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

X, y = load_breast_cancer(return_X_y=True)
X_tr, X_te, y_tr, y_te = train_test_split(X, y, stratify=y, random_state=0)

clf = make_pipeline(StandardScaler(), LogisticRegression(C=1.0)).fit(X_tr, y_tr)
print(round(clf.score(X_te, y_te), 3))                  # 0.958
print(clf.predict_proba(X_te[:3]).round(3).tolist())    # [[0.004, 0.996], [1.0, 0.0], [1.0, 0.0]] ← [P(class 0), P(class 1)] per row
print(clf.predict(X_te[:3]))                            # [1 0 0]
```

# More than two classes

With the default `lbfgs` solver, scikit-learn fits a <strong>multinomial</strong> (softmax) model: one weight vector per class, `P(y = k | x) = e^{zₖ} / Σⱼ e^{zⱼ}`. The alternative, one-vs-rest, trains one binary model per class (`OneVsRestClassifier`).

```python filename:Python
from sklearn.datasets import load_iris
from sklearn.linear_model import LogisticRegression

X, y = load_iris(return_X_y=True)
clf = LogisticRegression(max_iter=1000).fit(X, y)
proba = clf.predict_proba(X[[0, 75, 140]])
print(proba.round(3).tolist())             # [[0.982, 0.018, 0.0], [0.005, 0.92, 0.075], [0.0, 0.02, 0.98]]
print(proba.sum(axis=1).round(6).tolist()) # [1.0, 1.0, 1.0] ← each row sums to 1
print(clf.coef_.shape)                     # (3, 4) ← one weight vector per class
```

> [!TIP] Do
>
> Use as the first classifier on any problem: fast, well-calibrated probabilities, interpretable coefficients, works well on high-dimensional sparse data (text).

> [!DANGER] Avoid
>
> Expect curved boundaries without engineered features (polynomials, splines, interactions); forget to scale features when regularising; read an unpenalised model's coefficients on perfectly separable data (they diverge).

```question
Why is it called regression if it's a classifier?

---

It is a regression model for the <strong>log-odds</strong> of the positive class (a generalised linear model with a logit link). Thresholding the resulting probability turns it into a classifier.
```

```question
How do you interpret a logistic regression coefficient?

---

A one-unit increase in the feature adds `w` to the log-odds, i.e. multiplies the odds `p/(1−p)` by `e^w`, holding other features fixed. With standardised features, it's per standard deviation.
```

```question
Is the decision boundary of logistic regression linear?

---

Yes — `w·x + b = 0` is a hyperplane in the feature space it is given. Adding polynomial or interaction features makes the boundary curved in the original space while the model stays linear in its parameters.
```
