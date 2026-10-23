---
id: 79e7730b-e58c-758f-8471-94d2f4ed85c7
key: topic:ml-ai/deployment-monitoring
subject: ml-ai
topic: deployment-monitoring
title: Deployment, Monitoring & MLOps
slug: deployment-monitoring-mlops
order: 1
---

A model creates value only in production — and production data changes. Deploy safely, monitor inputs, outputs and outcomes, and automate retraining. MLOps is the engineering discipline that makes this repeatable.

# Serving patterns

| Pattern | How | Example |
| --- | --- | --- |
| Batch | Score everything on a schedule, store results | Nightly churn scores for the CRM |
| Online (real-time) | A service answers each request (REST/gRPC) in milliseconds | Fraud check at payment time |
| Streaming | Score events from a queue (Kafka) as they arrive | Anomaly alerts on sensor streams |
| Edge / on-device | Model runs on the phone or device | Keyboard suggestions, offline vision |

# Rolling out safely

| Strategy | How | Catches |
| --- | --- | --- |
| Shadow | New model scores live traffic, but its outputs are only logged | Crashes, latency, training–serving skew — no user risk |
| Canary | Route a small % of traffic to the new model, grow it gradually | Problems at small blast radius |
| A/B test | Randomised split, compare business metrics | Whether it actually helps (see <strong>A/B Testing</strong>) |
| Blue–green + rollback | Keep the previous version ready to switch back instantly | Anything missed above |

# Why models decay: drift

| Type | What changes | Example |
| --- | --- | --- |
| Covariate (data) shift | `P(X)` changes, `P(y &#124; X)` stays | A marketing campaign brings younger users |
| Label (prior) shift | `P(y)` changes | Fraud rate doubles during a holiday season |
| Concept drift | `P(y &#124; X)` changes — the same inputs now mean something else | Spending patterns after a price shock; fraudsters change tactics |
| Upstream data changes | A pipeline bug, unit change or new category | A field starts arriving in cents instead of dollars |

# Measuring input drift

`PSI = Σ_bins (actual% − expected%) · ln(actual% / expected%) < 0.1 stable · 0.1–0.25 moderate · > 0.25 major shift`

```python filename:Python
import numpy as np
from scipy.stats import ks_2samp

rng = np.random.default_rng(0)
train = rng.normal(50, 10, 10000)                 # feature at training time
same = rng.normal(50, 10, 5000)                   # production, unchanged
shifted = rng.normal(56, 12, 5000)                # production, drifted

def psi(expected, actual, bins=10):
    edges = np.quantile(expected, np.linspace(0, 1, bins + 1))
    edges[0], edges[-1] = -np.inf, np.inf
    e = np.histogram(expected, edges)[0] / len(expected)
    a = np.histogram(actual, edges)[0] / len(actual)
    e, a = np.clip(e, 1e-6, None), np.clip(a, 1e-6, None)
    return float(np.sum((a - e) * np.log(a / e)))

print(round(psi(train, same), 3), round(psi(train, shifted), 3))                          # 0.002 0.293
print(round(ks_2samp(train, same).statistic, 3), round(ks_2samp(train, shifted).statistic, 3))   # 0.008 0.22 ← KS distance
```

> [!NOTE] Key point
>
> With large samples, KS p-values flag even trivial differences as significant — alert on effect sizes (PSI, KS statistic, Wasserstein distance) and on the features that matter most to the model.

# What to monitor

| Layer | Signals |
| --- | --- |
| Service health | Latency, throughput, error rate, memory |
| Data quality | Schema, missing-value rates, out-of-range values, unseen categories |
| Input drift | PSI / KS per important feature |
| Prediction drift | Distribution of scores and predicted classes; share of positives |
| Model performance | Accuracy/precision/recall or error once labels arrive — often delayed by days or weeks |
| Business KPIs | Conversion, fraud losses, complaints |

# Retraining

- <strong>Scheduled</strong> — retrain weekly/monthly on a sliding window; simple and predictable.
- <strong>Triggered</strong> — retrain when drift or performance alerts fire.
- <strong>Continuous / online</strong> — incremental updates (`partial_fit`) for fast-moving data.
- Always validate the new model against the current one on recent data before promoting it; retraining on bad (buggy, poisoned) data makes things worse.

# MLOps practices

| Practice | Why | Tools (examples) |
| --- | --- | --- |
| Version code, data and models | Reproduce any model and debug regressions | Git, DVC, lakeFS |
| Experiment tracking | Compare runs, parameters, metrics, artefacts | MLflow, Weights &amp; Biases |
| Model registry | Staging → production promotion, lineage, rollback | MLflow Model Registry, SageMaker, Vertex AI |
| Feature store | Same feature definitions offline (training) and online (serving) | Feast, Tecton |
| CI/CD/CT | Automated tests, builds, deployments — and continuous training | GitHub Actions, Kubeflow, Airflow |
| Data validation | Catch schema and distribution problems before training/serving | Great Expectations, TFDV, pandera |
| Documentation | Intended use, data, metrics by slice, limitations | Model cards, datasheets for datasets |

> [!INFO]
>
> <strong>Training–serving skew</strong> — a difference between how features are computed at training time and at serving time (different code, different data freshness, a timezone bug). The model sees inputs it was never trained on. Prevent with shared feature code or a feature store, and by logging production features to compare with training data.

```question
How do you detect and handle model drift in production?

---

Monitor input feature distributions (PSI/KS), prediction distributions and — as labels arrive — actual performance, plus data-quality checks. When alerts fire, first rule out pipeline bugs and training–serving skew, then diagnose the type of drift, retrain on recent data (or adjust thresholds for pure label shift), validate against the current model, and roll out gradually.
```

```question
What is the difference between covariate shift and concept drift?

---

Covariate shift: the input distribution P(X) changes but the relationship P(y|X) is the same — the model may still be right where it has data, but sees unfamiliar regions. Concept drift: P(y|X) itself changes, so the learned mapping is wrong and the model must be retrained with new labels.
```

```question
Shadow vs canary deployment?

---

Shadow: the new model receives a copy of live traffic but its predictions aren't used — zero user impact, good for checking latency and skew. Canary: the new model actually serves a small fraction of users, which tests real impact with limited risk before a full rollout.
```
