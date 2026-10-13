import { Module, type DynamicModule } from '@nestjs/common'
import { AI_CONFIG, type AiConfig } from './ai.config'
import { AI_PROVIDER_ADAPTER, AiGateway } from './application/ai-gateway'
import { AiExport } from './application/ai-export'
import { AiTasksService } from './application/ai-tasks.service'
import { PromptLibrary } from './application/prompts'
import { AiResolver } from './graphql/ai.resolver'
import { AiTasksResolver, NoteAiArtifactsResolver } from './graphql/ai-tasks.resolver'
import { OllamaProvider } from './infrastructure/ollama'

/**
 * The `ai` bounded context (spec §6.1) — Postgres schema `ai`.
 * Owns: AiGateway, providers, the task → model table, usage and quotas, prompts, AI tasks, RAG answers, the public-note
 * pipeline's AI steps, transcription, moderation scoring.
 * Imported only by the composition roots (apps/api, apps/worker); other contexts reach it through its facade
 * interface in libs/, never by importing this package (enforced by dependency-cruiser).
 * Needs PrismaModule, QueueModule, EventBusModule and the ENTITLEMENTS and NOTE_AI facades.
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
        AiGateway,
        AiTasksService,
        AiExport,
        AiResolver,
        AiTasksResolver,
        NoteAiArtifactsResolver,
      ],
      exports: [AiGateway, AiTasksService, AiExport],
    }
  }
}
