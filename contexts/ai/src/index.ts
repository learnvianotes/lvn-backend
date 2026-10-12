// Public surface of the `ai` context. Nothing else is exported (spec §3).
import { aiTypeDefs } from './graphql/schema'
import { AiModule } from './ai.module'

export { AiModule }
export { aiConfigFrom, type AiConfig } from './ai.config'
/** The gateway every AI call goes through (§10.1, ADR-0058); the worker's AI jobs use it too. */
export { AiGateway } from './application/ai-gateway'

/** This context's federation subgraph, composed by apps/api's gateway (ADR-0033). */
export const aiSubgraph = { name: 'ai', typeDefs: aiTypeDefs, modules: [AiModule] }
