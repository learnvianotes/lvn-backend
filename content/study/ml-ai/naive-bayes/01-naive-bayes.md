---
id: 59aeb46d-2f6b-75d3-b180-c924beb715a7
key: topic:ml-ai/naive-bayes
subject: ml-ai
topic: naive-bayes
title: Naive Bayes
slug: naive-bayes
order: 1
---

Naive Bayes applies Bayes' rule with one strong simplification — features are <strong>independent given the class</strong> — which makes it extremely fast and surprisingly good for text.

`P(y | x₁, …, xₚ) ∝ P(y) · P(x₁ | y) · P(x₂ | y) · … · P(xₚ | y)`

Pick the class with the largest right-hand side. `P(y)` is the class frequency; each `P(xᵢ | y)` is estimated separately from the training data — that's why training is a single counting pass.

| Variant | Feature model | Use for |
| --- | --- | --- |
| `MultinomialNB` | Word counts / frequencies | Text classification (bag-of-words, TF-IDF) |
| `ComplementNB` | Like multinomial, estimated from the complement of each class | Imbalanced text classes |
| `BernoulliNB` | Binary present/absent features | Short texts, binary flags |
| `GaussianNB` | Each feature normal within each class | Continuous features |
| `CategoricalNB` | Categorical features | Label-encoded categories |

# Worked example: spam

Two spam and two ham messages; classify “free money meeting”. With Laplace smoothing (`α = 1`), `P(word | class) = (count + 1) / (words in class + vocabulary size)`. Each class has 5 words and the vocabulary has 7:

```python filename:Python
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.naive_bayes import MultinomialNB

docs = ["free money now", "free prize", "meeting now", "project meeting notes"]
labels = ["spam", "spam", "ham", "ham"]

# by hand: prior 0.5 each; counts of free, money, meeting in each class
spam = 0.5 * (2 + 1) / 12 * (1 + 1) / 12 * (0 + 1) / 12
ham = 0.5 * (0 + 1) / 12 * (0 + 1) / 12 * (2 + 1) / 12
print(round(spam / (spam + ham), 3))            # 0.667 ← P(spam | "free money meeting")

vec = CountVectorizer()
nb = MultinomialNB(alpha=1.0).fit(vec.fit_transform(docs), labels)
print(nb.classes_, nb.predict_proba(vec.transform(["free money meeting"])).round(3))   # ['ham' 'spam'] [[0.333 0.667]]
```

# Two practical details

- <strong>Zero-frequency problem</strong> — without smoothing, “meeting” never appeared in spam, so `P(meeting | spam) = 0` and one unseen word wipes out all other evidence. Laplace/additive smoothing (`alpha`) adds a pseudo-count to every word.
- <strong>Log space</strong> — multiplying hundreds of small probabilities underflows to 0, so implementations sum log-probabilities instead.

# Gaussian Naive Bayes

`P(xᵢ | y) = (1 / √(2πσ²ᵧᵢ)) · exp(−(xᵢ − μᵧᵢ)² / (2σ²ᵧᵢ))`

```python filename:Python
from sklearn.datasets import load_wine
from sklearn.model_selection import cross_val_score
from sklearn.naive_bayes import GaussianNB

X, y = load_wine(return_X_y=True)
print(round(cross_val_score(GaussianNB(), X, y, cv=5).mean(), 3))   # 0.966 ← no scaling or tuning needed
```

> [!TIP] Do
>
> Use for text classification, very large or streaming data (`partial_fit`), tiny training sets, and as a fast baseline.

> [!DANGER] Avoid
>
> Trust its probabilities — correlated features are counted as independent evidence, so outputs are pushed toward 0 and 1 (calibrate them if you need probabilities). Expect it to learn feature interactions.

The <strong>Data Science</strong> notes build a full TF-IDF + Naive Bayes text classifier.

```question
Why is Naive Bayes called naive?

---

It assumes all features are conditionally independent given the class, which is almost never true (words like “New” and “York” co-occur). The assumption makes estimation trivial, and classification often still works because only the ranking of class scores matters, not their exact values.
```

```question
What is Laplace smoothing?

---

Adding a pseudo-count (usually 1) to every feature count per class so no conditional probability is exactly zero. Otherwise a single word unseen in a class during training would force that class's probability to zero for any document containing it.
```
