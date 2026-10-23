---
id: d87e1bee-c345-7673-880d-d5c33101f6e9
key: topic:ml-ai/loss-gradient-descent
subject: ml-ai
topic: loss-gradient-descent
title: Loss Functions & Gradient Descent
slug: loss-functions-gradient-descent
order: 1
---

Training means minimising a <strong>loss function</strong> — a number that says how wrong the model is. Gradient descent does this by repeatedly stepping the parameters downhill along the negative gradient.

| Term | Meaning |
| --- | --- |
| Loss | Error on one example, e.g. `(y − ŷ)²` |
| Cost / objective | Average loss over the training set, plus any regularisation penalty — what the optimiser minimises |
| Metric | What <em>you</em> care about when evaluating (accuracy, F1, MAE); it need not be differentiable and may differ from the training loss |

# Common losses

| Loss | Formula (one example) | Used by | Notes |
| --- | --- | --- | --- |
| Squared error (MSE) | `(y − ŷ)²` | Linear regression, regression trees | Penalises large errors heavily; predicts the conditional <strong>mean</strong> |
| Absolute error (MAE) | `&#124;y − ŷ&#124;` | Robust regression, quantile models | Less sensitive to outliers; predicts the conditional <strong>median</strong> |
| Huber | Squared for `&#124;y − ŷ&#124; ≤ δ`, linear beyond | `HuberRegressor`, boosting | MSE near zero, MAE for outliers |
| Log-loss (binary cross-entropy) | `−[y·log p + (1 − y)·log(1 − p)]` | Logistic regression, boosting, neural nets | Punishes confident wrong probabilities without limit |
| Hinge | `max(0, 1 − y·f(x))`, `y ∈ {−1, +1}` | SVM | Zero once a point is beyond the margin |

```python filename:Python
import numpy as np
from sklearn.metrics import log_loss, mean_absolute_error, mean_squared_error

y = np.array([3.0, 5.0, 2.0, 8.0])
y_hat = np.array([2.5, 5.0, 4.0, 7.0])
print(np.mean((y - y_hat) ** 2), mean_squared_error(y, y_hat))
print(np.mean(np.abs(y - y_hat)), mean_absolute_error(y, y_hat))

# log-loss for a positive example (y = 1) at different predicted probabilities
for p in (0.9, 0.5, 0.1, 0.01):
    print(p, round(-np.log(p), 3))
print(round(log_loss([1, 0], [0.9, 0.2]), 4))   # mean of −log 0.9 and −log 0.8
```

```text filename:Output
1.3125 1.3125
0.875 0.875
0.9 0.105
0.5 0.693
0.1 2.303
0.01 4.605
0.1643
```

# Gradient descent

`θ ← θ − η · ∇J(θ) η = learning rate, ∇J = gradient of the cost`

The gradient points uphill; stepping against it lowers the cost. For linear regression with MSE cost `J(θ) = (1/n)·‖Xθ − y‖²`, the gradient is `(2/n)·Xᵀ(Xθ − y)`:

```python filename:Python
import numpy as np

rng = np.random.default_rng(0)
x = rng.uniform(0, 2, 100)
y = 4 + 3 * x + rng.normal(0, 0.5, 100)
X = np.c_[np.ones(100), x]                      # column of 1s for the intercept

theta = np.zeros(2)
lr = 0.1
for step in range(1000):
    grad = 2 / len(y) * X.T @ (X @ theta - y)
    theta -= lr * grad
print(theta.round(3))                                   # [3.996 2.967] ← gradient descent

print(np.linalg.lstsq(X, y, rcond=None)[0].round(3))    # [3.996 2.967] ← closed-form least squares: same answer
```

# The learning rate

```python filename:Python
import numpy as np

rng = np.random.default_rng(0)
x = rng.uniform(0, 2, 100)
y = 4 + 3 * x + rng.normal(0, 0.5, 100)
X = np.c_[np.ones(100), x]

def final_cost(lr, steps=50):
    theta = np.zeros(2)
    for _ in range(steps):
        theta -= lr * 2 / len(y) * X.T @ (X @ theta - y)
    return np.mean((X @ theta - y) ** 2)

print(f"{final_cost(0.001):.3g}")   # 34.7 ← too small: still far from the minimum after 50 steps
print(f"{final_cost(0.1):.3g}")     # 0.248 ← good: at the noise level (0.5² ≈ 0.25)
print(f"{final_cost(1.0):.3g}")     # 1.36e+60 ← too large: overshoots and diverges
```

| Variant | Gradient computed on | Trade-off |
| --- | --- | --- |
| Batch gradient descent | All n examples each step | Exact, smooth; slow for large n |
| Stochastic (SGD) | One example each step | Cheap, noisy steps — the noise can escape shallow bumps |
| Mini-batch | A batch of 32–1024 examples | The practical default: vectorised and reasonably smooth |

- <strong>Scale features</strong> first — with very different scales the cost surface is a long narrow valley and gradient descent zig-zags.
- Linear and logistic regression costs are <strong>convex</strong>: any minimum is the global minimum. Neural-network losses are not (see <strong>Deep Learning</strong> for momentum, Adam and learning-rate schedules).
- Stop when the cost stops improving on validation data (<strong>early stopping</strong>) or after a fixed number of epochs.

```question
What happens if the learning rate is too high or too low?

---

Too low: tiny steps, very slow convergence, may stall. Too high: steps overshoot the minimum, the cost oscillates or diverges to infinity. Try values on a log scale (0.001, 0.01, 0.1…) and watch the training curve.
```

```question
Why is log-loss used for classification instead of MSE?

---

It is the negative log-likelihood of a Bernoulli model, so minimising it gives maximum-likelihood probabilities. Combined with a sigmoid it is convex in the weights and gives large gradients when the model is confidently wrong; MSE with a sigmoid is non-convex and its gradients vanish on confident mistakes.
```

```question
Batch vs stochastic vs mini-batch gradient descent?

---

They differ in how many examples are used per update: all of them (accurate but slow), one (fast, noisy), or a small batch (the usual compromise that uses vectorised hardware well).
```
