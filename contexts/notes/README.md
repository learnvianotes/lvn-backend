# `notes` context

Future microservice boundary (spec §3, §6.1, §6.5). Postgres schema: `notes`.

| | |
| --- | --- |
| Owns | subjects, topics, folders, tags, notes, cards, versions, shares, forks, FileObject, search indexing, SearchProvider (Postgres → Typesense) |
| Emits | NotePublished, NoteUnpublished, NoteForked, NoteShared, FileReady |
| Consumes | UserDeleted, GroupMembershipChanged, ClassroomMembershipChanged, NoteArtifactReady |

| Folder | Holds |
| --- | --- |
| `src/graphql/` | Resolvers, object types, inputs — this context's federation subgraph |
| `src/application/` | Use-case services |
| `src/domain/` | Entities, rules, events this context emits |
| `src/infrastructure/` | Prisma repositories (schema `notes` only), external adapters |
| `src/workers/` | BullMQ processors |
| `src/events/` | Handlers for other contexts' events → local read models |
| `src/index.ts` | The public facade — the only export |

Phase 0: empty module. Implementation starts in the phase that first needs it (spec §18).
