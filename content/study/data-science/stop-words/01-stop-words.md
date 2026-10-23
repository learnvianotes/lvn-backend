---
id: 0d9261d0-b605-7619-b950-d55d7a4e7c84
key: topic:data-science/stop-words
subject: data-science
topic: stop-words
title: Stop Words
slug: stop-words
order: 1
---

Stop words are very common words (“is”, “the”, “a”) that carry little meaning on their own. Removing them shrinks the text and highlights the words that matter.

```python filename:Python
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize

stop_words = set(stopwords.words("english"))
print(len(stop_words), "is" in stop_words, "good" in stop_words)   # 198 True False

txt = "This is not a good time to talk."
kept = [w for w in word_tokenize(txt) if w.lower() not in stop_words and len(w) >= 2]
print(kept)                                  # ['good', 'time', 'talk']
```

> [!WARNING] Careful
>
> “not” is a stop word in NLTK's list — so “not a good time” becomes “good time”. For sentiment analysis, removing stop words can flip the meaning; keep negations.

# Stop words in spaCy

```python filename:Python
import spacy
nlp = spacy.load("en_core_web_sm")          # python -m spacy download en_core_web_sm

print(len(nlp.Defaults.stop_words) > 300)   # True
print(nlp.vocab["is"].is_stop, nlp.vocab["GFG"].is_stop)   # True False

nlp.Defaults.stop_words.add("i.e")          # add your own
nlp.vocab["i.e"].is_stop = True
nlp.Defaults.stop_words.discard("done")     # or remove one
nlp.vocab["done"].is_stop = False
print(nlp.vocab["i.e"].is_stop, nlp.vocab["done"].is_stop)  # True False
```

> [!NOTE] Key point
>
> Change both `nlp.Defaults.stop_words` (the list) and `nlp.vocab[word].is_stop` (the flag tokens check) — spaCy keeps them separately.
