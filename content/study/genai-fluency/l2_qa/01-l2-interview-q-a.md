---
id: efe30f5c-7546-728c-b34f-e6c1c010e912
key: topic:genai-fluency/l2_qa
subject: genai-fluency
topic: l2_qa
title: "L2: Interview Q&A"
slug: l2-interview-q-a
order: 1
---

Detailed interview answers on GenAI systems mechanics. Read-times are approximately 2-3 minutes per answer.

```question
"Explain RAG."

---

<strong>Fast Answer:</strong> Retrieving relevant text snippets from a database and injecting them into the LLM prompt so it can answer questions based on private facts.

Retrieval-Augmented Generation (RAG) is an architectural pattern designed to optimize LLM outputs without training. It has two parts: <br>1. <strong>Ingestion</strong>: Documents are split into chunks, converted to vector embeddings, and stored in a Vector DB. <br>2. <strong>Query</strong>: When a user asks a question, we compute its embedding, query the Vector DB for the top-k semantically closest document chunks, construct a prompt combining these chunks with the user question, and pass it to the LLM. The LLM synthesizes a response grounded in the retrieved context, which reduces (but does not eliminate) hallucinations and enables source citation.
```

```question
"Difference between RAG and Fine Tuning."

---

<strong>Fast Answer:</strong> RAG provides external context at query time (fact-lookup). Fine-tuning adjusts the model weights (behavior/style adjustment).

Think of RAG as giving the LLM an open-book exam: the model reads relevant pages to answer questions. Think of Fine-Tuning as having the model study for weeks: it changes internal weight states so it remembers formatting structures, style rules, or domain behaviors. Use <strong>RAG</strong> for dynamic fact lookup, document search, and real-time updates. Use <strong>Fine-Tuning</strong> to teach formatting schemas (e.g. JSON), custom tones, code syntaxes, or to optimize smaller open-source models for specialized tasks.
```

```question
"How do embeddings work?"

---

<strong>Fast Answer:</strong> They map words/sentences into high-dimensional vectors where semantic similarity correlates with geometric proximity.

An embedding model processes a string of text and outputs a dense vector of floating-point numbers (e.g., 1536 floats). The model has been trained to assign vectors such that words with similar meanings (e.g., "king" and "queen") point in similar geometric directions in this multi-dimensional space. The distance or angle between these vectors is measured to calculate how semantically similar two concepts are.
```

```question
"Why cosine similarity?"

---

<strong>Fast Answer:</strong> It measures vector alignment direction rather than magnitude, making it length-invariant and fast to compute.

Cosine similarity calculates the cosine of the angle between two vectors: <br>Similarity = (A · B) / (‖A‖ × ‖B‖) <br>In text embedding space, magnitude (vector length) often correlates with text frequency or document length. Cosine similarity factors out length, focusing purely on semantic direction. Furthermore, if vectors are normalized to unit length, cosine similarity is simply the dot product, making calculations extremely fast on GPUs.
```

```question
"How does GPT generate text?"

---

<strong>Fast Answer:</strong> Autoregressively. It predicts the next token based on previous tokens, selects one, appends it, and repeats.

GPT models are autoregressive decoder-only Transformers. The generation loop is: <br>1. Feed the sequence of existing tokens (the prompt) into the model. <br>2. The model outputs a probability distribution over the entire vocabulary for the next slot. <br>3. We sample a token based on this distribution (configured by temperature, top-k/top-p). <br>4. Append the selected token to the input sequence and feed it back into the model to predict the next token. <br>This continues until the model outputs an End-of-Sequence (EOS) token or reaches limits.
```

```question
"Explain Self Attention."

---

<strong>Fast Answer:</strong> A mechanism allowing tokens in a sequence to calculate how much relevance they have to every other token.

Self-attention computes dynamic attention weights between tokens. For each input token, the model projects: <br>- <strong>Query (Q)</strong>: What context it is searching for. <br>- <strong>Key (K)</strong>: What information profile it offers. <br>- <strong>Value (V)</strong>: The actual payload content. <br>We compute attention scores by calculating the dot product of all Queries with all Keys, scaling it (dividing by √d<sub>k</sub>), applying Softmax to get percentages, and multiplying these weights by the Values: <br>$\\text{Attention}(Q, K, V) = \\text{softmax}\\left(\\frac{Q K^T}{\\sqrt{d\_k}}\\right) V$ <br>This allows tokens to gather context dynamically (e.g., in "The bank of the river," the token "bank" attends heavily to "river", steering it toward the riverbank sense rather than the financial one).
```

```question
"Difference between GPT and BERT."

---

<strong>Fast Answer:</strong> GPT is decoder-only, autoregressive, and causal (generates text). BERT is encoder-only, non-generative, and bidirectional (extracts context).

<strong>GPT</strong> is built on stacked masked Decoder blocks. It uses causal attention, meaning a token can only look at preceding tokens, making it optimized for next-token prediction and generation. <strong>BERT</strong> is built on stacked Encoder blocks. It has no causal mask, meaning tokens can attend bidirectionally to both past and future positions, making it optimal for feature extraction, semantic search representation, and classification tasks but unable to generate text sequence outputs.
```

```question
"When should we use Fine Tuning?"

---

<strong>Fast Answer:</strong> Use it to teach a model custom styles, strict formatting outputs, domain jargon, or to compress performance into a smaller model.

Fine-tuning is recommended when: <br>1. You need strict adherence to formatting instructions (e.g., force a model to always output a specific JSON structure). <br>2. You want to adjust style, tone, or voice to match a brand. <br>3. You need to train the model on a specialized programming language or proprietary API syntax. <br>4. You want to train a small, cheap, open-source model (like Llama-3-8B) to perform a specific task with accuracy approaching a frontier model, reducing operational costs.
```

```question
"Why use LoRA?"

---

<strong>Fast Answer:</strong> It reduces trainable parameters by 99%+, saving massive GPU memory and compute while reducing (not eliminating) catastrophic forgetting.

Low-Rank Adaptation (LoRA) is a Parameter-Efficient Fine-Tuning (PEFT) method. Instead of modifying all parameters in a weight matrix of size d × k (which requires storing massive gradients in GPU RAM), LoRA freezes the original weights and inserts two small low-rank matrices of sizes d × r and r × k (where r ≪ d, k, e.g., r = 8). Because only these small matrices are updated, trainable parameters drop by up to 99.9%, enabling fine-tuning on consumer hardware and allowing rapid hot-swapping of LoRA adapters on a single base model instance in production.
```
