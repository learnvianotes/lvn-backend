import { apiConfigSchema, loadConfig, workerConfigSchema, type ApiConfig, type WorkerConfig } from '@lvn/contracts/config'

/** Validated configuration for the backend processes (spec §16.1). Throws ConfigError at start-up. */
export const loadApiConfig = (env: NodeJS.ProcessEnv = process.env): ApiConfig => loadConfig(apiConfigSchema, env)
export const loadWorkerConfig = (env: NodeJS.ProcessEnv = process.env): WorkerConfig => loadConfig(workerConfigSchema, env)

/**
 * The process environment, so a context can scan variable names without reading `process.env` itself.
 * Contexts are not allowed to touch the environment directly.
 */
export const currentProcessEnv = (env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv => env

export type { ApiConfig, WorkerConfig }
