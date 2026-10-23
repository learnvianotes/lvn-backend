---
id: 824a95bf-7aac-7f66-a29a-19e6ea1785e8
key: topic:data-science/tokenization
subject: data-science
topic: tokenization
title: Tokenization, Stemming & Lemmatization
slug: tokenization-stemming-lemmatization
order: 1
---

Before a computer can work with text, it has to be cut into pieces (tokens) and words have to be brought to a common form.

> [!NOTE] About this module
>
> The notebook calls this module “Deep Learning”, but everything in it is <strong>text processing (NLP)</strong> — the groundwork that comes before any language model.

# Why not just split()?

```python filename:Python
txt = "Hello Geeks. We're hoping you guys are doing great."
print(len(txt.split(".")))      # 3        ← counts an empty piece after the last "."
print(txt.split()[:3])          # ['Hello', 'Geeks.', "We're"]   ← punctuation stuck to words
```

# Tokenizing with NLTK

```python filename:Python
from nltk.tokenize import sent_tokenize, word_tokenize

txt = "Hello Geeks. We're hoping you guys are doing great."
print(len(sent_tokenize(txt)))                    # 2
print(word_tokenize(txt))                         # ['Hello', 'Geeks', '.', 'We', "'re", 'hoping', 'you', 'guys', 'are', 'doing', 'great', '.']
print([w for w in word_tokenize(txt) if w.isalnum()])   # ['Hello', 'Geeks', 'We', 'hoping', 'you', 'guys', 'are', 'doing', 'great']
```

```filename:Setup
pip install nltk
python -m nltk.downloader punkt punkt_tab stopwords wordnet omw-1.4
```

> [!NOTE] Key point
>
> `sent_tokenize` knows that “Dr.” or “U.K.” don't end a sentence; `word_tokenize` splits off punctuation and contractions (“We're” → “We”, “'re”).

# Stemming vs lemmatization

```python filename:Python
from nltk.stem import PorterStemmer, WordNetLemmatizer
stem, lem = PorterStemmer(), WordNetLemmatizer()

words = ["change", "changes", "changed", "studies", "better"]
print([stem.stem(w) for w in words])              # ['chang', 'chang', 'chang', 'studi', 'better']
print([lem.lemmatize(w) for w in words])          # ['change', 'change', 'changed', 'study', 'better']
print(lem.lemmatize("changed", pos="v"), lem.lemmatize("better", pos="a"))   # change good
```

|  | Stemming | Lemmatization |
| --- | --- | --- |
| How | Chops suffixes by rules | Looks words up in a dictionary (WordNet) |
| Output | May not be a real word (`chang`) | Always a real word (`change`) |
| Speed | Fast | Slower |
| Needs part of speech | No | For best results (`pos="v"` verb, `"a"` adjective) |

> [!NOTE] Key point
>
> Without `pos`, the lemmatizer treats every word as a noun — that's why the notebook got `changed` back unchanged. Tell it the word is a verb and it returns `change`.
