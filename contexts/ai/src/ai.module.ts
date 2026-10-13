import { Module, type DynamicModule } from '@nestjs/common'
import { AI_CONFIG, type AiConfig } from './ai.config'
import { AI_PROVIDER_ADAPTER, AiGateway } from './application/ai-gateway'
import { PromptLibrary } from './application/prompts'
import { AiResolver } from './graphql/ai.resolver'
import { OllamaProvider } from './infrastructure/ollama'

/**
 * The `ai` bounded context (spec §6.1) — Postgres schema `ai`.
 * Owns: AiGateway, providers, the task → model table, usage and quotas, prompts, AI tasks, RAG answers, the public-note
 * pipeline's AI steps, transcription, moderation scoring.
 * Imported only by the composition roots (apps/api, apps/worker); other contexts reach it through its facade
 * interface in libs/, never by importing this package (enforced by dependency-cruiser).
 * Needs PrismaModule, EventBusModule and the ENTITLEMENTS facade.
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
        AiResolver,
      ],
      exports: [AiGateway],
    }
  }
}
