import type { INestApplicationContext } from '@nestjs/common'
import { flushErrors } from './error-reporting'
import type { Telemetry } from './telemetry'

/**
 * Stops an app on SIGTERM/SIGINT (ECS sends SIGTERM before a task is replaced, §16.2): Nest's shutdown hooks first
 * (queues, connections), then pending spans, metrics and error reports are flushed, then the process exits.
 * Used instead of `enableShutdownHooks()`, which re-raises the signal before telemetry could be flushed.
 */
export function stopOnSignals(app: INestApplicationContext, telemetry: Telemetry, onClose: () => Promise<void> = async () => undefined): void {
  let stopping = false
  const stop = async (signal: NodeJS.Signals) => {
    if (stopping) return
    stopping = true
    try {
      await app.close()
      await onClose()
    } finally {
      await Promise.allSettled([telemetry.shutdown(), flushErrors()])
      process.exit(signal === 'SIGINT' ? 130 : 0)
    }
  }
  process.once('SIGTERM', () => void stop('SIGTERM'))
  process.once('SIGINT', () => void stop('SIGINT'))
}
