---
id: 1d64a3ae-5fa6-7503-9d16-7649ebcf065c
key: topic:ml-ai/eda
subject: ml-ai
topic: eda
title: Data Types & EDA
slug: data-types-eda
order: 1
---

Exploratory data analysis (EDA) is how you learn what's in the data before modelling: types, missing values, distributions, outliers, the target's balance and suspicious features.

# Kinds of data

<strong>Structured</strong> (tabular) data has rows and named columns — database tables, CSVs. <strong>Unstructured</strong> data — text, images, audio, video — has no predefined columns; classic ML needs features extracted from it, while deep learning learns them. Within a table, each column has a statistical type that decides how it is prepared:

| Type | Examples | Typical preparation |
| --- | --- | --- |
| Numerical — continuous | Price, temperature, duration | Scaling; log-transform if skewed |
| Numerical — discrete (counts) | Number of purchases, children | As numbers; sometimes capped or log-transformed |
| Categorical — nominal (no order) | City, product id, colour | One-hot, target or hash encoding |
| Categorical — ordinal (ordered) | Size S &lt; M &lt; L, education level, star rating | Ordered integer codes |
| Binary | Is\_premium, has\_children | 0 / 1 |
| Date / time | Signup timestamp | Extract parts (hour, weekday), elapsed time, cyclical encoding |
| Free text | Reviews, titles | Bag-of-words / TF-IDF, embeddings |
| Identifiers | User id, row number | Usually <strong>not</strong> features — they let a model memorise rows |

# A first look with pandas

```python filename:Python
import numpy as np
import pandas as pd

df = pd.DataFrame({
    "age":     [34, 45, np.nan, 23, 51, 38, 29, 62],
    "income":  [52_000, 61_000, 48_000, 31_000, 250_000, 58_000, 40_000, 75_000],
    "city":    ["Pune", "Delhi", "Pune", "Mumbai", "Delhi", "Pune", None, "Mumbai"],
    "plan":    ["basic", "pro", "basic", "basic", "premium", "pro", "basic", "pro"],
    "churned": [0, 0, 1, 1, 0, 0, 1, 0],
})
print(df.shape)                                        # (8, 5)
print(df.isna().sum().to_dict())                       # {'age': 1, 'income': 0, 'city': 1, 'plan': 0, 'churned': 0}
print(df["churned"].mean())                            # 0.375 ← share of positives: check the balance
print(df["income"].agg(["mean", "median"]).tolist())   # [76875.0, 55000.0] ← mean pulled up by one 250k value
print(round(df["income"].skew(), 2))                   # 2.63 ← strongly right-skewed
print(df["city"].value_counts().to_dict())             # {'Pune': 3, 'Delhi': 2, 'Mumbai': 2}
print(df[["age", "income", "churned"]].corr()["churned"].drop("churned").round(2).to_dict())   # {'age': -0.73, 'income': -0.43} ← only 8 rows: far too few to trust
```

# EDA checklist

| Check | How | Why |
| --- | --- | --- |
| Shape, types, ids | `df.info()`, `df.dtypes` | Numbers stored as strings, ids that must not be features |
| Missing values | `df.isna().mean()` | Choose imputation; missingness can be informative |
| Duplicates | `df.duplicated().sum()` | Duplicates across train/test inflate scores |
| Target distribution | `value_counts(normalize=True)` / histogram | Class imbalance, skewed regression targets |
| Univariate distributions | `describe()`, histograms, box plots | Skew, impossible values (age = −1), outliers |
| Relationships | Scatter plots, `corr()`, grouped means by category | Useful features, collinearity |
| Too-good features | A single feature almost perfectly predicting the target | Usually <strong>target leakage</strong> |
| Time | Plot counts and target rate over time | Drift, seasonality, logging changes |

> [!WARNING] Watch out
>
> Do the detailed EDA on the <strong>training split</strong>. Looking closely at the test set and designing features around it leaks information about it into your choices.

# Correlation, carefully

```python filename:Python
import numpy as np
from scipy.stats import pearsonr, spearmanr

x = np.arange(1, 11, dtype=float)
y_curve = x ** 3                               # perfectly monotonic, but not linear
print(round(pearsonr(x, y_curve)[0], 3))       # 0.928 ← Pearson: linear association
print(round(spearmanr(x, y_curve)[0], 3))      # 1.0 ← Spearman: rank (monotonic) association

u = np.linspace(-1, 1, 21)
print(round(pearsonr(u, u ** 2)[0], 3))        # 0.0 ← y depends on u completely, yet correlation is 0
```

- Pearson measures <strong>linear</strong> association only; zero correlation does not mean independence.
- Spearman uses ranks — robust to outliers and captures any monotonic trend.
- Correlation is not causation: ice-cream sales and drownings both rise in summer.
- For categorical–target relationships, compare target rates per category or use mutual information.

```question
What do you look at first in a new dataset?

---

Size and column types, the target's distribution, missing values and duplicates, obviously wrong values, then each feature's distribution and its relationship with the target. I also check how the data was collected and over what time span, and flag any feature that predicts the target suspiciously well.
```

```question
Why shouldn't an ID column be used as a feature?

---

It carries no generalisable information but is unique per row, so flexible models memorise it and look great on training data. Worse, if ids were assigned in time order, it can leak time or target information.
```
