// Public surface of the `ai` context. Nothing else is exported (spec §3).
import { aiTypeDefs } from './graphql/schema'
import { AiModule } from './ai.module'

export { AiModule }
export { aiConfigFrom, type AiConfig } from './ai.config'
/** The gateway every AI call goes through (§10.1, ADR-0058); the worker's AI jobs use it too. */
export { AiGateway } from './application/ai-gateway'
/** AI tasks (ADR-0059): the worker runs the queued ones; the AI part of a data export. */
export { AI_TASKS_QUEUE, AiTasksService } from './application/ai-tasks.service'
export { AiExport } from './application/ai-export'
/** Ask AI (ADR-0060): the worker runs queued questions; AiEmbeddings is the EMBEDDINGS facade. */
export { AskService } from './application/ask.service'
export { AiEmbeddings } from './application/ai-embeddings'

/** This context's federation subgraph, composed by apps/api's gateway (ADR-0033). */
export const aiSubgraph = { name: 'ai', typeDefs: aiTypeDefs, modules: [AiModule] }
