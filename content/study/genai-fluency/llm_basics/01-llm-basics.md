---
id: 41884aab-694a-70f9-b31e-1b3f118d90ae
key: topic:genai-fluency/llm_basics
subject: genai-fluency
topic: llm_basics
title: LLM Basics
slug: llm-basics
order: 1
---

Core concepts regarding large language models, their properties, and generation control.

> [!NOTE] What makes LLMs different?
>
> LLMs are characterized by scale (billions of parameters) and <strong>emergent behaviors</strong> — abilities like zero-shot reasoning or complex coding that arise at scale but are absent in smaller, traditional models. They shift AI from task-specific architectures (e.g., one model for translation, one for classification) to a single general-purpose prompt-based interface.

> [!NOTE] Why GPT is called GPT
>
> <strong>G</strong>enerative <strong>P</strong>re-trained <strong>T</strong>ransformer:<br> - <strong>Generative</strong>: Creates new text content based on patterns.<br> - <strong>Pre-trained</strong>: Pre-trained on massive text datasets before being adjusted for specific tasks.<br> - <strong>Transformer</strong>: Built on the self-attention network architecture introduced by Google in 2017.

> [!NOTE] Parameters
>
> The internal weights and biases of the neural network. During training, the loss optimization updates these parameters. The number of parameters (e.g., 70B, 405B) dictates the model's capacity to hold knowledge and understand reasoning patterns.

> [!NOTE] Context Window
>
> The maximum number of tokens a model can process in a single request (input prompt + generated output response). Exceeding this limit causes an API error, or the application must truncate or summarize older content — which the model then cannot see.

> [!NOTE] Temperature, Top-k, & Top-p
>
> Hyperparameters controlling the randomness of next-token selection during inference: <br>- <strong>Temperature</strong>: Scales token logits. 0 = greedy (always pick the top token). 1 = the model's unmodified distribution; &gt;1 = flatter and more random. <br>- <strong>Top-k</strong>: Limits candidates to the top <em>k</em> most probable tokens. <br>- <strong>Top-p (Nucleus)</strong>: Limits candidates to a cumulative probability threshold <em>p</em> (e.g., 0.9 means only consider tokens making up the top 90% of probability mass).

> [!NOTE] Training vs Inference vs Fine-tuning
>
> \- <strong>Training</strong>: Building the model from scratch on raw text (very expensive).<br> - <strong>Fine-tuning</strong>: Further training a pre-trained model on structured prompt-response pairs to adapt its style, behavior, or domain specificity.<br> - <strong>Inference</strong>: Running queries through the trained model to generate predictions (read-only execution).

> [!NOTE] Hallucination
>
> A phenomenon where an LLM generates factually incorrect statements, false links, or fabricated data with high confidence, due to next-token probability bias rather than verified lookup.

> [!NOTE] Prompt
>
> The input text provided to the model. Structuring prompt templates (roles, tasks, examples, system commands) instructs the model on how to formulate its response.
