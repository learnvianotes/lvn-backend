---
id: c8733f60-e95c-75e3-a3b6-afc911195a47
key: topic:ml-ai/problem_formulation
subject: ml-ai
topic: problem_formulation
title: Framing an ML Problem
slug: framing-an-ml-problem
order: 1
---

Most failed ML projects fail at framing, not modelling: the wrong target, a metric nobody cares about, or features that won't exist at prediction time. Turn the business goal into a precise prediction task first.

1. <strong>Business objective</strong>

   What decision will the prediction change? “Reduce churn” → “which customers should get a retention offer this week?”

2. <strong>Prediction target</strong>

   Define `y` exactly, including time: <em>churned = no purchase in the 30 days after the prediction date</em>.

3. <strong>Prediction point &amp; features</strong>

   Only use information available <strong>at the moment the prediction is made</strong>. Everything after it is leakage.

4. <strong>ML task</strong>

   Binary classification, regression, ranking, clustering…

5. <strong>Metrics</strong>

   An offline ML metric (PR-AUC, RMSE) that tracks an online business metric (retained revenue); set a success threshold up front.

6. <strong>Baseline</strong>

   A trivial model or a simple rule. A model is only useful if it clearly beats it.

7. <strong>Constraints</strong>

   Latency, cost, interpretability, fairness, privacy, how often labels arrive.

# Common task types

| Task | Predicts | Example | Typical metrics |
| --- | --- | --- | --- |
| Regression | A number | Ride price from distance and time | MAE, RMSE, R² |
| Binary classification | One of two classes | Is this transaction fraud? | Precision, recall, F1, PR-AUC, ROC-AUC |
| Multi-class classification | One of k classes | Which product category? | Accuracy, macro-F1, log-loss |
| Multi-label classification | Any subset of k labels | Tags for an article | Per-label F1, Hamming loss |
| Ranking | An ordering of items | Search results for a query | NDCG@k, MRR, MAP |
| Recommendation | Items a user will like | Movies to show on the home page | Recall@k, NDCG@k, online CTR / watch time |
| Forecasting | Future values of a time series | Next week's demand per store | MAE, RMSE, sMAPE/MASE |
| Clustering | Groups of similar rows (no labels) | Customer segments | Silhouette; usefulness to the business |
| Anomaly detection | Unusual rows | Faulty sensor readings | Precision@k, recall on known incidents |

# Always start with a baseline

On the breast-cancer dataset (63% benign), a “model” that always predicts the majority class already gets 63% accuracy. A real model has to beat that, not 50%.

```python filename:Python
from sklearn.datasets import load_breast_cancer
from sklearn.dummy import DummyClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

X, y = load_breast_cancer(return_X_y=True)
X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.25, stratify=y, random_state=0)

baseline = DummyClassifier(strategy="most_frequent").fit(X_tr, y_tr)
model = make_pipeline(StandardScaler(), LogisticRegression()).fit(X_tr, y_tr)
print(round(baseline.score(X_te, y_te), 3))   # 0.629 ← always predicts "benign"
print(round(model.score(X_te, y_te), 3))      # 0.958
```

Good baselines: the majority class or the mean (`DummyClassifier`, `DummyRegressor`), yesterday's value for a time series, a hand-written rule the business already uses, or a small logistic/linear regression.

# Worked example: a spam filter

| Decision | Choice | Why / caveat |
| --- | --- | --- |
| Task | Binary classification: spam vs not spam | Output a probability so the threshold can be tuned |
| Input | Subject, body text, sender history, links, sending IP reputation | All available when the email arrives |
| Labels | “Report spam” / “Not spam” clicks plus a sample reviewed by annotators | User reports are biased and noisy: most spam is never reported and people also “report” newsletters they signed up for |
| Metric | Precision at a fixed recall, or recall at ≥ 99.9% precision | A legitimate email lost in the spam folder (false positive) is far worse than one spam in the inbox |
| Baseline | Current blocklist and keyword rules | The model must beat what already exists |
| Constraints | Milliseconds per email; spammers adapt | Retrain often and monitor drift |

# Framing traps

- <strong>Proxy targets</strong> — optimising clicks when you care about satisfaction rewards clickbait.
- <strong>Features from the future</strong> — `days_since_last_login` computed at training time over the whole history, but at prediction time only up to today.
- <strong>Feedback loops</strong> — a model that decides who gets a loan only ever sees outcomes for approved applicants.
- <strong>No action attached</strong> — a churn score nobody acts on has zero value, however high its AUC.

```question
How would you frame a churn prediction problem?

---

Pick a prediction date and define churn precisely (e.g. no activity in the next 30 days). Build features only from data before the prediction date, label from the 30 days after it, and split by time (train on earlier months, validate on later ones). It's binary classification with an imbalanced target: evaluate with PR-AUC or precision@k (the number of customers the retention team can contact) and compare to a baseline such as “inactive for 14 days”.
```

```question
Your model has 95% accuracy. Is it good?

---

Unknown until you compare it with a baseline and the right metric. If 95% of cases are negative, predicting “negative” always gets 95%. Check precision/recall for the class you care about, the cost of each error, and whether the metric moves the business outcome.
```
