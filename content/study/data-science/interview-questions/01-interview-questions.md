---
id: e9ceae79-606c-77ea-8075-d10b5a9e3dff
key: topic:data-science/interview-questions
subject: data-science
topic: interview-questions
title: Interview Questions
slug: interview-questions
order: 1
---

Data science questions that come up in placements and interviews — short answers you can say out loud.

# Python &amp; data handling

```question
What's the difference between a Python list and a NumPy array?

---

A list holds any objects and grows easily, but maths needs a loop. A NumPy array holds one type in contiguous memory, so operations are <strong>vectorised</strong> — `arr * 2` multiplies every element in C, far faster. Arrays also support multi-dimensional shapes, axes and broadcasting.
```

```question
What does axis=0 vs axis=1 mean?

---

`axis=0` works down the rows — one result per <strong>column</strong>. `axis=1` works across the columns — one result per <strong>row</strong>. For a (rows, cols) array, `sum(axis=0)` has one value per column.
```

```question
Series vs DataFrame?

---

A Series is one labelled column (values + index). A DataFrame is a table of Series sharing the same index — rows and named columns.
```

```question
loc vs iloc?

---

`loc` selects by <strong>labels</strong> (index values and column names; slices include the end). `iloc` selects by integer <strong>position</strong> (slices exclude the end).
```

```question
How do you handle missing values?

---

First measure them (`df.isna().sum()`). Then per column: drop rows (`dropna`), fill with a constant or the mean/median/mode (`fillna`), or model them; sometimes add a “was missing” flag. The choice depends on how much is missing and why.
```

# Machine learning

```question
Supervised vs unsupervised learning?

---

Supervised learning uses labelled examples to predict a target — classification (categories) or regression (numbers). Unsupervised learning finds structure without labels — clustering (K-Means) or dimensionality reduction (PCA).
```

```question
Why do we split data into train and test sets?

---

To measure performance on data the model hasn't seen. A score on training data rewards memorisation; the test score estimates real-world performance. Cross-validation repeats the split several times for a more reliable estimate.
```

```question
What are overfitting and underfitting?

---

Overfitting: great on training data, poor on test data — the model learned noise (fix: simpler model, regularisation, more data, limit tree depth). Underfitting: poor on both — the model is too simple (fix: more features, a more flexible model).
```

```question
Precision vs recall?

---

Precision: of everything predicted positive, how much really is positive. Recall: of all real positives, how many were found. Spam filters favour precision (don't lose real mail); disease screening favours recall (don't miss a case). F1 balances both.
```

```question
Decision tree vs random forest?

---

A single tree is easy to read but overfits easily. A random forest trains many trees on random samples of rows and features and lets them vote — more accurate and stable, less interpretable, with feature importances as a summary.
```

```question
How does K-Means work, and how do you choose K?

---

Pick K centroids, assign each point to the nearest, move each centroid to the mean of its points, repeat until stable. Choose K with the elbow method (plot within-cluster sum of squares against K) or the silhouette score.
```

```question
Why is Naive Bayes “naive”?

---

It assumes features (e.g. words) are independent given the class. That's rarely true, but the model is fast, needs little data and works surprisingly well for text classification.
```

# Text &amp; scraping

```question
Stemming vs lemmatization?

---

Stemming chops suffixes by rules and may produce non-words (`changes` → `chang`). Lemmatization uses a dictionary and part of speech to return the real base form (`changed` → `change`, `better` → `good`). Lemmatization is more accurate, stemming faster.
```

```question
What are stop words, and when should you keep them?

---

Very common words (“the”, “is”) removed to focus on meaningful words. Keep them when they matter — negations like “not” in sentiment analysis, or for models that read full sentences.
```

```question
How do you turn text into numbers for a model?

---

Tokenize, build a vocabulary, then encode: word IDs, bag-of-words counts (`CountVectorizer`), TF-IDF weights, or dense embeddings (Word2Vec, transformer models).
```

```question
requests + BeautifulSoup vs Selenium — when do you need Selenium?

---

requests fetches the HTML the server sends; BeautifulSoup parses it — fast and light. If content is created by JavaScript after the page loads (infinite scroll, clicks, logins), `requests` sees an empty shell; Selenium drives a real browser so you get what users see.
```

# Quick-fire checklist

File modes r/w/a · os.walk · ndarray vs list · Broadcasting · axis · loc vs iloc · Missing values · groupby · BeautifulSoup find/find\_all · Selenium waits · Train/test split · Overfitting · Precision &amp; recall · Random forest · K-Means &amp; elbow · Naive Bayes · Tokenization · Lemmatization · Stop words · Regex · TF-IDF &amp; embeddings
