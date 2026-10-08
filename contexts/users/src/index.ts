// Public surface of the `users` context. Nothing else is exported (spec §3).
import { usersTypeDefs } from './graphql/schema'
import { UsersModule } from './users.module'

export { UsersModule }
export type { UsersConfig } from './users.config'
/** Adapters at the edge of the context that a composition root (or a test) may bind differently. */
export { GOOGLE_ID_TOKENS, MX_LOOKUP, type GoogleIdTokens, type MxLookup, type ProviderIdentity } from './application/providers'

/** This context's federation subgraph, composed by apps/api's gateway (ADR-0033). */
export const usersSubgraph = { name: 'users', typeDefs: usersTypeDefs, modules: [UsersModule] }
