# `users` context

Future microservice boundary (spec §3, §6.1, §6.5). Postgres schema: `users`.

| | |
| --- | --- |
| Owns | auth, sessions, users, profiles, roles, PolicyService, device tokens, organizations (read model from the admin app) |
| Emits | UserRegistered, UserDeleted, RoleChanged, SessionRevoked |
| Consumes | GroupMembershipChanged, ClassroomMembershipChanged |

| Folder | Holds |
| --- | --- |
| `src/graphql/` | Resolvers, object types, inputs — this context's federation subgraph |
| `src/application/` | Use-case services |
| `src/domain/` | Entities, rules, events this context emits |
| `src/infrastructure/` | Prisma repositories (schema `users` only), external adapters |
| `src/workers/` | BullMQ processors |
| `src/events/` | Handlers for other contexts' events → local read models |
| `src/index.ts` | The public facade — the only export |

Phase 0: empty module. Implementation starts in the phase that first needs it (spec §18).
