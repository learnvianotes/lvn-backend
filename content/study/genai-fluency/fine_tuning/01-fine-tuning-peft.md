---
id: fe803151-c570-7737-ad8e-589d32d02ffa
key: topic:genai-fluency/fine_tuning
subject: genai-fluency
topic: fine_tuning
title: Fine-Tuning & PEFT
slug: fine-tuning-peft
order: 1
---

Updating weights to adapt models for specific formatting, behavior, and specialized tasks.

> [!INFO]
>
> <strong>Fine-Tuning</strong> updates the model parameters. <strong>PEFT (Parameter-Efficient Fine-Tuning)</strong> updates a tiny subset of parameters (e.g., &lt;1%) to make custom fine-tuning achievable on consumer hardware.

# PEFT Methodologies

> [!NOTE] LoRA (Low-Rank Adaptation)
>
> Instead of updating the full high-dimensional weight matrix (W<sub>0</sub>), LoRA freezes it and injects two smaller low-rank decomposition matrices (A and B) alongside it. This cuts trainable parameters by orders of magnitude (up to 10,000x for GPT-3 175B in the original paper) and greatly reduces GPU memory.
>
> `W_new = W_0 + (alpha/r) * (B * A)   // B: d×r, A: r×k, small rank r (e.g., r=8 or r=16)`

> [!NOTE] QLoRA (Quantized LoRA)
>
> Enhances LoRA by quantizing the base model weights to 4-bit NormalFloat (NF4). It enables fine-tuning large models on a single GPU (e.g., 65B on one 48GB GPU) while largely matching 16-bit fine-tuning quality.

> [!NOTE] Adapters
>
> Injecting small feed-forward layers after self-attention block layers. Only these newly added layer weights are trained; the rest of the base model layers are frozen.

# When to RAG vs Fine-Tune

| Factor | RAG (Retrieval-Augmented Generation) | Fine-Tuning |
| --- | --- | --- |
| <strong>Data Updates</strong> | Dynamic (instantly reflects database updates) | Static (requires retraining process to update data) |
| <strong>Source Citations</strong> | Yes (can pinpoint retrieved source chunks) | No (knowledge is baked into abstract weights) |
| <strong>Hallucination Risk</strong> | Much lower (response is grounded in input context) | Moderate (remains a statistical prediction) |
| <strong>Best for</strong> | Accessing private facts, documentation search | Adapting tone, formatting style, learning constraints |
