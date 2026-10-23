---
id: 5c474e66-4e66-71a0-984f-a2f4554adfcc
key: topic:ml-ai/ab-testing
subject: ml-ai
topic: ab-testing
title: A/B Testing
slug: a-b-testing
order: 1
---

Offline metrics say a model <em>should</em> help; an A/B test measures whether it <em>does</em>. Users are randomly split between the current system (A, control) and the new one (B, treatment), and a pre-chosen metric is compared.

1. <strong>Hypothesis &amp; metric</strong>

   One primary metric (conversion, revenue per user), plus guardrail metrics that must not get worse (latency, complaints).

2. <strong>Randomisation unit</strong>

   Usually the user (not the page view), so one person sees one variant consistently.

3. <strong>Sample size</strong>

   Power analysis from the baseline rate, the minimum detectable effect (MDE), α and power.

4. <strong>Run</strong>

   For the planned duration — whole weeks to cover weekly cycles — without stopping early on a good-looking day.

5. <strong>Check sanity</strong>

   Sample-ratio mismatch (did the 50/50 split really come out 50/50?), logging, novelty effects.

6. <strong>Analyse &amp; decide</strong>

   Effect size with a confidence interval, not just a p-value; ship, iterate or roll back.

# How many users?

`n per group ≈ (z₁₋α/₂ + z₁₋β)² · [p₁(1 − p₁) + p₂(1 − p₂)] / (p₁ − p₂)²`

```python filename:Python
from scipy.stats import norm

p1, p2 = 0.10, 0.11                                   # baseline 10%, want to detect +1 point
alpha, power = 0.05, 0.80
z = norm.ppf(1 - alpha / 2) + norm.ppf(power)
n = z ** 2 * (p1 * (1 - p1) + p2 * (1 - p2)) / (p1 - p2) ** 2
print(round(norm.ppf(1 - alpha / 2), 3), round(norm.ppf(power), 3))   # 1.96 0.842
print(round(n))                                       # 14748 ← users per group
```

Halving the detectable effect quadruples the required sample (n ∝ 1/Δ²). Small effects on rare events need a lot of traffic.

# Analysing a conversion test

```python filename:Python
import numpy as np
from scipy.stats import norm

conv_a, n_a = 1200, 10000
conv_b, n_b = 1290, 10000
pa, pb = conv_a / n_a, conv_b / n_b

pooled = (conv_a + conv_b) / (n_a + n_b)                       # under H0 both rates are equal
se0 = np.sqrt(pooled * (1 - pooled) * (1 / n_a + 1 / n_b))
z = (pb - pa) / se0
p_value = 2 * (1 - norm.cdf(abs(z)))
print(round(pb - pa, 4), round(z, 3), round(p_value, 4))       # 0.009 1.928 0.0539

se = np.sqrt(pa * (1 - pa) / n_a + pb * (1 - pb) / n_b)       # unpooled SE for the interval
print([round(float(pb - pa - 1.96 * se), 4), round(float(pb - pa + 1.96 * se), 4)])   # [-0.0002, 0.0182] ← 95% CI of the lift
```

Here p ≈ 0.05 and the interval barely touches 0: the lift is plausible but uncertain — a case for the pre-planned sample size, not for declaring victory.

# Why you must not peek

Checking the p-value every day and stopping at the first p &lt; 0.05 inflates the false-positive rate far above 5%. Simulated A/A tests (no real difference) checked 20 times each:

```python filename:Python
import numpy as np
from scipy.stats import norm

rng = np.random.default_rng(0)
sims, looks, batch, p = 2000, 20, 500, 0.10
a = rng.binomial(batch, p, size=(sims, looks)).cumsum(axis=1)     # both arms identical
b = rng.binomial(batch, p, size=(sims, looks)).cumsum(axis=1)
n = batch * np.arange(1, looks + 1)
pooled = (a + b) / (2 * n)
z = (b - a) / n / np.sqrt(pooled * (1 - pooled) * 2 / n)
significant = np.abs(z) > norm.ppf(0.975)

print(round(significant[:, -1].mean(), 3))        # 0.048 ← analyse once at the end: ≈ 5% false positives
print(round(significant.any(axis=1).mean(), 3))   # 0.241 ← stop at the first significant peek: far above 5%
```

If you need to monitor continuously, use a method designed for it: sequential tests with alpha spending, always-valid p-values, or Bayesian decision rules with a pre-set stopping criterion.

# Common pitfalls

| Pitfall | What goes wrong | Remedy |
| --- | --- | --- |
| Sample-ratio mismatch | Assignment or logging bug biases the groups | Chi-square test on group sizes before analysing |
| Novelty / primacy effects | Users react to <em>change</em>, not to quality | Run longer; look at the effect over time |
| Interference / network effects | Treated users affect control users (marketplaces, social) | Cluster or switchback randomisation |
| Many metrics &amp; segments | Some will be “significant” by chance | One primary metric; correct for multiple tests |
| Unit mismatch | Randomise by user but analyse per page view → underestimated variance | Analyse at the randomisation unit (or use the delta method) |
| Seasonality | A holiday week isn't typical | Whole weeks; avoid unusual periods |

Offline evaluation is still the first filter: A/B tests are slow and expensive. Interleaving (for rankers) and multi-armed bandits (which shift traffic toward the better variant while learning) are common complements.

```question
How would you A/B test a new recommendation model?

---

Randomise users 50/50 into the current and the new model; choose one primary metric (e.g. watch time or purchases per user) and guardrails (latency, diversity, complaints); size the test with a power analysis for the smallest lift worth shipping; run whole weeks; check sample-ratio mismatch; then report the lift with a confidence interval and decide.
```

```question
Why is peeking at A/B test results a problem?

---

Each look is another chance for noise to cross the significance threshold. Stopping at the first significant look turns a 5% false-positive rate into something like 20–30% with many looks. Fix the sample size in advance, or use sequential methods built for continuous monitoring.
```

```question
The test shows p = 0.03 but a +0.1% lift. Ship it?

---

Statistically significant isn't necessarily meaningful. Compare the lift and its confidence interval with the cost of shipping and maintaining the change, check guardrails and segment consistency, and consider whether it was the pre-registered primary metric.
```
