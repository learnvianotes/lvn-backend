# Every model of an AI connection

- Date: 2026-10-23
- Package: `@lvn/contracts` 0.63.0
- Spec: ADR-0065 (choosable AI providers)
- Breaking: no (one new query)

## What changes for clients

- **`Query.aiConnectionModels(input: AiConnectionIdInput!): [String!]!`**, platform admins only (`FORBIDDEN`
  otherwise, `UNAUTHENTICATED` signed out, `NOT_FOUND` for a connection that no longer exists). Every model the
  connection's account lists, sorted: Anthropic's `/v1/models` page after page (1000 a page), OpenAI's, Gemini's or a
  compatible server's `/models`, Ollama's `/api/tags`. It sends no chat or embedding, so it spends nothing. Empty
  when the provider does not list its models, cannot be reached or the key cannot be read.
- `testAiConnection`'s `models` now also follows Anthropic's pages.
- /admin/ai offers the full list in the chat, embedding and task-route model fields, loaded when the connection's
  dialog opens, and shows every model a test lists.

## Any model can answer

Nothing restricts the model names a connection or route may use (the presets' `chatModels` and `embedModels` are only
hints). So that any listed model can actually answer:

- Claude: a model that writes fewer tokens than the 8192 asked for (older models stop at 4096) is asked again for its
  own maximum, read from Anthropic's error; a model that refuses `temperature` is asked again without it (as before).
- OpenAI-style: a model that takes no JSON-schema answers (`response_format: json_schema`) is asked for a JSON object
  with the schema in its instructions; the gateway checks the answer against the schema as before.
- Embeddings must still give 768 numbers (the stored vectors' size); a model that cannot is refused with the
  provider's and our own words, as before.

## Migration

None.
