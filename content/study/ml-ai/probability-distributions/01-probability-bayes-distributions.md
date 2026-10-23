---
id: b8972140-a0c7-778a-b8df-cea79e0800f0
key: topic:ml-ai/probability-distributions
subject: ml-ai
topic: probability-distributions
title: Probability, Bayes & Distributions
slug: probability-bayes-distributions
order: 1
---

ML models are statistical models. A handful of probability ideas — conditional probability, Bayes' rule, common distributions, the central limit theorem and maximum likelihood — explain most of what they do.

# Rules you use constantly

| Rule | Formula |
| --- | --- |
| Conditional probability | `P(A &#124; B) = P(A ∩ B) / P(B)` |
| Independence | `P(A ∩ B) = P(A)·P(B)` ⇔ `P(A &#124; B) = P(A)` |
| Addition | `P(A ∪ B) = P(A) + P(B) − P(A ∩ B)` |
| Total probability | `P(B) = Σᵢ P(B &#124; Aᵢ)·P(Aᵢ)` for a partition `A₁, A₂, …` |
| Bayes' rule | `P(A &#124; B) = P(B &#124; A)·P(A) / P(B)` |

# Bayes' rule and the base-rate fallacy

A disease affects 1% of people. A test catches 99% of cases (sensitivity) and correctly clears 95% of healthy people (specificity). Given a positive test, how likely is the disease?

```python filename:Python
prior = 0.01                 # P(disease)
sens = 0.99                  # P(+ | disease)
fpr = 1 - 0.95               # P(+ | healthy)

p_pos = sens * prior + fpr * (1 - prior)          # total probability of a positive test
posterior = sens * prior / p_pos                  # Bayes' rule
print(round(p_pos, 4), round(posterior, 3))       # 0.0594 0.167 ← only about 1 in 6 positives is sick
```

Most positives come from the huge healthy group. This is exactly why <strong>precision</strong> collapses on rare classes even for an accurate classifier — and why the base rate must be part of any threshold decision.

# Describing data

| Statistic | Definition | Note |
| --- | --- | --- |
| Mean | `Σx / n` | Sensitive to outliers |
| Median | Middle value | Robust to outliers and skew |
| Variance (population) | `Σ(x − μ)² / n` | Average squared deviation |
| Variance (sample) | `Σ(x − x̄)² / (n − 1)` | Bessel's correction — unbiased estimate of the population variance |
| Standard deviation | √variance | Same units as the data |
| Covariance / correlation | `cov(X, Y)`; `ρ = cov / (σ_X σ_Y)` | Correlation is unitless, −1 … 1, linear only |

```python filename:Python
import numpy as np
import pandas as pd

x = np.array([2.0, 4.0, 4.0, 4.0, 5.0, 5.0, 7.0, 9.0])
print(x.mean(), np.median(x))                      # 5.0 4.5
print(np.var(x), round(np.var(x, ddof=1), 4))      # 4.0 4.5714 ← NumPy default ddof=0 (population)
print(round(pd.Series(x).var(), 4))                # 4.5714 ← pandas default ddof=1 (sample) — a classic mismatch
```

# Common distributions

| Distribution | Models | Mean | Variance | ML example |
| --- | --- | --- | --- | --- |
| Bernoulli(p) | One yes/no trial | `p` | `p(1 − p)` | A single click; logistic regression's likelihood |
| Binomial(n, p) | Successes in n trials | `np` | `np(1 − p)` | Conversions out of n visitors |
| Poisson(λ) | Counts of rare events in an interval | `λ` | `λ` | Orders per hour, defects per batch |
| Uniform(a, b) | Equally likely values | `(a + b)/2` | `(b − a)²/12` | Random search, initialisation |
| Normal(μ, σ²) | Sums of many small effects | `μ` | `σ²` | Measurement noise; linear-regression errors |
| Exponential(λ) | Waiting time between Poisson events | `1/λ` | `1/λ²` | Time between requests |
| Log-normal | Products of many effects; positive, right-skewed | — | — | Incomes, prices, session lengths (log them) |

```python filename:Python
from scipy import stats

print(round(stats.binom.pmf(3, n=10, p=0.2), 4))                  # 0.2013 ← P(exactly 3 conversions of 10)
print(round(stats.poisson.pmf(0, mu=2), 4))                        # 0.1353 ← P(no orders in an hour | 2 per hour on average)
print([round(float(stats.norm.cdf(k) - stats.norm.cdf(-k)), 4) for k in (1, 2, 3)])   # [0.6827, 0.9545, 0.9973] ← the 68–95–99.7 rule
print(round(stats.norm.ppf(0.975), 3))                             # 1.96 ← z for a two-sided 95% interval
```

# Central limit theorem

> [!INFO]
>
> <strong>Central limit theorem</strong> — for <strong>independent, identically distributed</strong> observations with <strong>finite variance</strong> σ², the distribution of the sample mean approaches a normal distribution with mean μ and standard deviation σ/√n as n grows — whatever the shape of the original distribution.

`standard error of the mean = σ / √n`

```python filename:Python
import numpy as np
from scipy.stats import skew

rng = np.random.default_rng(0)
data = rng.exponential(scale=1.0, size=(10000, 50))    # very skewed: mean 1, sd 1
means = data.mean(axis=1)                              # 10,000 sample means, n = 50 each

print(round(skew(data.ravel()), 2), round(skew(means), 2))   # 2.02 0.31 ← raw skew ≈ 2; means nearly symmetric
print(round(means.mean(), 3), round(means.std(), 3), round(1 / np.sqrt(50), 3))   # 0.999 0.143 0.141 ← sd of means ≈ σ/√n
```

> [!WARNING] Watch out
>
> The CLT is about <strong>means</strong> (and sums), not the data: it does not make your features normal. It needs finite variance (it fails for the Cauchy distribution) and independent observations; how large n must be depends on the skew — 30 is folklore, not a law.

The <strong>law of large numbers</strong> is the simpler cousin: sample averages converge to the expected value. Together they justify confidence intervals, A/B tests and cross-validation averages.

# Maximum likelihood — where loss functions come from

Maximum likelihood estimation picks the parameters under which the observed data is most probable. Two famous consequences: assuming Gaussian noise, maximising the likelihood of a regression model is exactly <strong>minimising squared error</strong>; assuming Bernoulli labels, it is exactly <strong>minimising log-loss</strong> (logistic regression).

```python filename:Python
import numpy as np
from scipy.optimize import minimize_scalar

flips = np.array([1, 0, 1, 1, 0, 1, 1, 1, 0, 1])          # 7 heads in 10
nll = lambda p: -np.sum(flips * np.log(p) + (1 - flips) * np.log(1 - p))   # negative log-likelihood = log-loss × n
best = minimize_scalar(nll, bounds=(0.01, 0.99), method="bounded")
print(round(best.x, 3), flips.mean())                     # 0.7 0.7 ← the MLE of p is the sample proportion
```

```question
What is Bayes' theorem and why does it matter in ML?

---

`P(A|B) = P(B|A)P(A)/P(B)`: it updates a prior belief with evidence. It underlies Naive Bayes, Bayesian inference and the base-rate reasoning behind precision on rare classes — a 99%-sensitive test for a 1%-prevalence disease still gives mostly false positives.
```

```question
State the central limit theorem.

---

For i.i.d. samples with finite variance, the sampling distribution of the mean tends to a normal distribution with mean μ and standard deviation σ/√n as n grows, regardless of the population's shape. It justifies normal-based confidence intervals and tests for means and proportions.
```

```question
Why divide by n − 1 for the sample variance?

---

Deviations are measured from the sample mean, which is itself fitted to the data, so they are on average too small; dividing by n − 1 (one degree of freedom used by the mean) makes the variance estimate unbiased.
```
