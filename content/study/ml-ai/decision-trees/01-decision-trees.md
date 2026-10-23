---
id: 47779af4-e869-7991-bf23-a98954ec422c
key: topic:ml-ai/decision-trees
subject: ml-ai
topic: decision-trees
title: Decision Trees
slug: decision-trees
order: 1
---

A decision tree asks a sequence of yes/no questions about single features (`petal width ≤ 0.8?`) and predicts from the leaf it reaches. Trees are easy to read, need no scaling, and capture non-linear effects and interactions — but a single deep tree overfits.

# How a split is chosen

CART (scikit-learn's algorithm) grows the tree greedily: at each node it tries every feature and threshold and keeps the split that most reduces <strong>impurity</strong>, then recurses until a stopping rule.

`Gini = 1 − Σₖ pₖ² Entropy H = −Σₖ pₖ log₂ pₖ Information gain = H(parent) − Σⱼ (nⱼ / n)·H(childⱼ)`

```python filename:Python
import numpy as np

def gini(counts):
    p = np.array(counts) / sum(counts)
    return 1 - np.sum(p ** 2)

def entropy(counts):
    p = np.array([c for c in counts if c]) / sum(counts)
    return -np.sum(p * np.log2(p))

parent = [5, 5]                         # 5 yes, 5 no
left, right = [4, 1], [1, 4]            # candidate split

w = [sum(left) / 10, sum(right) / 10]
print(gini(parent), round(entropy(parent), 3))                                   # 0.5 1.0 ← maximally mixed
print(round(gini(left), 3), round(entropy(left), 3))                             # 0.32 0.722
print(round(gini(parent) - (w[0] * gini(left) + w[1] * gini(right)), 3))         # 0.18 ← Gini decrease
print(round(entropy(parent) - (w[0] * entropy(left) + w[1] * entropy(right)), 3))   # 0.278 ← information gain
```

Gini and entropy almost always choose the same splits; Gini is slightly cheaper (no logarithm). Regression trees use the reduction in <strong>squared error (variance)</strong> instead and predict the mean of each leaf.

# A readable model

```python filename:Python
from sklearn.datasets import load_iris
from sklearn.tree import DecisionTreeClassifier, export_text

iris = load_iris()
tree = DecisionTreeClassifier(max_depth=2, random_state=0).fit(iris.data, iris.target)
print(export_text(tree, feature_names=iris.feature_names))
print(tree.predict([[5.0, 3.0, 5.0, 1.8]]))
```

```text filename:Output
|--- petal width (cm) <= 0.80
|   |--- class: 0
|--- petal width (cm) >  0.80
|   |--- petal width (cm) <= 1.75
|   |   |--- class: 1
|   |--- petal width (cm) >  1.75
|   |   |--- class: 2

[2]
```

# Overfitting and pruning

```python filename:Python
from sklearn.datasets import load_breast_cancer
from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier

X, y = load_breast_cancer(return_X_y=True)
X_tr, X_te, y_tr, y_te = train_test_split(X, y, stratify=y, random_state=0)

def report(**params):
    t = DecisionTreeClassifier(random_state=0, **params).fit(X_tr, y_tr)
    return t.get_depth(), int(t.get_n_leaves()), round(t.score(X_tr, y_tr), 3), round(t.score(X_te, y_te), 3)

print(report())                        # (5, 18, 1.0, 0.902) ← (depth, leaves, train acc, test acc): grown until pure
print(report(max_depth=3))             # (3, 8, 0.977, 0.916) ← pre-pruning
print(report(min_samples_leaf=10))     # (4, 8, 0.955, 0.916)
print(report(ccp_alpha=0.01))          # (3, 6, 0.972, 0.923) ← cost-complexity (post-)pruning
```

| Knob | Effect |
| --- | --- |
| `max_depth` | Limits the number of questions per path |
| `min_samples_split` / `min_samples_leaf` | No tiny leaves that memorise single rows |
| `max_leaf_nodes` | Caps total complexity |
| `ccp_alpha` | Grows the full tree, then prunes branches whose impurity reduction doesn't justify their size |

> [!TIP] Do
>
> Use when you need a transparent model or rules, mixed feature types, non-linear effects — and as the building block of random forests and gradient boosting.

> [!DANGER] Avoid
>
> Rely on one deep tree: it has high variance (small data changes → a different tree), makes axis-aligned staircase boundaries, and cannot extrapolate beyond the training range of the target.

> [!WARNING] Watch out
>
> scikit-learn's trees need numeric input — encode categorical features first (they are not handled “natively”, unlike in LightGBM, CatBoost or `HistGradientBoosting*`). Missing values <em>are</em> supported since scikit-learn 1.3.

```question
How does a decision tree decide where to split?

---

For every feature and candidate threshold it computes the weighted impurity (Gini or entropy for classification, squared error for regression) of the two children and picks the split with the largest impurity decrease. This greedy, one-step-ahead search repeats at each child until a stopping criterion.
```

```question
Why do decision trees overfit and how do you prevent it?

---

Grown to purity, a tree can carve out a leaf for every training point, fitting noise. Prevent it by limiting depth or leaf size, cost-complexity pruning, or by averaging many trees (random forests) or boosting shallow ones.
```

```question
Gini impurity vs entropy?

---

Both measure how mixed a node is (0 = pure). Entropy is information-theoretic and slightly more sensitive to rare classes; Gini avoids a logarithm. They produce nearly identical trees in practice.
```
