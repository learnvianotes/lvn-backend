import { ErrorCode } from '@lvn/contracts/domain'

/**
 * The fixed error vocabulary of the API (§6.2). Throw an AppError for a failure the client should see; anything else
 * becomes INTERNAL with a generic message, and its details stay in the logs.
 */
export class AppError extends Error {
  override name = 'AppError'
  constructor(
    readonly code: ErrorCode,
    message: string,
    /** Dotted input path, e.g. ['input', 'email'] */
    readonly field?: string[],
    /** Seconds until a RATE_LIMITED caller may retry */
    readonly retryAfter?: number,
  ) {
    super(message)
  }
}

/** One expected failure returned in a mutation payload's `userErrors` (§6.2). */
export interface UserError {
  field?: string[]
  message: string
  code: ErrorCode
}

export const Errors = {
  unauthenticated: (message = 'Sign in to continue.') => new AppError(ErrorCode.UNAUTHENTICATED, message),
  forbidden: (message = 'You do not have permission to do that.') => new AppError(ErrorCode.FORBIDDEN, message),
  notFound: (message = 'Not found.') => new AppError(ErrorCode.NOT_FOUND, message),
  validation: (message: string, field?: string[]) => new AppError(ErrorCode.VALIDATION, message, field),
  conflict: (message: string, field?: string[]) => new AppError(ErrorCode.CONFLICT, message, field),
  rateLimited: (retryAfter: number, message = 'Too many attempts. Try again later.') => new AppError(ErrorCode.RATE_LIMITED, message, undefined, retryAfter),
}

/** An AppError as a payload entry. */
export const toUserError = (e: AppError): UserError => ({ code: e.code, message: e.message, ...(e.field ? { field: e.field } : {}) })

/**
 * Runs a mutation body and turns expected failures into `userErrors`; UNAUTHENTICATED, FORBIDDEN and anything
 * unexpected still throw, so clients handle them in one place.
 */
export async function withUserErrors<T extends object>(run: () => Promise<T>, empty: T): Promise<T & { userErrors: UserError[] }> {
  try {
    return { ...(await run()), userErrors: [] }
  } catch (e) {
    if (e instanceof AppError && (e.code === ErrorCode.VALIDATION || e.code === ErrorCode.CONFLICT || e.code === ErrorCode.NOT_FOUND || e.code === ErrorCode.RATE_LIMITED)) {
      return { ...empty, userErrors: [toUserError(e)] }
    }
    throw e
  }
}

export { ErrorCode }
