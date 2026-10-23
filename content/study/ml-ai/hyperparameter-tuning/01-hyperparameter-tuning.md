---
id: e07a9c75-24fd-7f33-a70d-d5af4ac83746
key: topic:ml-ai/hyperparameter-tuning
subject: ml-ai
topic: hyperparameter-tuning
title: Hyperparameter Tuning
slug: hyperparameter-tuning
order: 1
---

Hyperparameters (tree depth, `C`, learning rate) aren't learned by `fit`; you choose them by comparing cross-validated scores. The search strategy decides how much compute that takes.

| Strategy | How | Pros / cons |
| --- | --- | --- |
| Manual | Intuition + a few runs | Quick for 1–2 knobs; not reproducible |
| Grid search | Every combination of listed values | Exhaustive and simple; cost multiplies with each hyperparameter |
| Random search | Sample combinations from distributions | Same budget explores more distinct values of each hyperparameter — usually better when only a few matter (Bergstra &amp; Bengio, 2012) |
| Successive halving / Hyperband | Evaluate many configs on little data/iterations, keep the best fraction, give them more | Much cheaper; early rounds can be noisy |
| Bayesian optimisation | A surrogate model (Gaussian process, TPE) predicts promising configs; an acquisition function balances exploring and exploiting | Fewest evaluations for expensive models; sequential; tools: Optuna, scikit-optimize, Hyperopt |

# Grid search

```python filename:Python
from sklearn.datasets import load_breast_cancer
from sklearn.model_selection import GridSearchCV, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC

X, y = load_breast_cancer(return_X_y=True)
X_tr, X_te, y_tr, y_te = train_test_split(X, y, stratify=y, random_state=0)

pipe = Pipeline([("scale", StandardScaler()), ("svc", SVC())])
grid = {"svc__C": [0.1, 1, 10, 100], "svc__gamma": [0.001, 0.01, 0.1]}    # step__param names
search = GridSearchCV(pipe, grid, cv=5, scoring="roc_auc").fit(X_tr, y_tr)

print(search.best_params_)                      # {'svc__C': 10, 'svc__gamma': 0.001}
print(round(search.best_score_, 4))             # 0.9962 ← mean CV score of the winner (optimistic)
print(round(search.score(X_te, y_te), 4))       # 0.9937 ← refit on all training data, scored once on test
```

# Random search

```python filename:Python
from scipy.stats import loguniform, randint
from sklearn.datasets import load_breast_cancer
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.model_selection import RandomizedSearchCV

X, y = load_breast_cancer(return_X_y=True)
dists = {
    "learning_rate": loguniform(0.01, 0.5),          # sample on a log scale
    "max_leaf_nodes": randint(4, 64),
    "min_samples_leaf": randint(5, 50),
    "l2_regularization": loguniform(1e-4, 10),
}
search = RandomizedSearchCV(HistGradientBoostingClassifier(random_state=0), dists, n_iter=15,
                            cv=3, scoring="roc_auc", random_state=0).fit(X, y)
print(round(search.best_score_, 4))                                   # 0.9934
print(sorted(search.best_params_))                                    # ['l2_regularization', 'learning_rate', 'max_leaf_nodes', 'min_samples_leaf']
```

# Successive halving

```python filename:Python
from sklearn.experimental import enable_halving_search_cv  # noqa: F401  (still experimental)
from sklearn.model_selection import HalvingGridSearchCV
from sklearn.datasets import load_digits
from sklearn.ensemble import RandomForestClassifier

X, y = load_digits(return_X_y=True)
grid = {"max_depth": [4, 8, None], "min_samples_leaf": [1, 5, 20], "max_features": ["sqrt", 0.5]}
search = HalvingGridSearchCV(RandomForestClassifier(n_estimators=50, random_state=0), grid,
                             resource="n_samples", factor=3, cv=3, random_state=0).fit(X, y)
print(search.n_candidates_)              # [18, 6, 2] ← candidates per round: most are dropped early on little data
print(search.n_resources_)               # [199, 597, 1791] ← samples used per round
```

# Tips

- Search learning rates and regularisation strengths on a <strong>log scale</strong> (0.001, 0.01, 0.1 …).
- Go coarse → fine: a wide random search, then a narrow one around the best region.
- Tune the hyperparameters that matter most (for GBMs: learning rate, number of trees via early stopping, depth/leaves, subsampling).
- Put preprocessing in the `Pipeline` so each CV fold fits its own scaler/encoder, and tune preprocessing choices too (`"scale": [StandardScaler(), "passthrough"]`).
- `best_score_` is optimistically biased (it's the maximum of many noisy estimates) — report a held-out test score or nested CV.
- Fix `random_state`s and record every trial (MLflow, Weights &amp; Biases) so results are reproducible.

```question
Why can random search beat grid search?

---

With a fixed budget, a grid tests only a few distinct values of each hyperparameter, and many runs are wasted varying ones that don't matter. Random search tries a new value of every hyperparameter in every run, so it explores the important dimensions much more finely.
```

```question
How does Bayesian optimisation work?

---

It fits a cheap surrogate model of score as a function of hyperparameters to the trials so far, then picks the next trial by maximising an acquisition function (e.g. expected improvement) that trades off exploring uncertain regions and exploiting good ones. It needs far fewer expensive training runs than grid or random search.
```

```question
Can you tune hyperparameters on the test set?

---

No — the chosen hyperparameters would be fitted to the test set, and its score would no longer estimate performance on new data. Tune with a validation set or cross-validation on the training data; use the test set once at the end.
```
