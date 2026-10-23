---
id: ea77c148-f254-79e9-98ed-02f35213a606
key: topic:data-science/regression
subject: data-science
topic: regression
title: Polynomial Regression
slug: polynomial-regression
order: 1
---

Linear regression fits a straight line. When the relationship curves, add powers of the input (x², x³…) as extra features — the model stays linear in its coefficients, but the fitted curve bends.

> [!INFO]
>
> <strong>Polynomial features</strong> — turning `[x]` into `[1, x, x²]` (degree 2). `PolynomialFeatures` does this; `LinearRegression` then fits `y ≈ b₀ + b₁x + b₂x²`.

```python filename:Python
import numpy as np
from sklearn.preprocessing import PolynomialFeatures
from sklearn.linear_model import LinearRegression

X = np.array([[1], [2], [3], [4], [5]])
y = np.array([3, 8, 9, 70, 80])

poly = PolynomialFeatures(degree=2)
X_poly = poly.fit_transform(X)
print(X_poly[1])                                  # [1. 2. 4.]   ← 1, x, x² for x = 2

model = LinearRegression().fit(X_poly, y)
print(model.predict(poly.transform([[6]])).round(1))   # [133.8]
print(round(model.score(X_poly, y), 3))           # 0.884
```

# Cleaner with a pipeline

```python filename:Python
import numpy as np
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import PolynomialFeatures
from sklearn.linear_model import LinearRegression

X = np.array([[1], [2], [3], [4], [5]])
y = np.array([3, 8, 9, 70, 80])
model = make_pipeline(PolynomialFeatures(degree=2), LinearRegression())
model.fit(X, y)                                   # transform + fit in one step
print(model.predict([[6]]).round(1))              # [133.8]
```

# Plotting the fit

```python filename:Python
import numpy as np
import matplotlib.pyplot as plt
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import PolynomialFeatures
from sklearn.linear_model import LinearRegression

X = np.array([[1], [2], [3], [4], [5]])
y = np.array([3, 8, 9, 70, 80])
model = make_pipeline(PolynomialFeatures(degree=2), LinearRegression()).fit(X, y)

X_range = np.linspace(0, 6, 100).reshape(-1, 1)   # 100 points to draw a smooth curve
plt.scatter(X, y, label="Data points")
plt.plot(X_range, model.predict(X_range), color="red", label="Polynomial fit")
plt.xlabel("X"); plt.ylabel("y"); plt.legend()
plt.show()
```

> [!WARNING] Watch out
>
> Higher degree isn't better: with 5 points, degree 4 passes through every point exactly and predicts nonsense between and beyond them. Choose the degree by testing on held-out data.
