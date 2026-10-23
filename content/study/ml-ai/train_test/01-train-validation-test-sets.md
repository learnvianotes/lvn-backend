---
id: f67b98ff-ccfc-70a0-ba49-2f7f59196d03
key: topic:ml-ai/train_test
subject: ml-ai
topic: train_test
title: Train, Validation & Test Sets
slug: train-validation-test-sets
order: 1
---

You can't measure generalisation on the data you trained on. Hold data back: a <strong>validation</strong> set to make choices and a <strong>test</strong> set, used once, to report how the final model will do on new data.

| Split | Used for | Typical share |
| --- | --- | --- |
| Training | Fitting parameters (`fit`) | 60–80% |
| Validation | Choosing hyperparameters, features, the model, the decision threshold; early stopping | 10–20% (or cross-validation instead) |
| Test | One final, unbiased estimate of performance — after all decisions are made | 10–20% |

The shares are rules of thumb. With millions of rows, 1% can be a perfectly large test set; with a few hundred rows, prefer cross-validation for model selection and keep a small test set — or use nested cross-validation.

# A three-way split

```python filename:Python
from sklearn.datasets import make_classification
from sklearn.model_selection import train_test_split

X, y = make_classification(n_samples=1000, weights=[0.9], random_state=0)   # ~10% positives

X_tmp, X_test, y_tmp, y_test = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)
X_train, X_val, y_train, y_val = train_test_split(X_tmp, y_tmp, test_size=0.25,   # 0.25 × 0.8 = 0.2
                                                  stratify=y_tmp, random_state=42)
print(len(X_train), len(X_val), len(X_test))                                    # 600 200 200
print(round(y_train.mean(), 3), round(y_val.mean(), 3), round(y_test.mean(), 3))  # 0.102 0.105 0.1 ← same class balance
```

# Why stratify

With a rare class, a purely random split can leave the test set with almost no positives. `stratify=y` keeps the class proportions identical in every split:

```python filename:Python
import numpy as np
from sklearn.model_selection import train_test_split

y = np.array([1] * 5 + [0] * 95)                    # 5% positives
random_counts = [int(train_test_split(y, test_size=0.2, random_state=s)[1].sum()) for s in range(8)]
strat_counts = [int(train_test_split(y, test_size=0.2, stratify=y, random_state=s)[1].sum()) for s in range(8)]
print(random_counts)    # [1, 0, 3, 0, 1, 0, 1, 0] ← positives in the 20-row test set, per seed
print(strat_counts)     # [1, 1, 1, 1, 1, 1, 1, 1]
```

# When a random split is wrong

| Data | Problem with a random split | Split instead by |
| --- | --- | --- |
| Time-ordered (sales, prices, logs) | Training on the future to predict the past | Time: train on earlier, validate/test on later |
| Grouped (several rows per patient, user, device) | The model recognises the entity, not the pattern | Group: all rows of an entity in one split |
| Near-duplicates (same image resized, reposted listings) | Test rows are copies of training rows | Deduplicate first, or group duplicates |

# Rules that keep evaluation honest

1. Split <strong>first</strong>, before fitting any imputer, scaler, encoder or feature selector.
2. Fit everything on the training data; only `transform` the validation and test data.
3. Make every decision with validation data or cross-validation.
4. Look at the test set <strong>once</strong>. If you then change the model because of it, it has become a validation set and its score is optimistic.
5. After choosing the model, refit it on train + validation before deploying (more data, same recipe).

# Reading the gaps

| Training error | Validation error | Diagnosis | Next step |
| --- | --- | --- | --- |
| High | High (similar) | Underfitting (high bias) | More capacity, better features, less regularisation |
| Low | Much higher | Overfitting (high variance) | More data, regularisation, simpler model, early stopping |
| Low | Low | Good fit | Confirm on the test set |

See <strong>Bias–Variance &amp; Overfitting</strong> for the theory and learning curves.

```question
Why do we need a validation set in addition to a test set?

---

Every choice made by comparing scores — hyperparameters, features, models — fits the data those scores came from. If you make them on the test set, the test score becomes optimistically biased. The validation set absorbs that selection bias; the untouched test set then gives an honest final estimate.
```

```question
You tuned on the test set by mistake. What now?

---

Treat that score as a validation score, not a generalisation estimate. Get a fresh held-out set (new data, or a later time period) for the final evaluation, and switch to cross-validation for tuning.
```
