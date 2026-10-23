---
id: eda16518-9da8-710a-8319-e1ce1add33b5
key: topic:genai-fluency/ai_arch
subject: genai-fluency
topic: ai_arch
title: AI Architecture
slug: ai-architecture
order: 1
---

How to design large-scale infrastructure for GenAI applications.

> [!NOTE] LLM APIs vs Local Models
>
> \- <strong>APIs (OpenAI, Gemini)</strong>: Serverless, state-of-the-art reasoning, no hosting overhead. High variable cost, rate limits, data privacy/compliance concerns.<br> - <strong>Local (Llama, Mistral)</strong>: Hosted on private GPUs. Fixed cost, data privacy control, low latency (if cached). Requires complex infrastructure setup and GPU maintenance.

> [!NOTE] Latency & GPU Inference
>
> LLM latency is broken into: <br>- <strong>Time-to-First-Token (TTFT)</strong>: Time taken to process the input prompt (prefill phase). Compute bound (all prompt tokens processed in parallel). <br>- <strong>Inter-Token Latency (ITL)</strong>: Time taken to generate subsequent tokens autoregressively. Memory-bandwidth bound (weights and KV cache are re-read for every token).

# Operational Optimizations

> [!NOTE] Streaming
>
> Pushing tokens to the client via Server-Sent Events (SSE) as they are generated, rather than waiting for the entire sequence to complete. This drastically reduces perceived latency for the user.

> [!NOTE] Prompt Caching
>
> Caching the key-value states of long prefix prompts (like system prompts or large context segments) on the inference server (or by the API provider). If a subsequent request shares the same prefix, we skip the prefill calculations, cutting TTFT and API costs by up to 90%.

> [!NOTE] Tool Calling / Function Calling
>
> The model outputs structured arguments (JSON) indicating a function it wants to invoke (e.g., `get_weather(location="Seattle")`). The backend executes the function, feeds the result back to the model, and the model synthesizes the final response.
