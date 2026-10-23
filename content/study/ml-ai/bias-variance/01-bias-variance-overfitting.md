---
id: c187714f-34e3-71d6-b77e-993f636c8311
key: topic:ml-ai/bias-variance
subject: ml-ai
topic: bias-variance
title: Bias–Variance & Overfitting
slug: bias-variance-overfitting
order: 1
---

A model's expected error on new data splits into <strong>bias</strong> (wrong assumptions), <strong>variance</strong> (sensitivity to the particular training set) and <strong>irreducible noise</strong>. Making a model more flexible trades bias for variance.

`E[(y − f̂(x))²] = Bias[f̂(x)]² + Var[f̂(x)] + σ²`

| Term | Meaning | Too much of it looks like |
| --- | --- | --- |
| Bias² | How far the <em>average</em> model (over many training sets) is from the truth | Underfitting: a straight line through a curve |
| Variance | How much the model changes when trained on a different sample | Overfitting: wiggly fit that chases noise |
| σ² (irreducible) | Noise in `y` itself | A floor no model can go below |

# See it: polynomial degree

Fit polynomials of increasing degree to 20 noisy points from a sine curve and measure the error on 200 fresh points:

```python filename:Python
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.metrics import root_mean_squared_error
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import PolynomialFeatures

rng = np.random.default_rng(1)
def sample(n):
    x = rng.uniform(0, 1, n)
    return x.reshape(-1, 1), np.sin(2 * np.pi * x) + rng.normal(0, 0.2, n)

X_tr, y_tr = sample(20)
X_te, y_te = sample(200)

def errors(degree):
    m = make_pipeline(PolynomialFeatures(degree), LinearRegression()).fit(X_tr, y_tr)
    return round(root_mean_squared_error(y_tr, m.predict(X_tr)), 2), round(root_mean_squared_error(y_te, m.predict(X_te)), 2)

print(errors(1))    # (0.37, 0.52) ← underfit: both errors high
print(errors(4))    # (0.18, 0.25) ← good: both near the noise level 0.2
print(errors(15))   # (0.16, 1.97) ← overfit: lowest training error, test error explodes
```

# Measure bias and variance directly

Repeat an experiment on 300 different training sets and look at the predictions at fixed points: bias² is how far their <em>average</em> is from the truth, variance is how much they scatter. k-nearest-neighbour regression makes the trade-off easy to see — small `k` is flexible, large `k` averages a lot:

```python filename:Python
import numpy as np
from sklearn.neighbors import KNeighborsRegressor

rng = np.random.default_rng(0)
x_grid = np.linspace(0.05, 0.95, 50).reshape(-1, 1)
truth = np.sin(2 * np.pi * x_grid).ravel()

def bias_variance(k, runs=300, n=50):
    preds = []
    for _ in range(runs):                                   # 300 independent training sets
        x = rng.uniform(0, 1, n)
        y = np.sin(2 * np.pi * x) + rng.normal(0, 0.3, n)   # noise σ² = 0.09
        preds.append(KNeighborsRegressor(n_neighbors=k).fit(x.reshape(-1, 1), y).predict(x_grid))
    preds = np.array(preds)
    bias2 = np.mean((preds.mean(axis=0) - truth) ** 2)
    var = np.mean(preds.var(axis=0))
    return round(float(bias2), 3), round(float(var), 3), round(float(bias2 + var), 3)

print(bias_variance(1))    # (0.0, 0.094, 0.095) ← (bias², variance, sum): very flexible → variance dominates
print(bias_variance(5))    # (0.0, 0.023, 0.024) ← the sweet spot
print(bias_variance(25))   # (0.07, 0.02, 0.09) ← averages over half the data → bias dominates
```

Expected test error is this sum plus the noise σ² = 0.09 — the sum is U-shaped in `k`, exactly the curve in every textbook.

# Fixes

| Underfitting (high bias) | Overfitting (high variance) |
| --- | --- |
| More flexible model (higher degree, deeper trees, boosting) | More training data |
| Better / more features | Regularisation (L1/L2), pruning / `max_depth`, `min_samples_leaf` |
| Less regularisation | Fewer features, feature selection |
| Train longer (if not converged) | Bagging / random forests; early stopping |

# Learning curves

A learning curve plots training and validation scores against training-set size. It tells you whether <strong>more data</strong> would help:

```python filename:Python
import numpy as np
from sklearn.datasets import load_digits
from sklearn.model_selection import learning_curve
from sklearn.naive_bayes import GaussianNB
from sklearn.svm import SVC

X, y = load_digits(return_X_y=True)
sizes = [100, 400, 800, 1400]
for name, model in [("naive bayes", GaussianNB()), ("svc", SVC(gamma=0.001))]:
    n, train, val = learning_curve(model, X, y, train_sizes=sizes, cv=5)
    print(name, train.mean(axis=1).round(2).tolist(), val.mean(axis=1).round(2).tolist())
```

```text filename:Output
naive bayes [1.0, 0.95, 0.89, 0.87] [0.59, 0.77, 0.79, 0.81]
svc [0.99, 1.0, 1.0, 1.0] [0.83, 0.91, 0.95, 0.97]
```

Naive Bayes: the curves converge around 0.8–0.87 — adding data barely helps (bias-limited). SVC: training accuracy stays near 1.0 while validation keeps climbing — more data still pays off.

- <strong>Both curves plateau low and close together</strong> → high bias: more data won't help; use a more flexible model or better features.
- <strong>Large gap that narrows as data grows</strong> → high variance: more data (or regularisation) will help.

# Validation curves

A validation curve plots scores against one hyperparameter — here the maximum depth of a decision tree. Training accuracy keeps rising with depth; validation accuracy peaks and then falls — the classic overfitting picture:

```python filename:Python
from sklearn.datasets import load_breast_cancer
from sklearn.model_selection import validation_curve
from sklearn.tree import DecisionTreeClassifier

X, y = load_breast_cancer(return_X_y=True)
depths = [1, 2, 3, 5, 8, 12]
train, val = validation_curve(DecisionTreeClassifier(random_state=0), X, y,
                              param_name="max_depth", param_range=depths, cv=5)
print(train.mean(axis=1).round(3).tolist())   # [0.924, 0.952, 0.974, 0.991, 1.0, 1.0]
print(val.mean(axis=1).round(3).tolist())     # [0.9, 0.928, 0.917, 0.916, 0.916, 0.917]
```

> [!NOTE] Key point
>
> Very large neural networks can show <strong>double descent</strong> — test error falls again past the point where the model can fit the training data exactly. It doesn't overturn bias–variance for classic models; see <strong>Deep Learning</strong>.

```question
Explain the bias–variance trade-off.

---

Expected test error = bias² + variance + irreducible noise. Simple models make strong assumptions (high bias) but barely change between training sets (low variance); flexible models are the reverse. Increasing flexibility first lowers total error (bias falls) and then raises it (variance dominates). The goal is the sweet spot, found with validation data.
```

```question
How can you tell whether a model is overfitting or underfitting?

---

Compare training and validation error. Both high and close → underfitting. Training much lower than validation → overfitting. Learning curves show whether more data would close the gap.
```

```question
Does adding more data fix underfitting?

---

No. Underfitting is a bias problem: the model can't represent the pattern even with infinite data. It needs more capacity or better features. More data mainly reduces variance.
```
