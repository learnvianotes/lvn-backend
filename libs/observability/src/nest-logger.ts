import type { LoggerService } from '@nestjs/common'
import type { Logger } from 'pino'

/**
 * Nest's logger interface on top of pino, so framework messages (start-up, route mapping, exceptions) are JSON lines
 * like everything else. Nest passes the context name last and, for errors, the stack before it.
 */
export class PinoNestLogger implements LoggerService {
  constructor(private readonly logger: Logger) {}

  log(message: unknown, ...rest: unknown[]): void {
    this.write('info', message, rest)
  }
  error(message: unknown, ...rest: unknown[]): void {
    this.write('error', message, rest)
  }
  warn(message: unknown, ...rest: unknown[]): void {
    this.write('warn', message, rest)
  }
  debug(message: unknown, ...rest: unknown[]): void {
    this.write('debug', message, rest)
  }
  verbose(message: unknown, ...rest: unknown[]): void {
    this.write('trace', message, rest)
  }
  fatal(message: unknown, ...rest: unknown[]): void {
    this.write('fatal', message, rest)
  }

  private write(level: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace', message: unknown, rest: unknown[]): void {
    const args = [...rest]
    const context = typeof args.at(-1) === 'string' ? (args.pop() as string) : undefined
    const stack = level === 'error' && typeof args[0] === 'string' && args[0].includes('\n    at ') ? (args.shift() as string) : undefined
    const fields: Record<string, unknown> = context ? { context } : {}
    if (message instanceof Error) {
      this.logger[level]({ ...fields, err: message }, message.message)
    } else if (typeof message === 'object' && message !== null) {
      this.logger[level]({ ...fields, ...(message as object) })
    } else {
      this.logger[level](stack ? { ...fields, stack } : fields, String(message))
    }
  }
}
