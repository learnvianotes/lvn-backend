---
id: 916feb8a-1cf6-7524-babf-681deef2fd5b
key: topic:ml-ai/data_modeling
subject: ml-ai
topic: data_modeling
title: What Is Machine Learning?
slug: what-is-machine-learning
order: 1
---

Machine learning builds programs that <strong>improve at a task from data</strong> instead of from hand-written rules. You supply examples; a learning algorithm finds the parameters of a model that generalises to examples it has never seen.

> [!INFO]
>
> <strong>Machine learning (Mitchell, 1997)</strong> — a program <em>learns</em> from experience <strong>E</strong> with respect to a task <strong>T</strong> and a performance measure <strong>P</strong> if its performance at T, measured by P, improves with E. Spam filtering: T = label emails, E = emails people marked as spam or not, P = the share of emails labelled correctly.

# Rules vs learning

In traditional programming a person writes the rules. In ML the rules — the model's parameters — are <em>fitted</em> from examples of inputs paired with the right answers.

Data + hand-written rules → Program → Answers

Data + known answers → Learning algorithm → Model (learned rules) → Answers for new data

A tiny example: the algorithm is never told the rule `y = 3x + 2`; it recovers it from 50 noisy examples.

```python filename:Python
import numpy as np
from sklearn.linear_model import LinearRegression

rng = np.random.default_rng(0)
X = rng.uniform(0, 10, size=(50, 1))              # feature: hours studied
y = 3 * X[:, 0] + 2 + rng.normal(0, 1, size=50)   # target: score, with noise

model = LinearRegression().fit(X, y)              # training = fitting parameters
print(round(model.coef_[0], 2), round(model.intercept_, 2))  # 3.05 1.76 ← close to the true 3 and 2
print(round(model.predict([[4.0]])[0], 1))                   # 14.0 ← inference on a new input (true value 14)
```

# The supervised setting

`y = f(x) + ε learn f̂ ≈ f from pairs (x₁, y₁), …, (xₙ, yₙ)`

`f` is the unknown true relationship and `ε` is noise no model can predict (measurement error, missing information). Even a perfect `f̂` keeps the error caused by `ε` — the <strong>irreducible error</strong>. This picture covers supervised learning; unsupervised learning has no `y` at all (see <strong>Types of Learning</strong>).

# Vocabulary

| Term | Meaning | House-price example |
| --- | --- | --- |
| Example / sample / row | One observation | One house sale |
| Feature (input, predictor) `x` | A measurable input variable | Area, bedrooms, distance to metro |
| Label / target `y` | The value to predict (supervised learning only) | Sale price |
| Model | A function `f̂` from features to predictions | `price ≈ w₁·area + w₂·bedrooms + b` |
| Parameters | Learned from data during training | The weights `w₁, w₂, b` |
| Hyperparameters | Chosen <em>before</em> training, tuned on validation data | Regularisation strength, tree depth |
| Training / fitting | Adjusting parameters to reduce a loss on training data | `model.fit(X, y)` |
| Inference / prediction | Applying the trained model to new inputs | `model.predict(X_new)` |
| Generalisation | Performing well on unseen data from the same distribution | Accurate prices for next month's listings |

# AI, ML and deep learning

Artificial Intelligence → Machine Learning → Deep Learning

| Field | What it is | Example |
| --- | --- | --- |
| Artificial intelligence | Any technique that makes machines act intelligently — including search, logic and planning that learn nothing from data | A route planner using A\* search |
| Machine learning | The part of AI that learns behaviour from data | Gradient-boosted trees predicting customer churn |
| Deep learning | ML with many-layered neural networks that learn their own features from raw data | A transformer transcribing speech |

> [!NOTE] Key point
>
> These notes cover classic ML on mostly tabular data. Neural networks are covered in <strong>Deep Learning</strong>, LLMs and prompting in <strong>Generative AI</strong>, search/logic/planning in <strong>Artificial Intelligence</strong>, and NumPy/pandas/plotting in <strong>Data Science</strong>.

# When ML is — and isn't — the right tool

> [!TIP] Do
>
> Use ML when rules are too many or unknown (spam, fraud, images), the patterns change over time, there is enough representative data, and occasional errors are acceptable.

> [!DANGER] Avoid
>
> Using ML when a few clear rules work, when there is no data (or no labels) to learn from, when every decision must be exactly explainable and guaranteed, or when a wrong answer is catastrophic and cannot be caught.

# The workflow at a glance

Frame the problem → Collect &amp; explore data → Split train / validation / test → Prepare features → Train a baseline, then better models → Tune &amp; validate → Test once → Deploy &amp; monitor

Each box has its own topic in these notes. The split comes <em>before</em> any preprocessing is fitted, and the test set is used once at the end — breaking either rule causes <strong>data leakage</strong>.

```question
What is the difference between a parameter and a hyperparameter?

---

Parameters are learned from the training data (regression weights, tree split thresholds). Hyperparameters are set before training and control <em>how</em> learning happens (learning rate, `max_depth`, regularisation strength `C`); they are chosen by comparing models on validation data or with cross-validation.
```

```question
What does it mean for a model to generalise?

---

It performs about as well on new data from the same distribution as on the data it was trained on. We estimate this with held-out data the model never saw during training or tuning. A model that is excellent on training data but poor on held-out data has overfit.
```

```question
How is ML different from traditional programming?

---

Traditional programs apply rules a developer wrote. ML programs apply rules (parameters) that an algorithm <em>fitted</em> from examples, so behaviour comes from the data — which is also why data quality, representativeness and leakage matter so much.
```
