---
id: 7eac6d83-9fea-7e26-8c47-12da2e53dd98
key: topic:genai-fluency/gpt_bert
subject: genai-fluency
topic: gpt_bert
title: GPT vs BERT
slug: gpt-vs-bert
order: 1
---

Contrasting the two dominant architectural paths spawned by the original Transformer design.

| Feature | GPT (Generative Pre-trained Transformer) | BERT (Bidirectional Encoder Representations from Transformers) |
| --- | --- | --- |
| <strong>Architecture</strong> | Decoder-only (stacked masked self-attention) | Encoder-only (stacked bidirectional self-attention) |
| <strong>Context Look</strong> | Left-to-right (causal masking hides future tokens) | Bidirectional (looks left and right simultaneously) |
| <strong>Pre-training Objective</strong> | Next-token prediction (Autoregressive Generation) | Masked Language Model (MLM) &amp; Next Sentence Prediction (NSP) |
| <strong>Primary Utility</strong> | Creative generation, dialog, coding, text synthesis | Search queries, sentiment analysis, NER, semantic representation |
| <strong>Generation Style</strong> | Autoregressive (outputs token, appends to prompt, repeats) | Non-generative (outputs representation vectors per token) |

# Autoregressive Loop Visualized

Step 1: Input: "Prompt: The sky is" -&gt; Predict: "blue" (Probability: 85%)Step 2: Input: "Prompt: The sky is blue" -&gt; Predict: "and" (Probability: 40%)Step 3: Input: "Prompt: The sky is blue and" -&gt; Predict: "clear" (Probability: 60%)
