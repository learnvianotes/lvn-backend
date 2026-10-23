---
id: e640d2f5-e579-7216-a34c-5cfbcbc86247
key: topic:data-science/wordnet
subject: data-science
topic: wordnet
title: Synonyms & Antonyms with WordNet
slug: synonyms-antonyms-with-wordnet
order: 1
---

WordNet is a dictionary for programs: words are grouped into sets of synonyms (<em>synsets</em>) with definitions, and linked to antonyms and broader or narrower words.

```python filename:Python
from nltk.corpus import wordnet

syn = wordnet.synsets("book")
print(syn[0].definition())      # a written work or composition that has been published (printed on pages bound together)
print(syn[0].name())            # book.n.01
```

# Synonyms

```python filename:Python
from nltk.corpus import wordnet
synonyms = []
for s in wordnet.synsets("happy"):
    for lemma in s.lemmas():
        synonyms.append(lemma.name())
print(sorted(set(synonyms)))    # ['felicitous', 'glad', 'happy', 'well-chosen']
```

> [!NOTE] Key point
>
> Use a `set` to drop duplicates — the notebook's list repeats “happy” four times because it appears in four synsets.

# Antonyms

```python filename:Python
from nltk.corpus import wordnet
antonyms = {a.name() for s in wordnet.synsets("healthy") for l in s.lemmas() for a in l.antonyms()}
print(sorted(antonyms))         # ['unhealthy']
```

| Call | Gives |
| --- | --- |
| `wordnet.synsets(word)` | Every sense of the word |
| `synset.definition()` / `.examples()` | Its meaning / example sentences |
| `synset.lemmas()` | The words in that sense (synonyms) |
| `lemma.antonyms()` | Opposites |
| `synset.hypernyms()` | Broader terms (dog → canine) |
