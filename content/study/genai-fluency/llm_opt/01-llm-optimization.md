---
id: 541c0e66-8be9-72a9-acf3-1dd56de68f70
key: topic:genai-fluency/llm_opt
subject: genai-fluency
topic: llm_opt
title: LLM Optimization
slug: llm-optimization
order: 1
---

How to reduce memory footprints and accelerate token generation speeds in production.

> [!NOTE] Quantization
>
> Reducing the numerical precision of model weights (e.g., from FP16 to INT8 or INT4). This reduces memory usage by 2x to 4x, allowing larger models to fit on smaller GPUs with minimal loss in accuracy. Common techniques: GPTQ, AWQ, bitsandbytes/NF4 (GGUF is a common file format for quantized models in llama.cpp).

> [!NOTE] Distillation
>
> Training a smaller student model to mimic the probability distributions output by a larger teacher model. This bakes reasoning capabilities into smaller models (e.g., distilling a large teacher model into an 8B student).

> [!NOTE] Pruning
>
> Removing non-essential or low-activation weights/attention heads from the trained neural network. This reduces file size and accelerates computational execution paths.

> [!NOTE] KV Cache (Key-Value Cache)
>
> During autoregressive generation, each new token requires computing attention weights against all previous tokens. <strong>KV Caching</strong> stores the Key and Value tensors of past tokens in GPU memory (queries are not cached; only the new token's query is needed), avoiding recomputation at each generation step and greatly speeding up decoding.

> [!NOTE] Speculative Decoding
>
> Using a small, fast model to generate a draft of several tokens, then passing the entire draft in one batch to the large, slow target model for validation. The target model accepts the longest prefix of draft tokens it agrees with (plus one token of its own), keeping its output quality unchanged and speeding generation by \~2x-3x.
