# ADR-0065: AI providers platform admins choose

- Status: Accepted
- Date: 2026-10-13
- Deciders: Backend and Web agents; owner ("create a place … that i can choose between ai providers like claude,
  chatgpt, gemini … along with custom AI provider like Litellm proxy and other. i will set this up for sometime")
- Spec sections: §10.1; ADR-0058, ADR-0024, ADR-0036

## Context

ADR-0058 put every AI call behind one gateway, with one provider from the environment: `AI_PROVIDER=ollama`. §10.1
plans adapters for OpenAI and Anthropic, routing by task, and a data-processing flag per provider.

The owner wants one place to choose the provider:
- Claude, ChatGPT or Gemini;
- a custom server, such as a LiteLLM proxy, OpenRouter or vLLM.

They will set it up later. Until then the local model must keep answering, with no change.

Facts that shape the design:
- **One API dialect covers most providers.** OpenAI's Chat Completions and Embeddings API is spoken by OpenAI, by
  Gemini's OpenAI-compatible endpoint (`…/v1beta/openai`, which takes images, `input_audio` and structured output) and
  by LiteLLM, OpenRouter, vLLM and Ollama's `/v1`.
- **Anthropic's Messages API is its own dialect.** It has no embeddings and does not take recordings.
- **Embeddings are stored as `vector(768)`.** Every embedding provider must give 768 numbers. OpenAI's
  `text-embedding-3-*` and Gemini's `gemini-embedding-001` can be asked for 768 (`dimensions`).
- **Keys are secrets.** They must not be readable from the database, the API, logs or the audit log.

## Decision

1. **Connections.**
   - `ai.AiConnection` holds one provider account:
     - its kind: `OPENAI`, `ANTHROPIC`, `GEMINI`, `OPENAI_COMPATIBLE` (custom) or `OLLAMA`;
     - a name, and an address (null: the kind's own);
     - the key, encrypted, plus its last four characters;
     - the chat and embedding models, and their prices per million tokens;
     - `mayReceivePrivate` (§10.1's data-processing flag) and `enabled`.
   - The flag is off by default for every kind but Ollama. The admin ticks it only for a self-hosted model, or for a
     provider with a zero-retention agreement.
   - `AiProvider` gains the four new kinds; `AiUsage.connectionId` records which connection answered.
2. **Keys at rest.**
   - Keys are sealed with AES-256-GCM, under a key derived from a new secret, `AI_KEYS_SECRET`. Terraform generates
     it, locally and in the sandbox's Secrets Manager.
   - The API takes a key and never returns it, only `hasKey` and `keyHint`. Audit entries say only that the key
     changed.
   - Without the secret, no key can be saved, and the page says so.
   - A key that cannot be opened (the secret changed) makes its connection answer nothing.
3. **Who answers.** One row, `ai.AiSettings`, names the default connection for chats and the one for embeddings. For
   each call, in order:
   1. the task's route (`AiModelRoute`, now pointing at a connection, or at the default when null);
   2. the default connection;
   3. the environment's provider (`AI_PROVIDER`).
   - A disabled connection, or one whose key cannot be read, is skipped, so AI falls back rather than failing.
   - Every change raises `AiSettings.version`; each process checks it (one row by its key) before a call and reads the
     settings again when it moved, so a change on one API instance reaches the others and the worker at once.
4. **Adapters.**
   - **OpenAI dialect, for `OPENAI`, `GEMINI` and `OPENAI_COMPATIBLE`:**
     - structured answers via `response_format: json_schema`;
     - server-sent-event streaming, with the last chunk's usage;
     - pictures as data URLs and recordings as `input_audio`;
     - embeddings asked for 768 numbers. If the server refuses `dimensions`, it is asked without them and the size is
       checked.
     - Vectors are scaled to length 1.
     - A model that refuses `temperature` (OpenAI's reasoning models) is asked again without it.
   - **Anthropic:**
     - a structured answer is the input of one forced tool whose input schema is the answer's schema;
     - text streams from the Messages events.
     - A recording, or a request for embeddings, fails as `UnsupportedInput`. People see a plain message, and it does
       not count against the provider's circuit.
   - **Ollama:** as in ADR-0058, and an Ollama connection may point at another host.
   - Every adapter lists its account's models for the connection test.
5. **Breakers and budget.**
   - The circuit breaker is per connection: one failing provider does not stop tasks routed to another.
   - The monthly budget still counts every call's cost. Costs come from route prices, else connection prices.
6. **The page.**
   - The web's `/admin/ai`, for platform admins (checked against the current role, not the token), offers:
     - connections, each with a one-click test: one word from the chat model, one embedding (its size), and the models
       the account lists;
     - the two defaults;
     - tasks sent elsewhere.
   - Routes refuse a provider that cannot do the task: transcription to Claude, embeddings to Claude.
   - The month's spend is shown against the budget.
   - Every change is audited (`ai.connection.saved` and `.deleted`, `ai.defaults.changed`, `ai.route.saved` and
     `.deleted`).
   - The phone has no admin pages; platform admins use the web.
7. **Dormant until the owner sets it up.** With no connections, nothing changes: the environment's Ollama answers, as
   before.

## Consequences

- **Switching provider needs no deploy.**
  - Claude can answer tasks while Gemini transcribes and OpenAI makes embeddings.
  - A LiteLLM proxy brings any provider LiteLLM supports (Bedrock, Azure, Mistral…) with no new adapter.
- **Changing the embedding model re-embeds every note.** Chunks record their model, so the nightly job queues every
  published note again (ADR-0060), and meaning search uses the old vectors until then. The page warns about it.
- **Private notes stay local unless the admin says otherwise.** With a cloud provider chosen and its flag off, AI works
  on public notes only. Asking it about private ones answers "AI cannot work on private notes here."
- **Rotating `AI_KEYS_SECRET` makes saved keys unreadable.** They must be entered again, and their connections fall
  back meanwhile.
- **Prices are entered by hand.** The budget is only as right as the prices on the page. A wrong price trips the
  breaker early or late.
- **Exposure to outside services:** a connection test and a routed call send requests to the provider's address,
  which an admin chooses. Only platform admins can set it.
