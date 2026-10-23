---
id: ffa9fcd3-6b19-71c3-859a-4f4be44f334f
key: topic:ml-ai/types-of-learning
subject: ml-ai
topic: types-of-learning
title: Types of Learning
slug: types-of-learning
order: 1
---

ML problems are grouped by the feedback the learner gets: <strong>labels</strong> (supervised), <strong>no labels</strong> (unsupervised), <strong>a few labels</strong> (semi-supervised), <strong>labels made from the data itself</strong> (self-supervised) or <strong>rewards</strong> (reinforcement learning).

| Type | Training data | Goal | Typical tasks &amp; algorithms |
| --- | --- | --- | --- |
| Supervised | Inputs `X` with labels `y` | Predict `y` for new `X` | Classification, regression — linear/logistic regression, trees, SVM, boosting |
| Unsupervised | Inputs `X` only | Find structure | Clustering (k-means, DBSCAN), dimensionality reduction (PCA), anomaly detection |
| Semi-supervised | Few labelled + many unlabelled rows | Use unlabelled data to improve a supervised model | Self-training, label propagation |
| Self-supervised | Raw data; labels created from the data (the next word, a masked patch) | Learn general representations | Pre-training language and vision models |
| Reinforcement | States, actions, rewards from an environment | A policy maximising cumulative reward | Game playing, robotics, recommendations as sequential decisions |

# Supervised vs unsupervised on the same data

The iris dataset has 150 flowers of 3 species. A classifier learns from the species labels; k-means never sees them but still finds groups that largely match them:

```python filename:Python
from sklearn.cluster import KMeans
from sklearn.datasets import load_iris
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import adjusted_rand_score

X, y = load_iris(return_X_y=True)

clf = LogisticRegression(max_iter=1000).fit(X, y)                 # supervised: uses y
print(clf.predict(X[[0, 50, 100]]))                               # [0 1 2] ← species 0, 1, 2

km = KMeans(n_clusters=3, n_init=10, random_state=0).fit(X)       # unsupervised: never sees y
print(km.labels_[[0, 50, 100]])                                   # [1 0 2] ← cluster ids are arbitrary names
print(round(adjusted_rand_score(y, km.labels_), 2))               # 0.73 ← 1.0 = perfect match, ≈0 = random; versicolor/virginica overlap
```

# Supervised: classification vs regression

|  | Classification | Regression |
| --- | --- | --- |
| Target | A category (spam / not spam; cat / dog / bird) | A number (price, temperature, demand) |
| Output | Class label, usually with a probability or score | A real value |
| Loss (training) | Log-loss (cross-entropy), hinge | Squared error, absolute error, Huber |
| Metrics | Accuracy, precision, recall, F1, ROC-AUC, PR-AUC | MAE, RMSE, R² |
| Variants | Binary, multi-class (one of k), multi-label (any subset of k) | Single- or multi-output |

> [!WARNING] Watch out
>
> “Logistic regression” is a <strong>classification</strong> algorithm — the name comes from regressing the log-odds. And a numeric-looking target is not automatically regression: star ratings 1–5 are often better treated as ordered classes.

# Other ways to slice ML

| Distinction | One side | Other side |
| --- | --- | --- |
| Batch vs online | Batch: train on the full dataset, retrain periodically | Online: update incrementally as data arrives (`partial_fit` in `SGDClassifier`, `MultinomialNB`) |
| Model-based vs instance-based | Model-based: learn parameters, then discard the data (linear models) | Instance-based: keep the training data and compare new points to it (k-NN) |
| Parametric vs non-parametric | Parametric: a fixed number of parameters regardless of data size (linear/logistic regression, Naive Bayes) | Non-parametric: complexity grows with the data (k-NN, decision trees, kernel SVMs) |
| Discriminative vs generative | Discriminative: model `P(y &#124; x)` or the boundary directly (logistic regression, SVM) | Generative: model how data is produced, `P(x &#124; y)·P(y)` (Naive Bayes, Gaussian mixtures) |

# Reinforcement learning in one paragraph

An <strong>agent</strong> observes a <strong>state</strong>, takes an <strong>action</strong>, receives a <strong>reward</strong> and a new state from the <strong>environment</strong>, and learns a <strong>policy</strong> (state → action) that maximises total future reward. Unlike supervised learning, nobody gives the correct action — only delayed, scalar feedback — so the agent must balance <strong>exploration</strong> and <strong>exploitation</strong>. Q-learning, MDPs and value iteration are worked through in the <strong>Artificial Intelligence</strong> notes.

```question
Is anomaly detection supervised or unsupervised?

---

Either. With labelled fraud cases it is (heavily imbalanced) supervised classification. Without labels it is unsupervised: model what “normal” looks like and flag points that don't fit (Isolation Forest, one-class SVM). Often a few labels are used only to evaluate an unsupervised detector.
```

```question
What is self-supervised learning and why does it matter?

---

The labels are generated from the data itself — predict the next token, a masked word or a hidden image patch. It needs no human labelling, so it scales to internet-sized data; it is how large language and vision models are pre-trained before being fine-tuned on small labelled datasets.
```

```question
Parametric vs non-parametric — give an example of each.

---

Logistic regression is parametric: one weight per feature no matter how many rows. k-NN is non-parametric: it stores all training points, so its effective complexity grows with the data. Non-parametric models are more flexible but need more data and are slower at prediction time.
```
