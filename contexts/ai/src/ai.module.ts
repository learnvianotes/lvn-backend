import { Module, type DynamicModule } from '@nestjs/common'
import { AI_CONFIG, type AiConfig } from './ai.config'
import { AiGateway } from './application/ai-gateway'
import { AiKeys } from './application/ai-keys'
import { AI_PROVIDER_ADAPTER, AiProviders } from './application/ai-providers'
import { AiSettingsService } from './application/ai-settings.service'
import { AiExport } from './application/ai-export'
import { AiTasksService } from './application/ai-tasks.service'
import { AiEmbeddings } from './application/ai-embeddings'
import { AskService } from './application/ask.service'
import { PublicPipeline } from './application/public-pipeline'
import { MediaInput } from './application/media-input'
import { NoteMaterial } from './application/note-material'
import { AiPageVision } from './application/page-vision'
import { AiSkillsReader } from './application/skills-reader'
import { AiDailyLines } from './application/daily-lines'
import { PromptLibrary } from './application/prompts'
import { AiResolver } from './graphql/ai.resolver'
import { AiSettingsResolver } from './graphql/ai-settings.resolver'
import { AiTasksResolver, NoteAiArtifactsResolver } from './graphql/ai-tasks.resolver'
import { AskResolver } from './graphql/ai-ask.resolver'
import { InsightsResolver, NoteInsightsResolver } from './graphql/ai-insights.resolver'
import { OllamaProvider } from './infrastructure/ollama'

/**
 * The `ai` bounded context (spec §6.1) — Postgres schema `ai`.
 * Owns: AiGateway, providers and the connections admins choose (ADR-0065), the task → model table, usage and quotas, prompts, AI tasks, RAG answers, the public-note
 * pipeline's AI steps, transcription, PDF pages read again (PAGE_VISION), moderation scoring.
 * Imported only by the composition roots (apps/api, apps/worker); other contexts reach it through its facade
 * interface in libs/, never by importing this package (enforced by dependency-cruiser).
 * Needs PrismaModule, QueueModule, EventBusModule and the ENTITLEMENTS, FILES, NOTE_AI, NOTE_RETRIEVAL, DOUBTS, LIVE, POLICY
 * and AUDIT facades.
 */
@Module({})
export class AiModule {
  static forRoot(config: AiConfig): DynamicModule {
    return {
      module: AiModule,
      providers: [
        { provide: AI_CONFIG, useValue: config },
        { provide: AI_PROVIDER_ADAPTER, useValue: config.provider === 'ollama' && config.ollama ? new OllamaProvider(config.ollama.url) : null },
        { provide: PromptLibrary, useValue: new PromptLibrary() },
        AiKeys,
        AiProviders,
        AiGateway,
        AiSettingsService,
        AiTasksService,
        MediaInput,
        NoteMaterial,
        AiPageVision,
        AiSkillsReader,
        AiDailyLines,
        AskService,
        PublicPipeline,
        AiEmbeddings,
        AiExport,
        AiResolver,
        AiTasksResolver,
        NoteAiArtifactsResolver,
        AskResolver,
        NoteInsightsResolver,
        InsightsResolver,
        AiSettingsResolver,
      ],
      exports: [AiGateway, AiTasksService, AskService, PublicPipeline, AiEmbeddings, AiExport, AiPageVision, AiSkillsReader, AiDailyLines],
    }
  }
}
