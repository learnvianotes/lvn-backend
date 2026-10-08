import type { ApiConfig } from '@lvn/contracts/config'

/** What the core context needs from the API configuration. */
export interface CoreConfig {
  /** Old-site snapshots (ADR-0023): the restricted bucket and the environment prefix */
  legacy: { bucket: string; env: string }
}

export const CORE_CONFIG = Symbol('CORE_CONFIG')

export const coreConfigFrom = (c: ApiConfig): CoreConfig => ({ legacy: { bucket: c.S3_RESTRICTED_BUCKET, env: c.APP_ENV } })
