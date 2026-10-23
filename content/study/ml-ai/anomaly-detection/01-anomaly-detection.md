---
id: 6c5d7a2c-363e-7808-b139-78d3627bbe1c
key: topic:ml-ai/anomaly-detection
subject: ml-ai
topic: anomaly-detection
title: Anomaly Detection
slug: anomaly-detection
order: 1
---

Anomaly detection finds rows that don't look like the rest — fraud, intrusions, faulty sensors, manufacturing defects. Labels are usually scarce, so most methods learn what <em>normal</em> looks like and score deviations from it.

| Kind | Example |
| --- | --- |
| Point anomaly | A $9,000 purchase on a card that averages $40 |
| Contextual anomaly | 30 °C is normal in July, anomalous in January |
| Collective anomaly | A burst of small logins from one IP, each normal on its own |

# Approaches

| Approach | Method | Idea |
| --- | --- | --- |
| Statistical | z-score, IQR, robust z-score (median/MAD) | Far from the centre of one feature's distribution |
| Isolation | `IsolationForest` | Random splits isolate anomalies in fewer steps (shorter tree paths) |
| Density / distance | `LocalOutlierFactor`, k-NN distance | Much lower local density than the neighbours |
| Boundary | `OneClassSVM` | A boundary enclosing the normal data |
| Reconstruction | PCA, autoencoders | Normal data compresses well; anomalies reconstruct badly |
| Supervised | Any classifier with class weights | When enough labelled anomalies exist — usually the most accurate |

`robust z = 0.6745 · (x − median) / MAD flag if |robust z| > 3.5 (MAD = median |x − median|)`

```python filename:Python
import numpy as np

x = np.array([12, 14, 13, 15, 14, 13, 16, 14, 95])
med = np.median(x)
mad = np.median(np.abs(x - med))
robust_z = 0.6745 * (x - med) / mad
print(med, mad, robust_z.round(1).tolist())   # 14.0 1.0 [-1.3, 0.0, -0.7, 0.7, 0.0, -0.7, 1.3, 0.0, 54.6] ← the 95 stands out; the plain z-score gave only 2.83
```

# Isolation Forest and LOF

```python filename:Python
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.metrics import precision_score, recall_score
from sklearn.neighbors import LocalOutlierFactor

rng = np.random.default_rng(0)
normal = rng.normal(0, 1, size=(300, 2))
anomalies = rng.uniform(-6, 6, size=(15, 2))
anomalies = anomalies[np.linalg.norm(anomalies, axis=1) > 4]      # keep clearly unusual points
X = np.vstack([normal, anomalies])
truth = np.r_[np.zeros(len(normal)), np.ones(len(anomalies))]

iso = IsolationForest(contamination=0.03, random_state=0).fit(X)
flag_iso = iso.predict(X) == -1                                    # −1 = anomaly, 1 = normal
flag_lof = LocalOutlierFactor(n_neighbors=20, contamination=0.03).fit_predict(X) == -1

print(len(anomalies), int(flag_iso.sum()), int(flag_lof.sum()))    # 11 10 10 ← true anomalies, flagged by each
print(round(precision_score(truth, flag_iso), 2), round(recall_score(truth, flag_iso), 2))   # 1.0 0.91 ← Isolation Forest
print(round(precision_score(truth, flag_lof), 2), round(recall_score(truth, flag_lof), 2))   # 0.9 0.82 ← LOF
```

`contamination` sets the expected share of anomalies — it only moves the <strong>threshold</strong> on the anomaly score (`score_samples` / `decision_function`). In practice, rank rows by score and review the top k.

# Practical notes

- <strong>Outlier detection</strong> (training data contains anomalies) vs <strong>novelty detection</strong> (train on clean data, score new points — `LocalOutlierFactor(novelty=True)`, `OneClassSVM`).
- Evaluate with whatever labels exist: precision@k (analysts review k alerts a day), recall on known incidents, PR-AUC. Accuracy is meaningless when 99.9% of rows are normal.
- Scale features for distance-based methods; Isolation Forest doesn't need it.
- Once labelled anomalies accumulate, a supervised model (often gradient boosting with class weights) usually beats unsupervised scores — or use the scores as features for it.
- Attackers adapt: monitor and retrain (see <strong>Deployment, Monitoring &amp; MLOps</strong>).

```question
How does Isolation Forest work?

---

It builds random trees that split on a random feature at a random threshold. Anomalies are few and different, so they are isolated near the root — their average path length across trees is short — while normal points need many splits. The anomaly score is based on that average path length.
```

```question
How do you evaluate an anomaly detector without labels?

---

Get at least a small labelled sample (analyst review of the top-scored and a random set of rows), then measure precision@k and recall. Also check stability of scores over time and use synthetic injected anomalies as a sanity check.
```
