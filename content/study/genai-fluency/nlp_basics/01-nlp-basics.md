---
id: 73c3df47-168c-7fcb-aa98-7b9ddc1a030e
key: topic:genai-fluency/nlp_basics
subject: genai-fluency
topic: nlp_basics
title: NLP Basics
slug: nlp-basics
order: 1
---

The basic pipeline for transforming raw human language into numerical representations computers can understand.

> [!NOTE] Text
>
> Raw human-readable string data, unstructured and sequential, which serves as the input or output of NLP systems.

> [!NOTE] Tokens & Tokenization
>
> <strong>Tokenization</strong> is the process of splitting text strings into smaller units called <strong>Tokens</strong>. Tokens can be words, characters, or subwords (byte-pair encodings). Modern LLMs use subwords so they can parse typos and compound words efficiently without hitting Out-of-Vocabulary errors.
>
> `                // Text: "Tokenization is easy"`<br><br>`                // Tokens: ["Token", "ization", " is", " easy"]`

> [!NOTE] Vocabulary
>
> The set of all unique tokens that a model is capable of recognizing and processing. If a token isn't in the vocabulary, the tokenizer breaks it down into sub-components or represents it using an "unknown" placeholder.

> [!NOTE] Embeddings
>
> Vector representations of tokens. Token IDs are mapped to dense, high-dimensional numerical vectors (e.g., 768 or 1536 dimensions) where words with similar semantic meanings are positioned closer to each other in vector space.

> [!NOTE] Context & Sequence
>
> <strong>Context</strong> refers to the surrounding text that gives meaning to a particular word. A <strong>Sequence</strong> is an ordered list of tokens processed as a single unit by the model. Modifying the context dynamically changes how word embeddings are processed in Transformers.
