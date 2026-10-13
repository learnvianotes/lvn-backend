# AI providers platform admins choose

- Date: 2026-10-13
- Package: `@lvn/contracts` (minor bump at merge)
- Spec: §10.1; ADR-0065
- Breaking: no

## What changes for clients

- New on the `ai` subgraph, for platform admins only (others get `FORBIDDEN`):
  - `aiSettings: AiSettings!`. It gives:
    - connections (`AiConnection`: kind, name, address, `hasKey` and `keyHint`, models, prices, `mayReceivePrivate`,
      `enabled`);
    - the default connections for chats and for embeddings;
    - the environment's own provider;
    - the task routes and the tasks a route can be set for;
    - the provider kinds (`AiProviderPreset`: default address, needs a key, can embed, can hear, model hints);
    - `keysCanBeSaved`, and the month's spend and budget.
  - Mutations, each with `userErrors`:
    - `saveAiConnection` (an empty `apiKey` keeps the saved key; `clearApiKey` removes it) and `deleteAiConnection`;
    - `setAiDefaults`;
    - `testAiConnection`, which answers `ok`, `message`, `latencyMs`, and the models the account lists;
    - `saveAiTaskRoute` and `deleteAiTaskRoute`.
- `enum AiProviderKind { OLLAMA OPENAI ANTHROPIC GEMINI OPENAI_COMPATIBLE }`.
- No existing field changes. With connections chosen, `aiStatus` reports on the default chat connection, and
  `UNAVAILABLE` can now say "The AI chosen here cannot hear recordings."

## Authorization

- Platform admins only, checked against the account's current role on every call.
- Keys are write-only: no query returns them, nor does the audit log.

## What clients should do

- The web: `/admin/ai`, linked from the account page for platform admins.
- The phone: nothing (no admin pages).
