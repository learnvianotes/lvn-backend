# Model selects offer only models this app can call

- Date: 2026-10-23
- Package: `@lvn/contracts` 0.65.0 → **0.67.0**
- Spec: ADR-0065 (choosable AI providers)
- Breaking: yes, for a client that reads `aiConnectionModels` as `[String!]!`

**Version.** 0.65.0 is the current release. **0.66.0 is left free** for the seed-fix PR. This change is **0.67.0**.

## What changes for clients

`Query.aiConnectionModels` no longer returns `[String!]!`. It returns `AiConnectionModels!`:

```graphql
enum AiModelKind {
  CHAT
  EMBEDDING
  IMAGE
  AUDIO
  REALTIME
  TTS
  MODERATION
  OTHER
}

enum AiModelUse {
  CHAT
  EMBEDDING
  TRANSCRIBE
  IMAGE
  TTS
  AUDIO
  REALTIME
  MODERATION
}

type AiListedModel {
  id: String!
  kind: AiModelKind!
  supports: [AiModelUse!]!
}

type AiModelPicker {
  use: AiModelUse!
  models: [AiListedModel!]!
}

type AiConnectionModels {
  all: [AiListedModel!]!
  pickers: [AiModelPicker!]!
}

type Query {
  aiConnectionModels(input: AiConnectionIdInput!): AiConnectionModels!
}
```

The operation the `/admin/ai` selects should use:

```graphql
query AiConnectionModels($input: AiConnectionIdInput!) {
  aiConnectionModels(input: $input) {
    all { id kind supports }
    pickers { use models { id kind supports } }
  }
}
```

- `all` is every model the provider's models API returned, paged through when the provider splits the list. Nothing is dropped: not presets, not unknown ids, not image, speech, realtime or moderation models.
- `pickers` is one list per use, in this order: `CHAT`, `EMBEDDING`, `TRANSCRIBE`, `IMAGE`, `TTS`, `AUDIO`, `REALTIME`, `MODERATION`. A select shows `pickers` for that use and ignores the rest.
  - `CHAT`: the connection's chat model, and every task route except `EMBED` and `TRANSCRIBE`.
  - `EMBEDDING`: the connection's embedding model, and the `EMBED` route. Only models that can give 768 numbers (`text-embedding-ada-002` is listed and not offered).
  - `TRANSCRIBE`: the `TRANSCRIBE` route. A recording is sent through the chat API. Whisper and `*-transcribe` are not offered.
  - `IMAGE`, `TTS`, `AUDIO`, `REALTIME`, `MODERATION`: always empty. This app does not call those APIs. The models stay on `all` with their `kind`.
- Platform admins only (`FORBIDDEN` otherwise, `UNAUTHENTICATED` signed out, `NOT_FOUND` when the connection is gone). Empty lists when the provider lists nothing, cannot be reached, or the key cannot be read. Spends no tokens.
- `testAiConnection.test.models` is unchanged: every id, as `[String!]!`.

Saving a model the picker would not offer returns `userErrors` (`VALIDATION`) and does not save:

- `saveAiConnection` `chatModel` must support `CHAT`; `embedModel` must support `EMBEDDING`.
- `saveAiTaskRoute` `model` must support `EMBEDDING` for `EMBED`, `TRANSCRIBE` for `TRANSCRIBE`, and `CHAT` for every other task.

Claude models that reject a forced `tool_choice` (such as `claude-sonnet-5-5`) stay in the chat picker.

## Authorization

Platform admins only, as before.

## Migration

None for the database. Web: read `pickers` for each select, and `all` only as the reference list. A client still selecting the bare string list must select `all { id }` or `pickers { use models { id } }`.
