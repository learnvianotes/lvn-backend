---
id: e3371f46-857e-7d3c-a58b-24209c44500f
key: topic:ml-ai/ml_pipeline
subject: ml-ai
topic: ml_pipeline
title: "End-to-End Pipeline: Pipeline & ColumnTransformer"
slug: end-to-end-pipeline-pipeline-columntransformer
order: 1
---

A real project chains many steps — imputing, encoding, scaling, modelling. scikit-learn's `Pipeline` and `ColumnTransformer` bundle them into <strong>one estimator</strong>, so cross-validation can't leak, tuning covers preprocessing, and the exact same transformations run in production.

# The lifecycle

Frame problem &amp; metric → Collect &amp; label data → Split (time / group / stratified) → EDA on training data → Pipeline: preprocess + model → Cross-validate &amp; tune → Error analysis → Test once → Deploy (shadow → canary) → Monitor &amp; retrain

It is a loop, not a line: monitoring feeds new data and new failure cases back into labelling and training.

# Building blocks

| Tool | Role |
| --- | --- |
| `Pipeline([(name, step), …])` | Chains transformers and a final estimator; `fit` fits each step on the output of the previous one |
| `ColumnTransformer` | Applies different preprocessing to different columns (numeric vs categorical) and concatenates the results |
| `make_column_selector(dtype_include=…)` | Selects columns by dtype instead of hard-coded names |
| `FunctionTransformer` | Wraps a custom function (log, ratios) as a pipeline step |
| `step__param` names | Address any step's hyperparameter in `GridSearchCV`, e.g. `model__C`, `prep__num__impute__strategy` |

# A complete example

```python filename:Python
import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GridSearchCV, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

# ── a churn-like dataset with numeric, categorical and missing values ──
rng = np.random.default_rng(0)
n = 1500
df = pd.DataFrame({
    "tenure_months": rng.integers(1, 72, n),
    "monthly_charges": rng.normal(70, 20, n).round(2),
    "contract": rng.choice(["monthly", "one_year", "two_year"], n, p=[0.55, 0.25, 0.2]),
    "payment": rng.choice(["card", "bank", "cash"], n),
})
df.loc[rng.random(n) < 0.05, "monthly_charges"] = np.nan          # 5% missing
logit = -1 - 0.04 * df["tenure_months"] + 0.02 * df["monthly_charges"].fillna(70) \
        + df["contract"].map({"monthly": 1.5, "one_year": 0.0, "two_year": -1.5})
df["churn"] = (rng.random(n) < 1 / (1 + np.exp(-logit))).astype(int)

X, y = df.drop(columns="churn"), df["churn"]
X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, stratify=y, random_state=0)   # 1. split first

numeric = Pipeline([("impute", SimpleImputer(strategy="median")), ("scale", StandardScaler())])
categorical = Pipeline([("impute", SimpleImputer(strategy="most_frequent")),
                        ("onehot", OneHotEncoder(handle_unknown="ignore"))])
prep = ColumnTransformer([("num", numeric, ["tenure_months", "monthly_charges"]),
                          ("cat", categorical, ["contract", "payment"])])
pipe = Pipeline([("prep", prep), ("model", LogisticRegression(max_iter=1000))])   # 2. one estimator

search = GridSearchCV(pipe, {"model__C": [0.01, 0.1, 1, 10]}, cv=5, scoring="roc_auc")
search.fit(X_tr, y_tr)                                          # 3. every fold refits the preprocessing
print("best C:", search.best_params_["model__C"], "| CV ROC-AUC:", round(search.best_score_, 3))
print("test ROC-AUC:", round(search.score(X_te, y_te), 3))     # 4. test once

best = search.best_estimator_
print(best.named_steps["prep"].get_feature_names_out().tolist())

joblib.dump(best, "churn_model.joblib")                         # 5. ship ONE artefact
loaded = joblib.load("churn_model.joblib")
new_customer = pd.DataFrame([{"tenure_months": 3, "monthly_charges": np.nan,
                              "contract": "monthly", "payment": "crypto"}])   # missing value + unseen category
print("churn probability:", round(loaded.predict_proba(new_customer)[0, 1], 3))
```

```text filename:Output
best C: 1 | CV ROC-AUC: 0.805
test ROC-AUC: 0.819
['num__tenure_months', 'num__monthly_charges', 'cat__contract_monthly', 'cat__contract_one_year', 'cat__contract_two_year', 'cat__payment_bank', 'cat__payment_card', 'cat__payment_cash']
churn probability: 0.846
```

The raw new row — with a missing charge and a payment type never seen in training — goes straight into the loaded pipeline: imputation, scaling and encoding happen exactly as in training.

# Why pipelines matter

- <strong>No leakage</strong>: in cross-validation every transformer is fitted on the training folds only.
- <strong>Tune everything</strong>: imputation strategy, encoder settings and even whether to scale become hyperparameters.
- <strong>One artefact</strong>: preprocessing and model are saved and versioned together — no re-implementing feature logic in the serving code, the #1 source of training–serving skew.
- Use `pipe.set_output(transform="pandas")` to keep column names through the steps while debugging.

> [!WARNING] Watch out
>
> `joblib`/`pickle` files can execute code when loaded — only load models from trusted sources, and pin library versions: a model pickled with one scikit-learn version is not guaranteed to load in another. For cross-language serving consider ONNX (`skl2onnx`).

```question
Why use a scikit-learn Pipeline?

---

It fits preprocessing only on training data in every CV fold (preventing leakage), lets GridSearchCV tune preprocessing and model together, and produces a single object that applies identical transformations at prediction time — avoiding training–serving skew.
```

```question
How would you handle numeric and categorical columns differently in one model?

---

With a ColumnTransformer: a numeric sub-pipeline (impute median, scale) and a categorical one (impute most frequent, one-hot with `handle_unknown="ignore"`), combined and followed by the model inside a Pipeline.
```

```question
Walk me through an end-to-end ML project.

---

Define the decision, target and metric with stakeholders; collect and label data; split (by time/group if needed); explore the training data; build a baseline; build a pipeline with preprocessing and candidate models; cross-validate and tune; analyse errors and slices; evaluate once on the test set; package and deploy (shadow, canary, A/B); monitor data, predictions and outcomes; retrain when needed.
```
