---
id: e4ca97ad-31d3-7971-b2c4-f7b9ae5a4beb
key: topic:ml-ai/data_collection
subject: ml-ai
topic: data_collection
title: Data Collection & Labeling
slug: data-collection-labeling
order: 1
---

A model can only be as good as its data. The training set must <strong>represent the population the model will serve</strong>, and the labels must be consistent enough to learn from.

# Where data comes from

| Source | Strengths | Watch out for |
| --- | --- | --- |
| Product logs &amp; databases | Real, plentiful, matches production | Logging bugs, missing fields, only sees what the current system shows users |
| Public datasets | Fast to start, benchmarks | Different population; license terms |
| APIs &amp; web scraping | Broad coverage | Terms of service, copyright, personal data, rate limits |
| Sensors / IoT | High volume, time-stamped | Drift, calibration errors, gaps |
| Human annotation | Labels exactly what you need | Cost, inconsistency, annotator bias |
| Synthetic data | Rare cases, privacy | May not reflect real-world messiness |

# Representativeness and sampling bias

- <strong>Selection bias</strong> — the sample isn't random: a loan model trained only on <em>approved</em> applicants never sees how rejected ones would have repaid.
- <strong>Survivorship bias</strong> — only the survivors are recorded (products still on sale, companies still trading).
- <strong>Coverage gaps</strong> — a speech model trained on one accent, a vision model trained on daytime photos.
- <strong>Time mismatch</strong> — data from last year when behaviour has since changed.

> [!NOTE] Key point
>
> Ask: <em>would the rows I train on look like the rows the model will score next month?</em> If not, fix the collection before tuning any model.

# Labeling

1. <strong>Write guidelines</strong>

   Exact definitions and edge cases (“is a sarcastic review negative?”) with examples.

2. <strong>Pilot and measure agreement</strong>

   Several annotators label the same items; compute inter-annotator agreement.

3. <strong>Label at scale with checks</strong>

   Gold questions with known answers, multiple labels per item, majority vote or a label model.

4. <strong>Audit</strong>

   Review disagreements and model–label conflicts; they often reveal unclear guidelines.

Raw percent agreement is inflated by chance. <strong>Cohen's kappa</strong> corrects for the agreement two annotators would reach by guessing with their own label frequencies:

`κ = (pₒ − pₑ) / (1 − pₑ) pₒ = observed agreement, pₑ = agreement expected by chance`

```python filename:Python
from sklearn.metrics import cohen_kappa_score

a = ["spam", "ham", "spam", "spam", "ham", "ham", "spam", "ham", "ham", "ham"]
b = ["spam", "ham", "ham", "spam", "ham", "ham", "spam", "ham", "spam", "ham"]

p_o = sum(x == y for x, y in zip(a, b)) / len(a)
p_e = 0.4 * 0.4 + 0.6 * 0.6            # both say spam 40% of the time, ham 60%
print(p_o, round(p_e, 2))              # 0.8 0.52
print(round((p_o - p_e) / (1 - p_e), 3), round(cohen_kappa_score(a, b), 3))   # 0.583 0.583 ← same number
```

Rough reading (Landis &amp; Koch): &lt; 0.4 poor to fair, 0.4–0.6 moderate, 0.6–0.8 substantial, &gt; 0.8 near-perfect. Use Fleiss' kappa or Krippendorff's alpha for more than two annotators.

# Getting labels cheaply

> [!NOTE] Active learning
>
> Train on a few labels, then ask humans to label the examples the model is <strong>least sure</strong> about — they carry the most information per label.

> [!NOTE] Weak supervision
>
> Write several noisy <strong>labeling functions</strong> (keywords, regexes, heuristics, existing models); a label model estimates each function's accuracy and combines their votes into probabilistic labels (the Snorkel approach).

> [!NOTE] Semi-supervised
>
> Use many unlabelled rows alongside a few labelled ones, e.g. self-training on confident predictions.

> [!NOTE] Transfer learning
>
> Start from a model pre-trained on related data so far fewer labels are needed (see <strong>Deep Learning</strong>).

```python filename:Python
import numpy as np
from sklearn.datasets import make_classification
from sklearn.linear_model import LogisticRegression

X, y = make_classification(n_samples=500, random_state=0)
labeled, pool = np.arange(20), np.arange(20, 500)        # we paid for 20 labels so far

model = LogisticRegression().fit(X[labeled], y[labeled])
p = model.predict_proba(X[pool])[:, 1]
most_uncertain = np.argsort(np.abs(p - 0.5))[:5]           # probabilities closest to 0.5
print(pool[most_uncertain])                               # [393 398 245 464 413] ← send these rows to annotators
print(p[most_uncertain].round(2))                         # [0.5  0.5  0.51 0.51 0.49]
```

> [!WARNING] Watch out
>
> Keep the raw data, the labeling guidelines and each dataset version together (DVC, lakeFS, or dated snapshots). A model whose training data can't be reproduced can't be debugged or audited.

```question
How do you handle noisy labels?

---

Measure them first (agreement on a double-labelled sample). Then clarify guidelines, use several annotators with majority vote, review items where the model confidently disagrees with the label, and prefer models/losses that are robust to some noise. A clean, trustworthy <strong>test</strong> set matters most — you can't measure progress against wrong answers.
```

```question
What is active learning?

---

An iterative loop: train on the current labels, score the unlabelled pool, send the most informative examples (usually the most uncertain) to annotators, add them and retrain. It reaches a target accuracy with fewer labels than random sampling.
```
