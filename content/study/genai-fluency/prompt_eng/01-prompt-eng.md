---
id: 1c40c0e8-9951-78bf-aa9b-5c33ef92718a
key: topic:genai-fluency/prompt_eng
subject: genai-fluency
topic: prompt_eng
title: Prompt Eng.
slug: prompt-eng
order: 1
---

How to structure inputs to align LLM generation without modifying weights.

> [!NOTE] Zero-shot vs One-shot vs Few-shot Prompting
>
> \- <strong>Zero-shot</strong>: Asking the model to perform a task with zero examples. (e.g., "Translate this to French: Hello").<br> - <strong>One-shot</strong>: Providing exactly one input-output example to establish format.<br> - <strong>Few-shot</strong>: Providing multiple examples (e.g., 3-5 pairings) to teach complex patterns or output formats.

> [!NOTE] Chain of Thought (CoT) Prompting
>
> Instructing the model to output its step-by-step reasoning process before providing the final answer (e.g., "Think step-by-step"). This forces the model to serialize intermediate reasoning tokens, significantly reducing mathematical and logic errors.

> [!NOTE] System Prompt vs User Prompt
>
> \- <strong>System Prompt</strong>: Global high-priority configuration instructions that define the model's persona, behavior rules, guardrails, and output format constraints.<br> - <strong>User Prompt</strong>: The specific query or request input dynamically by the end user.

> [!NOTE] Structured Output
>
> Enforcing models to output valid formats like JSON or XML. Implemented by specifying JSON schemas in API parameters (e.g., OpenAI's Structured Outputs feature) or grammar-constrained decoding for local models (e.g., llama.cpp GBNF, Outlines).
