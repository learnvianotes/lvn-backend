# ADR-0058: The AI gateway, on a local model

- Status: Accepted
- Date: 2026-10-13
- Deciders: Backend agent (P5a); owner ("continue with phase 5 using a local model")
- Spec sections: §10.1, §18 (Phase 5); ADR-0024, ADR-0025, ADR-0028

## Context

§10.1 puts every AI call behind one gateway in the `ai` context. It covers:
- provider adapters (OpenAI, Anthropic, Ollama), and model routing by task in a database table;
- token accounting in `AiUsage`;
- quotas checked before the call;
- a monthly budget that trips a circuit breaker;
- versioned prompt templates, with structured outputs checked by Zod;
- a prompt-injection filter;
- a per-provider data-processing flag.

The owner asked for Phase 5 on a **local model**. The dev machine runs Ollama 0.34.3 on an RTX 5060 Ti (16 GB):
- `gemma4`: 7.5B, Q4_K_M, a 128k context, JSON-schema output, images, audio and tools;
- `embeddinggemma`: 768 dimensions, multilingual.

The local environment's VM has no GPU. It runs on QEMU's user network, where `10.0.2.2` is the host.

The FREE plan already sets `AI_TOKENS_DAILY` per role: students 200k, teachers and platform admins 1M (§10.1's
numbers, ADR-0024).

## Decision

1. **Providers.**
   - `AI_PROVIDER` is `none` (the default: AI is off and says so) or `ollama`, with `OLLAMA_URL`, `AI_CHAT_MODEL`
     and `AI_EMBED_MODEL`.
   - A provider is an adapter. Its `mayReceivePrivate` is §10.1's data-processing flag: Ollama is self-hosted, so
     private notes may go to it.
   - OpenAI and Anthropic become adapters, off until the owner gives keys and a zero-retention answer.
2. **Where the model runs.**
   - On a dev machine: its own Ollama.
   - On the local environment: the host's Ollama at `http://10.0.2.2:11434`, which containers reach through the VM's
     network.
   - No note content leaves the machine.
3. **Models by task.** `ai.AiModelRoute` (task, provider, model, input and output price per million tokens, in
   millionths of a dollar) overrides the environment's defaults, so a model can be swapped without a deploy. A
   self-hosted model costs 0.
4. **The checks, in order:**
   1. Is AI on? Is it within the month's budget? Is the provider's circuit closed?
   2. Has the person tokens left today: their plan's `AI_TOKENS_DAILY`, counted per UTC day? Limits come only from
      plans (ADR-0024); no row means no limit.
   3. May this provider see this material?
   4. The task's model, then the prompt.
   5. Up to two retries on errors worth retrying (timeouts, 5xx, 429).
   6. The answer checked against its Zod schema, sent to the model as a JSON schema. A non-matching answer gets one
      repair: the model sees what was wrong.
   7. An `AiUsage` row (who, task, model, prompt id and version, tokens, cost, time, ok), whatever happened. No
      content is kept.
5. **Breakers.**
   - **Budget:** `AI_MONTHLY_BUDGET_MICRO_USD` caps the month's spend, Σ `costMicroUsd` since the start of the UTC
     month. At the cap, AI is `BUDGET` until the next month. `AiBudgetThreshold` is published at 80 % and at 100 %.
   - **Circuit:** three failed calls in a row open it for 30 s (`PROVIDER_DOWN`).
6. **Prompts.**
   - They are `contexts/ai/prompts/<id>.md`, with front matter `id` and `version`, and `# system` and `# user`
     sections.
   - `{{name}}` takes a value the code chooses; `{{content:name}}` takes what people wrote, fenced in
     `<content>…</content>`. Every system prompt ends with the rule that fenced text is material, never instructions.
   - Text that tries to close its fence is neutralised.
7. **Errors and API.**
   - A new `UNAVAILABLE` error code is used when AI is off, out of budget, failing, or gave an unusable answer.
   - `RATE_LIMITED` (with `retryAfter`) is used when the day's tokens are used up.
   - `aiStatus` (anyone) and `myAiAllowance` (signed in) are on a new `ai` subgraph.

## Consequences

- **A self-hosted model costs nothing,** so the budget breaker trips locally only when a route has a price. The test
  sets one; production will have real prices.
- **The local environment depends on the dev machine's Ollama.** If it is stopped, AI is `PROVIDER_DOWN` and AI
  requests say so; nothing else is affected.
- **Production** needs either a GPU host for these models or a provider with a zero-retention agreement, with the
  owner's budget. That is decided when AWS is set up.
- **Data export:** `AiUsage` is personal data (counts only). It joins the data export with P5b's artifacts.
