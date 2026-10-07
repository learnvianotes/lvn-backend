# `core` context

Future microservice boundary (spec §3, §6.1, §6.5). Postgres schema: `core`.

| | |
| --- | --- |
| Owns | groups, classrooms, quizzes, flashcards, exams, learning events, streaks, recommendations, resources, achievements, moderation, reports |
| Emits | GroupMembershipChanged, ClassroomMembershipChanged, CommentAdded, QuizPublished, ContentReported, LearningEventRecorded |
| Consumes | NotePublished, UserDeleted |

| Folder | Holds |
| --- | --- |
| `src/graphql/` | Resolvers, object types, inputs — this context's federation subgraph |
| `src/application/` | Use-case services |
| `src/domain/` | Entities, rules, events this context emits |
| `src/infrastructure/` | Prisma repositories (schema `core` only), external adapters |
| `src/workers/` | BullMQ processors |
| `src/events/` | Handlers for other contexts' events → local read models |
| `src/index.ts` | The public facade — the only export |

Phase 0: empty module. Implementation starts in the phase that first needs it (spec §18).
