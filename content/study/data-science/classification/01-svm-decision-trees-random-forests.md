---
id: 54938c72-aa97-7c94-8053-09bd961188cc
key: topic:data-science/classification
subject: data-science
topic: classification
title: SVM, Decision Trees & Random Forests
slug: svm-decision-trees-random-forests
order: 1
---

Three classic classifiers on the Iris dataset (150 flowers, 4 measurements, 3 species) — how they decide, and what each is good at.

# Support Vector Machine (SVM)

> [!INFO]
>
> <strong>SVM</strong> — finds the boundary that separates the classes with the <strong>widest margin</strong>. With a kernel such as `rbf`, the boundary can curve.

```python filename:Python
from sklearn import datasets
from sklearn.model_selection import train_test_split
from sklearn.svm import SVC
from sklearn.metrics import accuracy_score

iris = datasets.load_iris()
X = iris.data[:, :2]              # only 2 features (sepal length & width) so it can be plotted in 2-D
y = iris.target
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=0)

model = SVC(kernel="rbf", C=1.0, gamma="auto").fit(X_train, y_train)
print(f"Accuracy: {accuracy_score(y_test, model.predict(X_test)):.2f}")   # Accuracy: 0.80
```

| Parameter | Effect |
| --- | --- |
| `kernel` | `linear` (straight boundary), `rbf` (curved), `poly` |
| `C` | Low = wider margin, tolerates mistakes; high = fits training data tightly (risk of overfitting) |
| `gamma` | For `rbf`: how far one sample's influence reaches — high gamma makes wiggly boundaries |

> [!NOTE] Key point
>
> Using only two features caps the accuracy (0.80). Features matter more than the algorithm — the trees below use all four and score 0.98.

# Decision Tree

> [!INFO]
>
> <strong>Decision tree</strong> — a flowchart of yes/no questions on the features (“petal length ≤ 2.45?”). Each split is chosen to make the groups as pure as possible, measured by <strong>Gini impurity</strong> or <strong>entropy</strong>.

```python filename:Python
from sklearn.datasets import load_iris
from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier, export_text
from sklearn.metrics import accuracy_score

iris = load_iris()
X_train, X_test, y_train, y_test = train_test_split(iris.data, iris.target, test_size=0.3, random_state=0)
model = DecisionTreeClassifier(criterion="entropy", max_depth=3, random_state=0).fit(X_train, y_train)
print(f"Accuracy: {accuracy_score(y_test, model.predict(X_test)):.2f}")   # Accuracy: 0.98
print(export_text(model, feature_names=iris.feature_names).splitlines()[0])   # |--- petal width (cm) <= 0.75
```

> [!NOTE] Key point
>
> `max_depth` limits how many questions deep the tree can go — the main defence against a tree memorising the training data. Draw it with `sklearn.tree.plot_tree(model, filled=True)`.

# Random Forest

> [!INFO]
>
> <strong>Random forest</strong> — many decision trees, each trained on a random sample of rows and features; they <strong>vote</strong>. Averaging many noisy trees gives a stronger, more stable model (an <em>ensemble</em>).

```python filename:Python
from sklearn.datasets import load_iris
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score

iris = load_iris()
X_train, X_test, y_train, y_test = train_test_split(iris.data, iris.target, test_size=0.3, random_state=0)
model = RandomForestClassifier(n_estimators=100, max_depth=3, random_state=0).fit(X_train, y_train)
print(f"Accuracy: {accuracy_score(y_test, model.predict(X_test)):.2f}")   # Accuracy: 0.98

ranked = sorted(zip(model.feature_importances_, iris.feature_names), reverse=True)
print([name for _, name in ranked[:2]])          # ['petal length (cm)', 'petal width (cm)']
```

|  | SVM | Decision tree | Random forest |
| --- | --- | --- | --- |
| Idea | Widest-margin boundary | Sequence of feature questions | Many trees voting |
| Interpretable | Low | <strong>High</strong> (you can read the tree) | Medium (feature importances) |
| Scaling features | <strong>Needed</strong> | Not needed | Not needed |
| Overfitting risk | Tune `C`, `gamma` | High — limit depth | Low |
