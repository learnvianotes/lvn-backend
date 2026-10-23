---
id: df9b0d69-23d0-7815-b173-73671fa2a38b
key: topic:ml-ai/encoding-categoricals
subject: ml-ai
topic: encoding-categoricals
title: Encoding Categorical Features
slug: encoding-categorical-features
order: 1
---

Most algorithms need numbers. The encoding must not invent an order that doesn't exist, must cope with categories never seen in training, and must not leak the target.

| Encoding | How | Good for | Watch out |
| --- | --- | --- | --- |
| One-hot | One 0/1 column per category | Nominal features with few categories; linear models | Many columns for high cardinality |
| Ordinal | Integer code per category in a chosen order | Truly ordered categories (S &lt; M &lt; L); tree models | Imposes an order a linear model will take literally |
| Target (mean) encoding | Replace each category by the (smoothed) target mean for it | High-cardinality features (zip code, merchant) | Leaks the target unless cross-fitted |
| Frequency / count | Replace by how often the category occurs | High cardinality, tree models | Different categories can collide on the same count |
| Hashing | Hash category into a fixed number of columns | Huge or open-ended vocabularies, streaming | Collisions; not reversible |
| Embeddings | Learned dense vectors | Very high cardinality in neural nets | Needs a neural model (see <strong>Deep Learning</strong>) |

# One-hot and ordinal in scikit-learn

```python filename:Python
import numpy as np
from sklearn.preprocessing import OneHotEncoder, OrdinalEncoder

cities = np.array([["Pune"], ["Delhi"], ["Pune"], ["Mumbai"]])
ohe = OneHotEncoder(handle_unknown="ignore", sparse_output=False).fit(cities)
print(ohe.get_feature_names_out().tolist())                # ['x0_Delhi', 'x0_Mumbai', 'x0_Pune']
print(ohe.transform([["Delhi"], ["Chennai"]]).tolist())    # [[1.0, 0.0, 0.0], [0.0, 0.0, 0.0]] ← unseen "Chennai" → all zeros

sizes = np.array([["S"], ["L"], ["M"]])
enc = OrdinalEncoder(categories=[["S", "M", "L"]]).fit(sizes)   # order given explicitly
print(enc.transform(sizes).ravel().tolist())               # [0.0, 2.0, 1.0]
```

> [!WARNING] Watch out
>
> Plain integer codes for a <strong>nominal</strong> feature (Delhi = 0, Mumbai = 1, Pune = 2) tell a linear model that Pune is “twice” Mumbai. Trees cope better with arbitrary codes, but one-hot or target encoding is usually safer. Never rely on alphabetical order for an ordinal feature — pass `categories` explicitly.

# The dummy-variable trap

With an intercept, the full set of one-hot columns always sums to 1, so one column is a linear combination of the others (perfect multicollinearity). Unregularised linear regression then has no unique solution — use `OneHotEncoder(drop="first")`. With regularisation (Ridge, the default `LogisticRegression`) or tree models, keeping all columns is fine.

# Many categories

```python filename:Python
import numpy as np
from sklearn.preprocessing import OneHotEncoder

colors = np.array([["red"]] * 6 + [["blue"]] * 3 + [["teal"], ["plum"]])
ohe = OneHotEncoder(min_frequency=2, handle_unknown="infrequent_if_exist", sparse_output=False).fit(colors)
print(ohe.get_feature_names_out().tolist())   # ['x0_blue', 'x0_red', 'x0_infrequent_sklearn'] ← rare categories grouped together
```

`target encoding(c) = (n_c · mean_c + m · global_mean) / (n_c + m) n_c = rows in category c, m = smoothing`

<strong>Target encoding</strong> replaces each category by the mean target for that category, shrunk toward the global mean when the category is rare. Computed naively on the training rows it leaks each row's own label into its feature. scikit-learn's `TargetEncoder` avoids this with <strong>cross-fitting</strong>: `fit_transform` encodes each training row using statistics from the other folds, while `transform` on new data uses the full-training statistics.

```python filename:Python
import numpy as np
from sklearn.preprocessing import TargetEncoder

X = np.array([["a"]] * 4 + [["b"]] * 4 + [["c"]])
y = np.array([1, 1, 1, 0,   0, 0, 0, 1,   1])
enc = TargetEncoder(target_type="binary", smooth=2.0, random_state=0).fit(X, y)
print(round(enc.target_mean_, 3))                  # 0.556 ← global positive rate
print(enc.encodings_[0].round(3))                  # [0.685 0.352 0.704] ← raw means 0.75, 0.25, 1.0 pulled toward 0.556
```

```question
How do you encode a feature with 10,000 categories?

---

Not with one-hot for a dense model. Options: target encoding with cross-fitting and smoothing, frequency encoding, hashing into a few thousand columns, grouping rare categories into “other”, or learned embeddings in a neural network. Tree libraries like LightGBM/CatBoost also handle categoricals natively.
```

```question
How do you handle a category at prediction time that never appeared in training?

---

Decide up front: `OneHotEncoder(handle_unknown="ignore")` encodes it as all zeros, infrequent-category grouping maps it to “other”, target encoders fall back to the global mean. Monitor how often unknown categories appear in production — a rising rate signals drift.
```
