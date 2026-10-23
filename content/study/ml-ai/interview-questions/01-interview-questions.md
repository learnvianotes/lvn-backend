---
id: babfaa9a-771f-7149-9448-b0d7c8c4d4aa
key: topic:ml-ai/interview-questions
subject: ml-ai
topic: interview-questions
title: Interview Questions
slug: interview-questions
order: 1
---

Short, precise answers to the machine-learning questions asked most often — each points back to the topic that explains it in depth.

# Fundamentals

```question
What is the difference between supervised, unsupervised and reinforcement learning?

---

Supervised learns a mapping from inputs to known labels (classification, regression). Unsupervised finds structure without labels (clustering, dimensionality reduction). Reinforcement learning learns a policy from rewards received by acting in an environment. (See <strong>Types of Learning</strong>.)
```

```question
What is overfitting and how do you prevent it?

---

The model learns noise in the training data, so training error is low but validation error is high. Prevent it with more data, simpler models, regularisation (L1/L2, pruning, early stopping), feature selection, bagging, and by validating properly with held-out data or cross-validation.
```

```question
Explain the bias–variance trade-off.

---

Expected error = bias² + variance + irreducible noise. Simple models have high bias and low variance (underfit); flexible models the reverse (overfit). Model complexity is tuned to minimise the sum, using validation data. (See <strong>Bias–Variance &amp; Overfitting</strong>.)
```

```question
Why do we split data into train, validation and test sets?

---

Train fits parameters, validation guides choices (hyperparameters, features, threshold), and the untouched test set gives an unbiased final estimate. Using the test set for choices makes its score optimistic.
```

```question
What is cross-validation and when would you use GroupKFold or TimeSeriesSplit?

---

Rotating held-out folds to estimate performance more reliably. GroupKFold when several rows belong to the same entity (patient, user) so an entity never appears on both sides; TimeSeriesSplit when data is time-ordered so models are always validated on the future.
```

```question
What is data leakage? Give two examples.

---

Information unavailable at prediction time influencing training or evaluation. Examples: scaling or selecting features on the full dataset before splitting; a feature derived from the target (e.g. `refund_issued` for fraud); the same customer in train and test. (See <strong>Data Leakage</strong>.)
```

# Algorithms

```question
How does logistic regression work?

---

It computes a linear score `w·x + b` and passes it through the sigmoid to get P(y = 1). It's trained by minimising log-loss (maximum likelihood), a convex problem. The decision boundary is linear; coefficients are changes in log-odds.
```

```question
L1 vs L2 regularisation?

---

L1 (Lasso) adds `α·Σ|w|` and drives many weights exactly to zero — built-in feature selection. L2 (Ridge) adds `α·Σw²` and shrinks weights smoothly, handling correlated features well. Elastic Net combines them. Scale features first.
```

```question
How does a decision tree choose splits, and why do trees overfit?

---

Greedily, by the largest impurity decrease (Gini/entropy for classification, squared error for regression). Grown without limits a tree isolates individual points; limit depth or leaf size, prune, or use ensembles.
```

```question
Random forest vs gradient boosting?

---

A random forest averages many deep trees trained independently on bootstrap samples with random feature subsets — it reduces variance, is robust and needs little tuning. Gradient boosting adds shallow trees sequentially, each fitting the gradient of the loss of the current ensemble — it reduces bias and is usually more accurate but needs a learning rate and early stopping to avoid overfitting.
```

```question
How do SVMs work? What is the kernel trick?

---

An SVM finds the hyperplane with the maximum margin; soft margins trade margin width against violations via `C`. The kernel trick replaces dot products with a kernel function, giving non-linear boundaries as if the data were mapped to a higher-dimensional space.
```

```question
How does k-NN work and what are its weaknesses?

---

It predicts from the k nearest training points (vote or average). No training, but slow predictions, needs feature scaling, and suffers from irrelevant features and the curse of dimensionality.
```

```question
Why is Naive Bayes naive, and why does it still work?

---

It assumes features are conditionally independent given the class. The probabilities it outputs are poorly calibrated, but the ranking of classes is often right, so classification works well — especially for text.
```

```question
How does k-means work and what are its assumptions?

---

Alternately assign points to the nearest centroid and recompute centroids, minimising within-cluster squared distances. Assumes roughly spherical, similarly sized clusters and meaningful Euclidean distances; needs k, scaling and several initialisations.
```

```question
What is PCA and why scale before it?

---

PCA projects data onto orthogonal directions of maximum variance (eigenvectors of the covariance matrix). Without scaling, features with large units dominate the variance and therefore the components.
```

# Evaluation

```question
Precision vs recall — when do you favour each?

---

Precision = TP/(TP+FP): favour it when false alarms are costly (spam filtering). Recall = TP/(TP+FN): favour it when misses are costly (disease screening, fraud). The threshold moves you along the trade-off.
```

```question
ROC-AUC vs PR-AUC?

---

ROC plots TPR vs FPR; its AUC is the probability a random positive is ranked above a random negative (0.5 = random). PR plots precision vs recall; its baseline is the positive prevalence, so it's more informative for rare positives.
```

```question
Can R² be negative?

---

Yes — when predictions are worse than always predicting the mean of the true values, e.g. on test data after overfitting.
```

```question
How do you handle imbalanced data?

---

Right metric (PR-AUC, recall at precision, cost), stratified splits, threshold tuning, class weights, resampling inside training folds only, more positive data; recalibrate probabilities afterwards. (See <strong>Imbalanced Data</strong>.)
```

```question
What is model calibration and how do you check it?

---

A model is calibrated if events predicted with probability p happen about p of the time. Check with a reliability diagram, Brier score or log-loss; fix with Platt scaling or isotonic regression via `CalibratedClassifierCV`.
```

```question
How would you compare two models statistically?

---

On the same test rows: McNemar's test on disagreements, or a bootstrap confidence interval of the metric difference; across CV folds a corrected paired t-test. Also ask whether the difference is practically meaningful.
```

# Features &amp; data

```question
How do you handle missing values?

---

Understand why they're missing (MCAR/MAR/MNAR). Options: drop, impute (median/most-frequent, KNN, iterative), add missing-indicator columns, or use models that handle NaN natively. Fit imputers on training data inside the pipeline.
```

```question
One-hot vs label (ordinal) encoding?

---

One-hot for nominal categories so no false order is implied; ordinal codes for truly ordered categories (and acceptable for tree models). High cardinality → target encoding with cross-fitting, hashing or embeddings.
```

```question
Which models need feature scaling?

---

Distance- and gradient-based or regularised models: k-NN, k-means, SVM, PCA, regularised linear/logistic regression, neural networks. Tree-based models don't.
```

```question
What is the curse of dimensionality?

---

As dimensions grow, data becomes sparse and distances concentrate, so neighbourhoods stop being local and much more data is needed. It hurts distance-based methods most; use feature selection, dimensionality reduction or more data.
```

# Production &amp; responsible AI

```question
What is concept drift vs data drift?

---

Data (covariate) drift: P(X) changes. Label shift: P(y) changes. Concept drift: P(y|X) changes, so the learned relationship is outdated. Monitor inputs, predictions and delayed outcomes; retrain on recent data.
```

```question
What is training–serving skew?

---

Features computed differently in training and in production (different code, freshness or bugs), so the model receives inputs unlike its training data. Prevent with shared pipelines or a feature store and by comparing logged production features with training data.
```

```question
How do you explain a black-box model's predictions?

---

Globally with permutation importance and partial dependence; locally with SHAP (additive Shapley attributions) or LIME; counterfactuals for “what would change the decision”. Remember explanations describe the model, not causality.
```

```question
How do you measure fairness?

---

Compute metrics per group: selection rate (demographic parity), TPR (equal opportunity), TPR and FPR (equalized odds), precision and calibration. Differing base rates make some criteria mutually incompatible, so choose based on the application and document the trade-off.
```

# Beyond classic ML

```question
When would you use deep learning instead of classic ML?

---

For unstructured data (images, audio, text), very large datasets, or when a pretrained model can be fine-tuned. For small or medium tabular data, gradient-boosted trees are usually as good or better with less effort. (See <strong>Deep Learning</strong>.)
```

```question
What is the relationship between logistic regression and a neural network?

---

Logistic regression is a single neuron with a sigmoid activation trained with log-loss. Neural networks stack many such units with non-linear activations, learning intermediate features, and are trained with backpropagation and gradient descent.
```
