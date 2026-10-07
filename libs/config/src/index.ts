import { apiConfigSchema, loadConfig, workerConfigSchema, type ApiConfig, type WorkerConfig } from '@lvn/contracts/config'

/** Validated configuration for the backend processes (spec §16.1). Throws ConfigError at start-up. */
export const loadApiConfig = (env: NodeJS.ProcessEnv = process.env): ApiConfig => loadConfig(apiConfigSchema, env)
export const loadWorkerConfig = (env: NodeJS.ProcessEnv = process.env): WorkerConfig => loadConfig(workerConfigSchema, env)

export type { ApiConfig, WorkerConfig }
