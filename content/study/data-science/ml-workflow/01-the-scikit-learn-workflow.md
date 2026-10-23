---
id: 30fb3e65-b938-73e7-915e-8f095168acc8
key: topic:data-science/ml-workflow
subject: data-science
topic: ml-workflow
title: The scikit-learn Workflow
slug: the-scikit-learn-workflow
order: 1
---

Every scikit-learn model follows the same few steps — so once you know one, you know them all.

1. <strong>Load data</strong>

   Features `X` (a 2-D table: rows = samples, columns = features) and target `y` (what to predict).

2. <strong>Split</strong>

   `train_test_split` holds back unseen data to measure honestly.

3. <strong>Create &amp; fit</strong>

   `model = SomeModel(...)` then `model.fit(X_train, y_train)` learns from the training set.

4. <strong>Predict</strong>

   `model.predict(X_test)` on data it has never seen.

5. <strong>Evaluate</strong>

   Compare predictions with the truth: `accuracy_score`, `classification_report`, `mean_squared_error`…

```python filename:Python
from sklearn.datasets import load_iris
from sklearn.model_selection import train_test_split
from sklearn.neighbors import KNeighborsClassifier
from sklearn.metrics import accuracy_score

X, y = load_iris(return_X_y=True)                        # 150 flowers, 4 measurements, 3 species
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=0)
print(X.shape, X_train.shape, X_test.shape)              # (150, 4) (105, 4) (45, 4)

model = KNeighborsClassifier(n_neighbors=5)
model.fit(X_train, y_train)
y_pred = model.predict(X_test)
print(round(accuracy_score(y_test, y_pred), 2))          # 0.98
```

> [!NOTE] Supervised
>
> Learns from labelled examples: <strong>classification</strong> (a category — spam / not spam) or <strong>regression</strong> (a number — price).

> [!NOTE] Unsupervised
>
> Finds structure in unlabelled data: <strong>clustering</strong> (K-Means), dimensionality reduction (PCA).

# Why split the data?

A model scored on the data it trained on can simply memorise it. Testing on held-out data shows how it will do on new, real inputs. `random_state` fixes the shuffle so results are reproducible.

> [!WARNING] Watch out
>
> <strong>Overfitting</strong> = great on training data, poor on test data (the model memorised noise). <strong>Underfitting</strong> = poor on both (the model is too simple). Compare train vs test scores to tell them apart.

| Metric | For | Meaning |
| --- | --- | --- |
| Accuracy | Classification | Share of correct predictions — misleading when classes are imbalanced |
| Precision | Classification | Of those predicted positive, how many really are |
| Recall | Classification | Of the real positives, how many were found |
| F1-score | Classification | Balance of precision and recall |
| MSE / RMSE, R² | Regression | Average squared error / share of variance explained |
