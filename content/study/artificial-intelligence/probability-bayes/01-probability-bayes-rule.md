---
id: cf35f540-5d64-7ce6-bf49-fc02eb50d96b
key: topic:artificial-intelligence/probability-bayes
subject: artificial-intelligence
topic: probability-bayes
title: Probability & Bayes' Rule
slug: probability-bayes-rule
order: 1
---

Logic says a sentence is true, false or unknown. Real agents need <em>degrees of belief</em>: a toothache makes a cavity likely, not certain. Probability theory is the calculus of belief, and Bayes' rule is how an agent updates it when evidence arrives.

# Why logic isn't enough

A rule like `Toothache ⇒ Cavity` is wrong (gum disease, abscesses…), and listing every exception fails for three reasons: <strong>laziness</strong> (too many rules), <strong>theoretical ignorance</strong> (medicine has no complete theory) and <strong>practical ignorance</strong> (not every test has been run). Probabilities summarise all of that uncertainty.

# The rules you need

| Rule | Formula |
| --- | --- |
| Conditional probability | `P(a &#124; b) = P(a ∧ b) / P(b)` |
| Product rule | `P(a ∧ b) = P(a &#124; b) · P(b)` |
| Marginalisation (sum out) | `P(a) = Σ_b P(a, b)` |
| Independence | `P(a &#124; b) = P(a)` ⇔ `P(a ∧ b) = P(a)·P(b)` |
| Conditional independence | `P(a ∧ b &#124; c) = P(a &#124; c) · P(b &#124; c)` |
| <strong>Bayes' rule</strong> | `P(cause &#124; effect) = P(effect &#124; cause) · P(cause) / P(effect)` |

With the full joint distribution, <em>any</em> question is answered by summing entries. The textbook dentist domain (Toothache, Cavity, the probe Catches):

```python filename:Python
# full joint distribution P(Toothache, Catch, Cavity)
JOINT = {
    (True, True, True): 0.108, (True, True, False): 0.016,
    (True, False, True): 0.012, (True, False, False): 0.064,
    (False, True, True): 0.072, (False, True, False): 0.144,
    (False, False, True): 0.008, (False, False, False): 0.576,
}
def P(cond):
    return sum(p for (toothache, catch, cavity), p in JOINT.items() if cond(toothache, catch, cavity))

print(round(P(lambda t, c, cav: cav), 3))                     # 0.2 ← prior P(cavity), by marginalising
p_both = P(lambda t, c, cav: cav and t)
print(round(p_both / P(lambda t, c, cav: t), 3))              # 0.6 ← P(cavity | toothache)

# normalisation: compute unnormalised values for each value of the query, then scale to sum to 1
unnorm = [P(lambda t, c, cav: t and cav), P(lambda t, c, cav: t and not cav)]
print([round(x / sum(unnorm), 3) for x in unnorm])             # [0.6, 0.4] ← P(Cavity | toothache) = α ⟨0.12, 0.08⟩
```

> [!WARNING] Watch out
>
> The full joint grows as `2ⁿ` for `n` Boolean variables — 2³⁰ ≈ a billion numbers for just 30 symptoms. Independence and conditional independence (Bayesian networks, next topic) are what make probabilistic reasoning tractable.

# Bayes' rule and the base-rate fallacy

`P(D | +) = P(+ | D) · P(D) / [ P(+ | D) · P(D) + P(+ | ¬D) · P(¬D) ]`

```python filename:Python
prevalence = 0.01           # P(disease)
sensitivity = 0.90          # P(positive | disease)
false_positive = 0.09       # P(positive | no disease)

p_positive = sensitivity * prevalence + false_positive * (1 - prevalence)
posterior = sensitivity * prevalence / p_positive
print(round(p_positive, 4), round(posterior, 3))       # 0.0981 0.092 ← a positive test means only ~9% chance of disease

second = sensitivity * posterior / (sensitivity * posterior + false_positive * (1 - posterior))
print(round(second, 3))                                  # 0.503 ← a second positive: yesterday's posterior is today's prior
```

> [!NOTE] Key point
>
> Most positives come from the 99% of healthy people. Ignoring the prior (the base rate) is the <strong>base-rate fallacy</strong> — a favourite interview question. Bayes' rule is also <em>diagnostic reasoning</em>: we usually know `P(effect | cause)` (how a disease causes symptoms) and want `P(cause | effect)`.

# Naive Bayes

Assume every effect is conditionally independent given the cause: `P(Cause, e₁…eₙ) = P(Cause) · Π P(eᵢ | Cause)`. Wrong in detail, but it needs only `O(n)` numbers and works remarkably well for text classification:

```python filename:Python
from collections import Counter
import math

train = [("win money now", "spam"), ("cheap money offer", "spam"), ("win a cheap prize", "spam"),
         ("meeting at noon", "ham"), ("project meeting notes", "ham"), ("lunch at noon", "ham")]
words = {c: Counter(w for text, lab in train if lab == c for w in text.split()) for c in ("spam", "ham")}
prior = Counter(lab for _, lab in train)
vocab = {w for text, _ in train for w in text.split()}

def log_posterior(text, c):                 # log P(c) + Σ log P(word | c), Laplace smoothing (+1)
    total = sum(words[c].values())
    return math.log(prior[c] / len(train)) + sum(
        math.log((words[c][w] + 1) / (total + len(vocab))) for w in text.split())

print(max(("spam", "ham"), key=lambda c: log_posterior("win cheap money", c)))    # spam
print(max(("spam", "ham"), key=lambda c: log_posterior("noon meeting", c)))       # ham
```

The <strong>Machine Learning</strong> notes cover naive Bayes as a classifier (variants, evaluation); here it matters as the simplest Bayesian network — one cause with independent effects.

```question
State Bayes' rule and explain each term.

---

`P(H | E) = P(E | H) · P(H) / P(E)`. `P(H)` is the prior belief in the hypothesis, `P(E | H)` the likelihood of the evidence if H is true, `P(E)` the total probability of the evidence (a normaliser), and `P(H | E)` the posterior belief after seeing the evidence.
```

```question
A test is 90% sensitive with a 9% false-positive rate; the disease affects 1%. You test positive — what's the probability you have it?

---

About 9%: `0.9 × 0.01 / (0.9 × 0.01 + 0.09 × 0.99) ≈ 0.092`. The low base rate means false positives from healthy people outnumber true positives.
```

```question
Why is naive Bayes called naive?

---

It assumes all features are conditionally independent given the class, which is rarely true (words in an email are correlated). The assumption makes it fast and data-efficient, and classification often stays accurate even when the probabilities themselves are poorly calibrated.
```
