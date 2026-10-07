// Public surface of the `users` context. Nothing else is exported (spec §3).
import { usersTypeDefs } from './graphql/schema'
import { UsersModule } from './users.module'

export { UsersModule }

/** This context's federation subgraph, composed by apps/api's gateway (ADR-0033). */
export const usersSubgraph = { name: 'users', typeDefs: usersTypeDefs, modules: [UsersModule] }
