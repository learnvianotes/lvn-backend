import type { ApiConfig } from '@lvn/contracts/config'

/** What the `ai` context needs from the configuration (ADR-0058). */
export interface AiConfig {
  /** `none`: AI is off, and says so */
  provider: 'none' | 'ollama'
  ollama: { url: string } | null
  /** Defaults when the task → model table has no row */
  chatModel: string | null
  embedModel: string | null
  timeoutMs: number
  /** The environment's monthly budget in millionths of a dollar; null: no cap */
  monthlyBudgetMicroUsd: number | null
  /** Study aids for public notes when they are published (ADR-0061) */
  publicPipeline: boolean
  /** Encrypts the provider keys platform admins save (ADR-0065); null: keys cannot be saved */
  keysSecret: string | null
}

export const AI_CONFIG = Symbol('AI_CONFIG')

export const aiConfigFrom = (c: ApiConfig): AiConfig => ({
  provider: c.AI_PROVIDER,
  ollama: c.OLLAMA_URL ? { url: c.OLLAMA_URL } : null,
  chatModel: c.AI_CHAT_MODEL ?? null,
  embedModel: c.AI_EMBED_MODEL ?? null,
  timeoutMs: c.AI_TIMEOUT_MS,
  monthlyBudgetMicroUsd: c.AI_MONTHLY_BUDGET_MICRO_USD ?? null,
  publicPipeline: c.AI_PUBLIC_PIPELINE,
  keysSecret: c.AI_KEYS_SECRET ?? null,
})
