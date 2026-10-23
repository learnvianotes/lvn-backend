---
id: 6c4511eb-2ab6-7d4f-b45f-557a4c6f42b3
key: topic:ml-ai/ai_ethics
subject: ml-ai
topic: ai_ethics
title: Fairness, Privacy & Responsible AI
slug: fairness-privacy-responsible-ai
order: 1
---

Models learn from historical data, including its biases, and they act at scale. Responsible ML means measuring who the model fails, protecting the people in the data, and documenting what the model should and shouldn't be used for.

# Where bias comes from

| Source | Example |
| --- | --- |
| Historical bias | Past hiring decisions favoured one group; a model trained on them repeats it |
| Representation bias | Few examples from some groups (skin tones, accents, regions) |
| Measurement bias | A proxy target: “arrests” as a stand-in for “crime” |
| Aggregation bias | One model for groups whose features relate to the outcome differently |
| Evaluation bias | Benchmark that doesn't represent the deployed population |
| Feedback loops | Predictions change the data that future models are trained on |

# Group fairness metrics

| Criterion | Requires equal across groups | Formula (A = group) |
| --- | --- | --- |
| Demographic (statistical) parity | Selection rate | `P(ŷ = 1 &#124; A = a)` |
| Equal opportunity | True positive rate | `P(ŷ = 1 &#124; y = 1, A = a)` |
| Equalized odds | TPR <strong>and</strong> FPR | `P(ŷ = 1 &#124; y, A = a)` for y = 0 and 1 |
| Predictive parity | Precision | `P(y = 1 &#124; ŷ = 1, A = a)` |
| Calibration within groups | Meaning of a score | `P(y = 1 &#124; score = s, A = a) = s` |

The <strong>disparate impact ratio</strong> (lowest selection rate ÷ highest) is often checked against the US “four-fifths rule” (≥ 0.8) as a screening heuristic.

```python filename:Python
import numpy as np
import pandas as pd

rng = np.random.default_rng(0)
n = 4000
group = rng.choice(["A", "B"], n)
y = (rng.random(n) < np.where(group == "A", 0.30, 0.15)).astype(int)     # different base rates
score = np.clip(0.35 * y + rng.normal(0.3, 0.15, n) + np.where(group == "B", -0.05, 0), 0, 1)
pred = (score >= 0.5).astype(int)

df = pd.DataFrame({"group": group, "y": y, "pred": pred})
rows = {}
for g, d in df.groupby("group"):
    rows[g] = {
        "base_rate": d.y.mean(),
        "selection_rate": d.pred.mean(),
        "TPR": d.pred[d.y == 1].mean(),
        "FPR": d.pred[d.y == 0].mean(),
        "precision": d.y[d.pred == 1].mean(),
    }
report = pd.DataFrame(rows).T.round(3)
print(report)
print("disparate impact:", round(report.selection_rate.min() / report.selection_rate.max(), 3))
```

```text filename:Output
   base_rate  selection_rate    TPR    FPR  precision
A      0.291           0.305  0.850  0.082      0.811
B      0.159           0.165  0.742  0.056      0.713
disparate impact: 0.541
```

Group B is selected far less often — partly because its base rate is lower (not necessarily unfair) and partly because its scores are shifted down, which lowers its TPR (equal opportunity is violated). Which criterion matters is a policy decision about the application, not a purely technical one.

> [!WARNING] Watch out
>
> <strong>Impossibility result</strong> (Kleinberg et al.; Chouldechova, 2016–17): when base rates differ between groups, a classifier cannot be calibrated within groups <em>and</em> have equal TPR and FPR across them — except in the degenerate case of perfect prediction. You must choose which notion of fairness fits the decision.

> [!WARNING] Watch out
>
> <strong>Fairness through unawareness</strong> — just dropping the protected attribute — doesn't work: zip code, name, school or shopping history act as proxies. You often need the attribute to <em>measure</em> fairness at all.

# Mitigation

| Stage | Techniques |
| --- | --- |
| Pre-processing | Collect more representative data, re-weight or re-sample groups, fix biased labels |
| In-processing | Fairness constraints or penalties during training (e.g. `fairlearn` reductions) |
| Post-processing | Group-specific thresholds to equalise TPR/FPR (check legality: some domains forbid group-dependent treatment) |
| Process | Slice-based evaluation before launch, human review for high-stakes decisions, appeal mechanisms, monitoring after launch |

# Privacy

- <strong>Data minimisation</strong> — collect and keep only what the model needs; remove direct identifiers.
- <strong>Anonymisation is hard</strong> — combinations of quasi-identifiers (zip code, birth date, gender) re-identify most people; models can also leak training data (membership-inference attacks).
- <strong>Differential privacy (DP)</strong> — a formal guarantee: a mechanism M is ε-differentially private if for any two datasets differing in one person, `P[M(D) ∈ S] ≤ e^ε · P[M(D′) ∈ S]`. Adding calibrated noise is how it's achieved (Laplace mechanism for counts; DP-SGD for training). Smaller ε = more privacy, less accuracy.
- <strong>Federated learning</strong> — train across devices without centralising raw data; model updates can still leak information, so it's combined with secure aggregation and DP.
- Regulations such as GDPR (purpose limitation, data subject rights, rules on automated decisions) and the EU AI Act (risk-based obligations) shape what is allowed.

```python filename:Python
import numpy as np

rng = np.random.default_rng(0)
true_count = 132                                   # e.g. patients with a condition
for eps in (0.1, 1.0, 10.0):
    noisy = true_count + rng.laplace(scale=1 / eps, size=5)   # Laplace mechanism: sensitivity 1 / ε
    print(eps, noisy.round(1).tolist())
```

```text filename:Output
0.1 [135.2, 125.8, 107.0, 97.9, 141.8]
1.0 [133.7, 132.2, 132.6, 132.1, 134.0]
10.0 [132.1, 131.5, 132.1, 131.7, 132.1]
```

Smaller ε means more noise: stronger privacy for any individual, less accurate answers.

# Documentation and oversight

- <strong>Model cards</strong> — intended use, out-of-scope uses, training data, metrics overall and by slice, limitations, ethical considerations.
- <strong>Datasheets for datasets</strong> — how data was collected, by whom, consent, known gaps.
- Human oversight and contestability for high-stakes decisions (credit, hiring, health, justice).
- Security: adversarial examples, data poisoning and model extraction — see <strong>Deep Learning</strong> and <strong>Generative AI</strong> for model-specific risks such as prompt injection and hallucination.

```question
What is the difference between demographic parity and equalized odds?

---

Demographic parity requires the same positive-prediction rate in each group regardless of the true labels. Equalized odds requires equal true-positive and false-positive rates — equal error rates conditioned on the true outcome. When base rates differ, satisfying one generally violates the other.
```

```question
Removing the sensitive attribute makes the model fair — true?

---

No. Other features act as proxies, so the model can reconstruct the attribute and reproduce the bias. And without the attribute you can't even measure group disparities. Fairness needs measurement per group and deliberate mitigation.
```

```question
What is differential privacy?

---

A mathematical guarantee that the output of an analysis or trained model changes very little whether or not any single person's data is included, bounded by ε. It is achieved by adding calibrated random noise (Laplace mechanism, DP-SGD) and trades privacy against accuracy.
```
