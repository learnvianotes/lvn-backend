---
id: d58f7e21-9077-7a01-866c-9e5c79d00213
key: topic:data-science/naive-bayes
subject: data-science
topic: naive-bayes
title: Text Classification with Naive Bayes
slug: text-classification-with-naive-bayes
order: 1
---

Classify documents by their words: turn each text into word counts, then let Naive Bayes estimate which class makes those words most likely.

1. <strong>Vectorise</strong>

   `CountVectorizer` builds a vocabulary and turns each document into a vector of word counts (bag of words).

2. <strong>Train</strong>

   `MultinomialNB` learns how often each word appears in each class.

3. <strong>Predict</strong>

   For a new text it picks the class with the highest probability, assuming words are independent — the “naive” part.

```python filename:Python
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.naive_bayes import MultinomialNB

texts = ["the team won the cricket match", "stocks fell as markets closed lower",
         "a great goal in the final", "the bank raised interest rates",
         "fans cheered the winning shot", "investors sold shares today"]
labels = ["sports", "finance", "sports", "finance", "sports", "finance"]

vectorizer = CountVectorizer()
X = vectorizer.fit_transform(texts)          # sparse matrix: 6 documents × vocabulary
print(X.shape)                               # (6, 27)

model = MultinomialNB().fit(X, labels)
new = vectorizer.transform(["the match was a great win", "interest rates and shares"])
print(model.predict(new).tolist())           # ['sports', 'finance']
```

> [!WARNING] Watch out
>
> Call `fit_transform` on training text only, then `transform` on new text — otherwise the vocabulary (and the columns) change between training and prediction.

# The notebook's real dataset

```python filename:Python
from sklearn.datasets import fetch_20newsgroups
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.model_selection import train_test_split
from sklearn import metrics

data = fetch_20newsgroups(subset="all")                  # ~18,800 posts in 20 topics (downloads once)
X = CountVectorizer().fit_transform(data.data)
X_train, X_test, y_train, y_test = train_test_split(X, data.target, test_size=0.3, random_state=0)
model = MultinomialNB().fit(X_train, y_train)
y_pred = model.predict(X_test)
print(f"Accuracy: {metrics.accuracy_score(y_test, y_pred):.2f}")   # 0.85 in the notebook run
print(metrics.classification_report(y_test, y_pred, target_names=data.target_names))
```

> [!NOTE] Key point
>
> The report shows per-class precision and recall. In the notebook, `comp.os.ms-windows.misc` had precision 0.97 but recall 0.25 — the model was rarely wrong when it chose that class, but missed most of its posts. Accuracy alone would hide that.

> [!NOTE] Why Naive Bayes for text
>
> Fast, works with little data, handles huge vocabularies — a strong baseline for spam filters and topic tagging.

> [!NOTE] Improving it
>
> `TfidfVectorizer` (down-weights common words), removing stop words, bigrams (`ngram_range=(1, 2)`).
