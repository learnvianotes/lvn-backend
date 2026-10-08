import { Logger } from '@nestjs/common'
import { AppError, ErrorCode } from '@lvn-backend/errors'
import { reportError } from '@lvn-backend/observability'
import { GraphQLError, type GraphQLFormattedError } from 'graphql'

const CODES = new Set<string>(Object.values(ErrorCode))
const log = new Logger('GraphQL')

/**
 * Every error leaves the API with one of the fixed codes and no stack trace (§6.2). AppErrors keep their message;
 * GraphQL validation errors are VALIDATION; anything else is INTERNAL with a generic message.
 */
export function formatError(formatted: GraphQLFormattedError, error: unknown): GraphQLFormattedError {
  const original = findAppError(error)
  const path = formatted.path
  if (original instanceof AppError) {
    return {
      message: original.message,
      path,
      extensions: {
        code: original.code,
        ...(original.field ? { field: original.field } : {}),
        ...(original.retryAfter ? { retryAfter: original.retryAfter } : {}),
      },
    }
  }
  const code = formatted.extensions?.code
  if (typeof code === 'string' && CODES.has(code)) return { message: formatted.message, path, extensions: { code } }
  // Parse and validation failures from graphql-js / Apollo (GRAPHQL_VALIDATION_FAILED, BAD_USER_INPUT, …).
  if (code === 'GRAPHQL_VALIDATION_FAILED' || code === 'GRAPHQL_PARSE_FAILED' || code === 'BAD_USER_INPUT' || code === 'BAD_REQUEST') {
    return { message: formatted.message, path, extensions: { code: ErrorCode.VALIDATION } }
  }
  // The client gets a generic message; the cause stays in the server logs (§6.2, §7.2).
  const cause = (error as { originalError?: unknown })?.originalError ?? error
  log.error(`${path?.join('.') ?? 'operation'}: ${cause instanceof Error ? (cause.stack ?? cause.message) : String(cause)}`)
  reportError(cause, { path: path?.join('.') })
  return { message: 'Something went wrong. Please try again.', path, extensions: { code: ErrorCode.INTERNAL } }
}

/** The AppError behind an error, however many times resolvers, the gateway or plugins wrapped it. */
function findAppError(error: unknown): AppError | undefined {
  for (let e = error, depth = 0; e && depth < 10; depth++) {
    if (e instanceof AppError) return e
    e = (e as { originalError?: unknown }).originalError
  }
  return undefined
}

/** An AppError as a GraphQLError, for code that must throw graphql-js errors (plugins). */
export const toGraphQLError = (e: AppError): GraphQLError => new GraphQLError(e.message, { extensions: { code: e.code } })
