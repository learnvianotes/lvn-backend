---
id: 24658af8-b642-7f55-82d3-250266ddef15
key: topic:ml-ai/regularization
subject: ml-ai
topic: regularization
title: "Regularization: L1, L2 & Elastic Net"
slug: regularization-l1-l2-elastic-net
order: 1
---

Regularisation adds a penalty on model complexity to the training objective, trading a little bias for a large reduction in variance. For linear models the penalty is on the size of the weights.

`Ridge (L2): Σ(y − ŷ)² + α·Σ wⱼ² Lasso (L1): (1/2n)·Σ(y − ŷ)² + α·Σ|wⱼ|`

`Elastic Net: (1/2n)·Σ(y − ŷ)² + α·[ ρ·Σ|wⱼ| + ((1 − ρ)/2)·Σ wⱼ² ] ρ = l1_ratio`

These are scikit-learn's exact objectives — note `Ridge` uses the plain sum of squares while `Lasso`/`ElasticNet` divide by 2n, so the same `alpha` means different strengths in each. The intercept is never penalised. Larger `alpha` → stronger penalty → smaller weights → simpler model.

|  | L2 — Ridge | L1 — Lasso | Elastic Net |
| --- | --- | --- | --- |
| Effect on weights | Shrinks all toward 0, rarely exactly 0 | Sets many <strong>exactly to 0</strong> (feature selection) | Sparse, but more stable |
| Correlated features | Spreads weight across them | Picks one somewhat arbitrarily | Tends to keep or drop the group together |
| Solution | Closed form; always unique | No closed form (coordinate descent) | Coordinate descent |
| Use when | Many small effects, multicollinearity | You expect few relevant features | Many correlated features, want sparsity |

```python filename:Python
import numpy as np
from sklearn.datasets import make_regression
from sklearn.linear_model import ElasticNet, Lasso, LinearRegression, Ridge

X, y = make_regression(n_samples=50, n_features=10, n_informative=3, noise=10, random_state=0)

for model in [LinearRegression(), Ridge(alpha=10), Lasso(alpha=5), ElasticNet(alpha=1, l1_ratio=0.9)]:
    w = model.fit(X, y).coef_
    print(f"{type(model).__name__:16} zeros={np.sum(w == 0):2}  |w|={np.abs(w).sum():7.1f}  {w.round(1).tolist()}")
```

```text filename:Output
LinearRegression zeros= 0  |w|=  192.9  [-1.5, 2.9, 97.2, 45.2, -0.5, -0.7, 2.1, -0.8, 1.3, 40.7]
Ridge            zeros= 0  |w|=  163.5  [0.3, -3.6, 74.4, 37.9, 1.8, -0.8, 7.3, -1.4, 5.9, 30.2]
Lasso            zeros= 7  |w|=  164.2  [-0.0, 0.0, 90.9, 39.2, -0.0, 0.0, 0.0, -0.0, 0.0, 34.1]
ElasticNet       zeros= 4  |w|=  165.6  [-0.0, -0.0, 83.8, 40.0, 0.0, -0.0, 4.4, -0.6, 3.2, 33.7]
```

Only features 2, 3 and 9 are informative. Lasso keeps exactly those three (`-0.0` is still zero), Elastic Net keeps them plus a few small weights, Ridge shrinks everything but zeroes nothing.

# Why L1 gives exact zeros

Geometrically, penalised regression finds where the loss contours first touch the constraint region. The L1 region `|w₁| + |w₂| ≤ t` is a diamond with corners <strong>on the axes</strong>, so the contact point is often a corner where some weights are exactly 0; the L2 region is a circle with no corners. Algebraically, the L1 penalty's pull toward zero is a constant `α` however small the weight, while the L2 pull `2αw` fades as `w` shrinks.

```python filename:Python
import numpy as np
from sklearn.datasets import make_regression
from sklearn.linear_model import Lasso, Ridge

X, y = make_regression(n_samples=50, n_features=10, n_informative=3, noise=10, random_state=0)
for a in (0.1, 1, 10, 100):
    print(a, np.sum(Lasso(alpha=a).fit(X, y).coef_ != 0), round(np.abs(Ridge(alpha=a).fit(X, y).coef_).sum(), 1))
```

```text filename:Output
0.1 10 192.3
1 7 187.7
10 3 163.5
100 0 73.2
```

Lasso keeps fewer non-zero weights as `alpha` grows; Ridge's weights shrink smoothly but stay non-zero.

> [!WARNING] Watch out
>
> Scale features before penalised models. The penalty treats every weight the same, so a feature measured in grams (large values, tiny weight) is penalised far less than the same feature in kilograms. Put a `StandardScaler` in the pipeline.

# Regularisation elsewhere

| Model | Knob | Direction |
| --- | --- | --- |
| `LogisticRegression`, `SVC`, `LinearSVC` | `C` = 1 / (regularisation strength) | <strong>Smaller</strong> `C` = stronger regularisation (L2 by default!) |
| `Ridge`, `Lasso`, `ElasticNet` | `alpha` | Larger `alpha` = stronger |
| Decision trees / forests | `max_depth`, `min_samples_leaf`, `ccp_alpha` (pruning) | Shallower / bigger leaves = stronger |
| Gradient boosting | `learning_rate`, number of trees, subsampling, early stopping | Smaller steps + early stopping = stronger |
| Neural networks | Weight decay, dropout, early stopping, data augmentation | See <strong>Deep Learning</strong> |

```question
Why does L1 regularisation produce sparse models while L2 doesn't?

---

The L1 penalty's gradient has constant magnitude α, so it keeps pushing small weights all the way to exactly zero; its constraint region has corners on the axes where solutions tend to land. L2's push is proportional to the weight, so weights shrink toward zero but essentially never reach it.
```

```question
What happens as the regularisation strength goes to 0 and to infinity?

---

At 0 you get the unregularised model (ordinary least squares), which may overfit. As it grows to infinity all weights are forced to 0 and the model predicts a constant (the intercept) — maximum bias.
```

```question
In scikit-learn's LogisticRegression, does C=100 mean strong regularisation?

---

No — `C` is the <em>inverse</em> of the regularisation strength, so `C=100` is weak regularisation and `C=0.01` strong. Note also that `LogisticRegression` is L2-regularised by default (`C=1.0`).
```
