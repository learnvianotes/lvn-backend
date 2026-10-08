// Public surface of the `core` context. Nothing else is exported (spec §3).
import { coreTypeDefs } from './graphql/schema'
import { CoreModule } from './core.module'

export { CoreModule }
export { coreConfigFrom, type CoreConfig } from './core.config'

/** This context's federation subgraph, composed by apps/api's gateway (ADR-0033). */
export const coreSubgraph = { name: 'core', typeDefs: coreTypeDefs, modules: [CoreModule] }
