import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { PrismaService } from '@lvn-backend/prisma-base'
import { AI_CONFIG, type AiConfig } from '../ai.config'
import { geminiFindings, geminiStartupDecision, type GeminiConnectionSignal, type GeminiRouteSignal } from '../domain/gemini-policy'

/**
 * Production refuses to boot when Gemini or Google Generative AI is configured. Other environments log a warning
 * and keep running, so local tests can still exercise an old connection. The log names the setting, never a key.
 */
@Injectable()
export class GeminiStartup implements OnModuleInit {
  private readonly log = new Logger('GeminiStartup')

  constructor(
    private readonly db: PrismaService,
    @Inject(AI_CONFIG) private readonly config: AiConfig,
  ) {}

  async onModuleInit(): Promise<void> {
    const [connections, routes] = await Promise.all([
      this.db.aiConnection.findMany({ select: { label: true, kind: true, enabled: true, baseUrl: true, chatModel: true, embedModel: true, apiKeyCipher: true } }),
      this.db.aiModelRoute.findMany({ select: { task: true, model: true, connection: { select: { kind: true } } } }),
    ])
    const decision = geminiStartupDecision(this.config.appEnv, geminiFindings({
      envNames: this.config.geminiEnvNames,
      connections: connections.map((row): GeminiConnectionSignal => ({ label: row.label, kind: row.kind, enabled: row.enabled, baseUrl: row.baseUrl, chatModel: row.chatModel, embedModel: row.embedModel, hasKey: !!row.apiKeyCipher })),
      routes: routes.map((route): GeminiRouteSignal => ({ task: route.task, model: route.model, connectionKind: route.connection?.kind ?? null })),
      chatModel: this.config.chatModel,
      embedModel: this.config.embedModel,
    }))
    if (!decision) return
    if (decision.refuse) {
      this.log.error(decision.message)
      throw new Error(decision.message)
    }
    this.log.warn(decision.message)
  }
}
