# `ai` context

Future microservice boundary (spec §3, §6.1, §6.5). Postgres schema: `ai`.

| | |
| --- | --- |
| Owns | AiGateway, providers, usage and quotas, NoteChunk embeddings, RAG, public-note pipeline, transcription, moderation scoring |
| Emits | NoteArtifactReady, ModerationScored, AiBudgetThreshold |
| Consumes | NotePublished, NoteUnpublished, FileReady, UserDeleted |

| Folder | Holds |
| --- | --- |
| `src/graphql/` | Resolvers, object types, inputs — this context's federation subgraph |
| `src/application/` | Use-case services |
| `src/domain/` | Entities, rules, events this context emits |
| `src/infrastructure/` | Prisma repositories (schema `ai` only), external adapters |
| `src/workers/` | BullMQ processors |
| `src/events/` | Handlers for other contexts' events → local read models |
| `src/index.ts` | The public facade — the only export |

Phase 0: empty module. Implementation starts in the phase that first needs it (spec §18).
