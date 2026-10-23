---
id: d4b9a344-5a4a-7bfe-99d2-cbac57f73199
key: topic:data-science/spacy
subject: data-science
topic: spacy
title: spaCy Basics
slug: spacy-basics
order: 1
---

spaCy is an industrial-strength NLP library: one call runs tokenization, part-of-speech tagging, sentence splitting, lemmatization and named-entity recognition.

```filename:Setup
pip install spacy
python -m spacy download en_core_web_sm
```

# Tokens

```python filename:Python
import spacy
nlp = spacy.load("en_core_web_sm")
doc = nlp("The cost of Iphone in U.K is 699$")
print([t.text for t in doc])            # ['The', 'cost', 'of', 'Iphone', 'in', 'U.K', 'is', '699', '$']
```

> [!NOTE] Key point
>
> spaCy keeps “U.K” together and splits “699$” into the number and the currency sign — rules that a plain `split()` can't know.

# Parts of speech &amp; lemmas

```python filename:Python
import spacy
nlp = spacy.load("en_core_web_sm")
doc = nlp("The cost of Iphone in U.K is 699$")
print([(t.text, t.pos_) for t in doc][:4])   # [('The', 'DET'), ('cost', 'NOUN'), ('of', 'ADP'), ('Iphone', 'PROPN')]
print([t.lemma_ for t in nlp("She was running faster")])   # ['she', 'be', 'run', 'fast']
```

| Tag | Meaning | Tag | Meaning |
| --- | --- | --- | --- |
| `NOUN` | Noun | `VERB` | Verb |
| `PROPN` | Proper noun | `AUX` | Auxiliary (is, was) |
| `ADJ` | Adjective | `ADP` | Preposition |
| `DET` | Determiner (the, a) | `NUM` | Number |

# Sentences &amp; entities

```python filename:Python
import spacy
nlp = spacy.load("en_core_web_sm")
doc = nlp("This is the first sentence. Please check it. Let's study now")
print([s.text for s in doc.sents])     # ['This is the first sentence.', 'Please check it.', "Let's study now"]
ents = nlp("Sundar Pichai joined Google in 2004 in California.").ents
print([(e.text, e.label_) for e in ents])   # [('Sundar Pichai', 'PERSON'), ('Google', 'ORG'), ('2004', 'DATE'), ('California', 'GPE')]
```

> [!NOTE] NLTK
>
> A teaching toolkit: many algorithms and corpora, you assemble the pipeline yourself.

> [!NOTE] spaCy
>
> Production-ready pipelines, fast, one object (`doc`) with everything — tokens, tags, lemmas, entities.
