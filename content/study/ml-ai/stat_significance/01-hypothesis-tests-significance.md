---
id: 98590806-2bcb-7d7a-b3f4-32cd1ce4399c
key: topic:ml-ai/stat_significance
subject: ml-ai
topic: stat_significance
title: Hypothesis Tests & Significance
slug: hypothesis-tests-significance
order: 1
---

A hypothesis test asks whether a difference — between groups, between models — is larger than chance alone would plausibly produce. Used carefully, it separates real improvements from noise.

1. <strong>State hypotheses</strong>

   Null `H₀`: no difference (model B's accuracy = model A's). Alternative `H₁`: there is a difference.

2. <strong>Choose α</strong>

   The false-positive rate you accept, usually 0.05 — decided before looking at the data.

3. <strong>Compute a test statistic</strong>

   How far the observed data is from what `H₀` predicts, in units of its standard error.

4. <strong>Get the p-value</strong>

   The probability, <strong>assuming H₀ is true</strong>, of a result at least as extreme as observed.

5. <strong>Decide</strong>

   Reject `H₀` if p ≤ α; otherwise “fail to reject” (not the same as proving `H₀`).

|  | H₀ true | H₀ false |
| --- | --- | --- |
| <strong>Reject H₀</strong> | Type I error (false positive) — probability α | Correct — probability = <strong>power</strong> (1 − β) |
| <strong>Fail to reject</strong> | Correct | Type II error (false negative) — probability β |

# What a p-value is not

- Not the probability that `H₀` is true, nor that the result is due to chance.
- Not the size or importance of the effect — with huge samples, trivial differences become “significant”.
- Not a pass/fail on truth: p = 0.049 and p = 0.051 are practically the same evidence.
- Report the <strong>effect size with a confidence interval</strong> alongside the p-value.

# Choosing a test

| Question | Test | SciPy |
| --- | --- | --- |
| Mean of two independent groups | Welch's t-test (no equal-variance assumption) | `ttest_ind(a, b, equal_var=False)` |
| Same units measured twice / paired | Paired t-test | `ttest_rel` |
| Two groups, no normality assumption | Mann–Whitney U | `mannwhitneyu` |
| Means of 3+ groups | One-way ANOVA | `f_oneway` |
| Two categorical variables / proportions | Chi-square test of independence; z-test for two proportions | `chi2_contingency` |
| Same distribution? | Kolmogorov–Smirnov | `ks_2samp` |
| Two classifiers on the same test set | McNemar's test (on disagreements) | `binomtest` on the discordant counts |

```python filename:Python
import numpy as np
from scipy import stats

rng = np.random.default_rng(0)
a = rng.normal(loc=50, scale=10, size=200)      # e.g. session minutes, variant A
b = rng.normal(loc=53, scale=12, size=200)      # variant B

t, p = stats.ttest_ind(b, a, equal_var=False)
print(round(t, 2), round(p, 4))                 # 1.61 0.1076 ← not significant at 0.05 (true gap is 3, but n is small)

diff = b.mean() - a.mean()
se = np.sqrt(a.var(ddof=1) / len(a) + b.var(ddof=1) / len(b))
print(round(diff, 2), [round(float(diff - 1.96 * se), 2), round(float(diff + 1.96 * se), 2)])   # 1.79 [-0.38, 3.95] ← effect and its 95% CI: includes 0

table = np.array([[120, 880], [150, 850]])      # clicked / not clicked, per variant
chi2, p_chi, dof, _ = stats.chi2_contingency(table)
print(round(chi2, 2), round(p_chi, 4), dof)     # 3.6 0.0577 1 ← 12% vs 15% CTR: borderline with 1,000 users each
```

> [!NOTE] Key point
>
> A 95% confidence interval comes from a procedure that captures the true value in 95% of repeated experiments. If the interval for a difference excludes 0, the corresponding two-sided test at α = 0.05 rejects `H₀`.

# Bootstrap confidence intervals

For metrics with no simple formula (F1, AUC, median), resample the test set <strong>with replacement</strong> many times, recompute the metric each time, and read off percentiles:

```python filename:Python
import numpy as np
from sklearn.datasets import load_breast_cancer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import f1_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

X, y = load_breast_cancer(return_X_y=True)
X_tr, X_te, y_tr, y_te = train_test_split(X, y, stratify=y, random_state=0)
pred = make_pipeline(StandardScaler(), LogisticRegression()).fit(X_tr, y_tr).predict(X_te)

rng = np.random.default_rng(0)
boot = []
for _ in range(2000):
    idx = rng.integers(0, len(y_te), len(y_te))       # resample test rows with replacement
    boot.append(f1_score(y_te[idx], pred[idx]))
print(round(f1_score(y_te, pred), 3), np.percentile(boot, [2.5, 97.5]).round(3))   # 0.967 [0.937 0.99 ] ← F1 and its 95% CI
```

# Is model B really better than model A?

Both models are scored on the <strong>same</strong> test rows, so compare them in a paired way. McNemar's test looks only at the rows where they disagree: `b` = A right &amp; B wrong, `c` = A wrong &amp; B right. Under `H₀` each disagreement is a coin flip:

```python filename:Python
import numpy as np
from scipy.stats import binomtest

rng = np.random.default_rng(1)
y = rng.integers(0, 2, 1000)
a_right = rng.random(1000) < 0.85                  # model A: ~85% accurate
b_right = np.where(rng.random(1000) < 0.8, a_right, rng.random(1000) < 0.90)   # B: correlated with A, slightly better

b = int(np.sum(a_right & ~b_right))
c = int(np.sum(~a_right & b_right))
print(a_right.mean(), b_right.mean(), b, c)        # 0.832 0.841 17 26
print(round(binomtest(b, b + c, 0.5).pvalue, 4))   # 0.2221 ← exact McNemar p-value: B's 9 extra wins could be chance
```

- Across CV folds, a paired t-test on per-fold scores is common but optimistic (folds share training data); the corrected resampled t-test (Nadeau &amp; Bengio) or repeated CV is safer.
- A bootstrap CI of the <strong>difference</strong> in metric (resampling rows, scoring both models on the same resample) is simple and works for any metric.

# Multiple comparisons

```python filename:Python
import numpy as np

print(round(1 - 0.95 ** 20, 3))                    # 0.642 ← P(at least one false positive) in 20 tests at α = 0.05

p = np.array([0.001, 0.008, 0.012, 0.04, 0.2])     # p-values from 5 tests
print((p <= 0.05 / len(p)).tolist())               # [True, True, False, False, False] ← Bonferroni: α / m
m = len(p)                                         # Benjamini–Hochberg (controls the false discovery rate)
order = np.argsort(p)
passed = p[order] <= 0.05 * np.arange(1, m + 1) / m
k = passed.nonzero()[0].max() + 1 if passed.any() else 0
print(sorted(order[:k].tolist()))                  # [0, 1, 2, 3] ← indices of discoveries
```

> [!WARNING] Watch out
>
> Testing many metrics, segments or model variants and reporting only the significant ones (<strong>p-hacking</strong>) guarantees false discoveries. Pre-register the primary metric, correct for multiple tests, and confirm surprises on fresh data.

```question
What is a p-value?

---

The probability of observing data at least as extreme as what we saw, assuming the null hypothesis is true. A small p-value means the data would be surprising under H₀. It is not the probability that H₀ is true, and it says nothing about how big or important the effect is.
```

```question
What are Type I and Type II errors?

---

Type I: rejecting a true null (false positive), controlled by α. Type II: failing to reject a false null (false negative), probability β; power = 1 − β grows with sample size and effect size.
```

```question
How do you know if a new model is significantly better than the old one?

---

Evaluate both on the same held-out data and use a paired method: McNemar's test on disagreements for accuracy, or a bootstrap confidence interval of the metric difference. Make sure the difference is also practically meaningful and confirm with an online A/B test if the model affects users.
```
