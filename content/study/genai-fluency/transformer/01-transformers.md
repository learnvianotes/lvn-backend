---
id: 40727caa-f2f3-778b-873d-364fac98733a
key: topic:genai-fluency/transformer
subject: genai-fluency
topic: transformer
title: Transformers
slug: transformers
order: 1
---

Understanding the attention mechanism that replaced Recurrent Neural Networks (RNNs) by allowing parallelized sequence processing.

> [!INFO]
>
> Introduced in Google's landmark paper <strong>"Attention Is All You Need" (2017)</strong>, the Transformer replaces recurrence with <strong>Self-Attention</strong>, processing entire text sequences simultaneously rather than word-by-word.

# Key Components

> [!NOTE] Encoder
>
> Processes the input sequence and constructs a dense representation that captures bidirectional context for each token. Used in task architectures like text classification or NER (e.g., BERT).

> [!NOTE] Decoder
>
> Generates the output sequence token-by-token. Uses causal masking to ensure prediction for token <em>t</em> only depends on tokens prior to it (t-1, t-2). Used in generative models (e.g., GPT).

> [!NOTE] Self-Attention (Q, K, V)
>
> Calculates the relevance of each token in the sequence to every other token. For each token, the network projects three vectors: <br>- <strong>Query (Q)</strong>: What the token is looking for. <br>- <strong>Key (K)</strong>: What characteristics the token possesses. <br>- <strong>Value (V)</strong>: The actual content information of the token. <br>The dot product Q·K<sup>T</sup> measures alignment, scaled and passed to Softmax to get attention weights, which are multiplied by V.
>
> `Attention(Q, K, V) = softmax( (Q * K^T) / sqrt(d_k) ) * V`

> [!NOTE] Multi-Head Attention
>
> Runs self-attention multiple times in parallel with different linear projections. This allows the model to attend to information from different representation subspaces at different positions simultaneously (e.g., one head tracks subject-verb agreement, another tracks pronouns).

> [!NOTE] Positional Encoding
>
> Because Transformers process all tokens in parallel, they have no built-in concept of word order. The original Transformer adds fixed sine/cosine vectors (or learned position embeddings) to the input embeddings; most modern LLMs (e.g., Llama) instead use Rotary Position Embeddings (RoPE), which rotate Q and K inside attention.

> [!NOTE] Normalization & Connections
>
> \- <strong>Residual Connections</strong>: Allow gradients to flow directly through network layers, preventing vanishing gradients in deep stacks. <br>- <strong>Layer Normalization</strong>: Stabilizes training dynamics by normalizing inputs across feature dimensions on each layer.
