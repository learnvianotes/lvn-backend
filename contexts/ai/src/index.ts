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
/** Study aids for public notes (ADR-0061). */
export { PIPELINE_TASKS, PublicPipeline } from './application/public-pipeline'
/** Recordings and photos for the model (ADR-0062). */
export { MAX_IMAGES, MAX_SECONDS, PIECE_SECONDS } from './application/media-input'
/** PDF pages the vision model reads again (ADR-0063): the PAGE_VISION facade. */
export { AiPageVision } from './application/page-vision'
/** Teachers' public pages read into Skills tab items (ADR-0077): the SKILLS_READER facade. */
export { AiSkillsReader } from './application/skills-reader'

/** This context's federation subgraph, composed by apps/api's gateway (ADR-0033). */
export const aiSubgraph = { name: 'ai', typeDefs: aiTypeDefs, modules: [AiModule] }
