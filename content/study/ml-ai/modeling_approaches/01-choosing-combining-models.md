---
id: ee74949e-67a2-7298-b7ef-3dfabb2a4372
key: topic:ml-ai/modeling_approaches
subject: ml-ai
topic: modeling_approaches
title: Choosing & Combining Models
slug: choosing-combining-models
order: 1
---

There is no single best algorithm (the “no free lunch” theorem) — but there are good defaults. Start simple, compare candidates with the same cross-validation, and combine models when it pays.

| Algorithm | Boundary / shape | Scaling needed | Interpretability | Good for | Weak spots |
| --- | --- | --- | --- | --- | --- |
| Linear / logistic regression | Linear | Yes (when regularised) | High (coefficients) | Baselines, high-dimensional sparse data, probabilities | Non-linear effects unless engineered |
| k-NN | Any (local) | Yes | Medium (show neighbours) | Small, low-dimensional data | Slow predictions, high dimensions |
| Naive Bayes | Linear-ish | No | Medium | Text, tiny data, speed | Correlated features, poor probabilities |
| SVM (RBF) | Any (smooth) | Yes | Low | Small/medium data, many features | Large n, needs tuning, no native probabilities |
| Decision tree | Axis-aligned steps | No | High (rules) | Explanations, rules | High variance |
| Random forest | Axis-aligned, averaged | No | Medium | Strong default for tabular data | Size, extrapolation |
| Gradient boosting | Axis-aligned, additive | No | Medium | Best accuracy on most tabular problems | Tuning, overfits without early stopping |
| Neural networks | Any | Yes | Low | Images, audio, text, very large data | Data-hungry, tuning, compute |

# A practical order of attack

1. <strong>Baseline</strong>

   `DummyClassifier` / `DummyRegressor` and any existing business rule.

2. <strong>Simple model</strong>

   Regularised linear or logistic regression in a pipeline — fast, often surprisingly strong, and a sanity check for leakage.

3. <strong>Tree ensemble</strong>

   Random forest, then gradient boosting (HistGradientBoosting / LightGBM / XGBoost) with early stopping.

4. <strong>Unstructured data</strong>

   Pretrained deep models (fine-tuning or embeddings) — see <strong>Deep Learning</strong> and <strong>Generative AI</strong>.

5. <strong>Pick with constraints</strong>

   Accuracy is one criterion; latency, memory, interpretability, calibration and maintenance matter too.

# Compare candidates fairly

```python filename:Python
from sklearn.datasets import load_breast_cancer
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC

X, y = load_breast_cancer(return_X_y=True)
cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=0)      # same folds for every model
candidates = {
    "logistic": make_pipeline(StandardScaler(), LogisticRegression()),
    "knn": make_pipeline(StandardScaler(), KNeighborsClassifier()),
    "svc": make_pipeline(StandardScaler(), SVC()),
    "random forest": RandomForestClassifier(random_state=0),
    "hist gboost": HistGradientBoostingClassifier(random_state=0),
}
for name, model in candidates.items():
    s = cross_val_score(model, X, y, cv=cv, scoring="roc_auc")
    print(f"{name:14} {s.mean():.3f} ± {s.std():.3f}")
```

```text filename:Output
logistic       0.995 ± 0.006
knn            0.981 ± 0.009
svc            0.996 ± 0.005
random forest  0.992 ± 0.007
hist gboost    0.994 ± 0.005
```

On this small, clean dataset the linear model is as good as anything — a reminder to always try the simple option. Differences inside one standard deviation are usually noise (see <strong>Hypothesis Tests &amp; Significance</strong> for proper comparisons).

# Voting and stacking

| Method | How | Notes |
| --- | --- | --- |
| Hard voting | Majority of predicted labels | Simple; ignores confidence |
| Soft voting | Average predicted probabilities | Usually better; needs reasonably calibrated models |
| Stacking | A meta-model learns how to combine base models' <strong>out-of-fold</strong> predictions | Most flexible; base models should be diverse |

```python filename:Python
from sklearn.datasets import make_classification
from sklearn.ensemble import RandomForestClassifier, StackingClassifier, VotingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import cross_val_score
from sklearn.naive_bayes import GaussianNB
from sklearn.neighbors import KNeighborsClassifier

X, y = make_classification(n_samples=600, n_features=20, n_informative=6, random_state=1)
base = [("lr", LogisticRegression()), ("rf", RandomForestClassifier(random_state=0)),
        ("knn", KNeighborsClassifier()), ("nb", GaussianNB())]

for name, est in base:
    print(name, round(cross_val_score(est, X, y, cv=5).mean(), 3))
vote = VotingClassifier(base, voting="soft")
stack = StackingClassifier(base, final_estimator=LogisticRegression(), cv=5)
print("soft vote", round(cross_val_score(vote, X, y, cv=5).mean(), 3))
print("stacking", round(cross_val_score(stack, X, y, cv=5).mean(), 3))
```

```text filename:Output
lr 0.95
rf 0.937
knn 0.937
nb 0.915
soft vote 0.95
stacking 0.957
```

> [!WARNING] Watch out
>
> Stacking must train the meta-model on <strong>out-of-fold</strong> predictions (`StackingClassifier` does this with its internal `cv`). Training it on predictions the base models made for their own training rows leaks — the meta-model learns to trust overfit models.

# From ML to neural networks

Logistic regression <em>is</em> a one-neuron network: weighted sum → sigmoid → log-loss. A multi-layer perceptron stacks layers of such units with non-linear activations, so it can learn non-linear boundaries and its own features:

```python filename:Python
from sklearn.datasets import make_moons
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import cross_val_score
from sklearn.neural_network import MLPClassifier

X, y = make_moons(n_samples=400, noise=0.2, random_state=0)
print(round(cross_val_score(LogisticRegression(), X, y, cv=5).mean(), 3))    # 0.875 ← one linear boundary
mlp = MLPClassifier(hidden_layer_sizes=(16, 16), max_iter=3000, random_state=0)
print(round(cross_val_score(mlp, X, y, cv=5).mean(), 3))                     # 0.948 ← hidden layers bend the boundary
```

For anything beyond small experiments, neural networks are built in PyTorch or similar — backpropagation, optimisers, CNNs, RNNs and transformers are covered in <strong>Deep Learning</strong>.

```question
How would you choose a model for a tabular classification problem?

---

Establish a dummy baseline, then a regularised logistic regression pipeline, then a tree ensemble (random forest, then gradient boosting with early stopping). Compare them with the same stratified CV folds on the metric that matters, check calibration and latency, and prefer the simpler model when the difference is within noise.
```

```question
What is stacking and how do you avoid leakage in it?

---

A meta-model learns to combine the predictions of several base models. Its training inputs must be out-of-fold predictions (each row predicted by base models that didn't train on it); otherwise it learns from over-optimistic in-sample predictions.
```

```question
What does the no-free-lunch theorem say?

---

Averaged over all possible problems, no learning algorithm beats any other. Every algorithm's success comes from assumptions that match the problem at hand — which is why we compare candidates empirically on our own data.
```
