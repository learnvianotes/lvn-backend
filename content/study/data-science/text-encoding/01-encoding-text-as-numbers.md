---
id: 2fe64cea-292e-7a33-b13c-e5f5eca484f9
key: topic:data-science/text-encoding
subject: data-science
topic: text-encoding
title: Encoding Text as Numbers
slug: encoding-text-as-numbers
order: 1
---

Models work with numbers, not words. The simplest encoding gives every word in the vocabulary an ID — then each sentence becomes a list of IDs, and can be turned back.

# Build a vocabulary

```python filename:Python
corpus = ("India, officially the Republic of India, is a country in South Asia. "
          "It is the seventh-largest country by area, the second-most populous country, "
          "and the most populous democracy in the world. "
          "In the Indian Ocean, India is in the vicinity of Sri Lanka and the Maldives.")

from nltk.tokenize import word_tokenize, sent_tokenize
from nltk.corpus import stopwords

stop = set(stopwords.words("english"))
def keep(word):
    return word.lower() not in stop and len(word) >= 2      # drop stop words and punctuation

words = [w.lower() for w in word_tokenize(corpus) if keep(w)]
vocab = sorted(set(words))                                   # sorted → same IDs every run
word_to_num = {w: i for i, w in enumerate(vocab, start=1)}
num_to_word = {i: w for w, i in word_to_num.items()}
print(len(vocab), vocab[:4])                                 # 18 ['area', 'asia', 'country', 'democracy']
```

> [!NOTE] Correction
>
> The notebook builds the vocabulary from `list(set(words))` — sets have no fixed order, so the IDs change every run. Sort first to make the mapping reproducible.

# Encode and decode

```python filename:Python
corpus = ("India, officially the Republic of India, is a country in South Asia. "
          "It is the seventh-largest country by area, the second-most populous country, "
          "and the most populous democracy in the world. "
          "In the Indian Ocean, India is in the vicinity of Sri Lanka and the Maldives.")

from nltk.tokenize import word_tokenize, sent_tokenize
from nltk.corpus import stopwords

stop = set(stopwords.words("english"))
keep = lambda w: w.lower() not in stop and len(w) >= 2
vocab = sorted({w.lower() for w in word_tokenize(corpus) if keep(w)})
word_to_num = {w: i for i, w in enumerate(vocab, start=1)}
num_to_word = {i: w for w, i in word_to_num.items()}

encoded = [[word_to_num[w.lower()] for w in word_tokenize(s) if keep(w)] for s in sent_tokenize(corpus)]
print(encoded[0])                                            # [5, 10, 12, 5, 3, 15, 2]
print(" ".join(num_to_word[n] for n in encoded[0]))          # india officially republic india country south asia
```

# Keeping every word

To decode back to the full sentence, keep stop words and drop only punctuation. The vocabulary grows, but nothing is lost except capitalisation and punctuation:

```python filename:Python
corpus = ("India, officially the Republic of India, is a country in South Asia. "
          "It is the seventh-largest country by area, the second-most populous country, "
          "and the most populous democracy in the world. "
          "In the Indian Ocean, India is in the vicinity of Sri Lanka and the Maldives.")

from nltk.tokenize import word_tokenize, sent_tokenize
is_word = lambda w: any(c.isalpha() for c in w)
vocab = sorted({w.lower() for w in word_tokenize(corpus) if is_word(w)})
word_to_num = {w: i for i, w in enumerate(vocab, start=1)}
num_to_word = {i: w for w, i in word_to_num.items()}
first = sent_tokenize(corpus)[0]
ids = [word_to_num[w.lower()] for w in word_tokenize(first) if is_word(w)]
print(" ".join(num_to_word[i] for i in ids))   # india officially the republic of india is a country in south asia
```

> [!NOTE] Bag of words / counts
>
> `CountVectorizer` — how often each vocabulary word occurs (see <em>Naive Bayes</em>).

> [!NOTE] TF-IDF
>
> Counts weighted down for words common across all documents.

> [!NOTE] Word embeddings
>
> Dense vectors where similar words are close (Word2Vec, GloVe) — what neural networks and LLMs build on.
