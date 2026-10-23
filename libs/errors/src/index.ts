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
  field: string[] | null
  message: string
  code: ErrorCode
}

export const Errors = {
  unauthenticated: (message = 'Sign in to continue.') => new AppError(ErrorCode.UNAUTHENTICATED, message),
  forbidden: (message = 'You do not have permission to do that.', field?: string[]) => new AppError(ErrorCode.FORBIDDEN, message, field),
  notFound: (message = 'Not found.') => new AppError(ErrorCode.NOT_FOUND, message),
  validation: (message: string, field?: string[]) => new AppError(ErrorCode.VALIDATION, message, field),
  conflict: (message: string, field?: string[]) => new AppError(ErrorCode.CONFLICT, message, field),
  rateLimited: (retryAfter: number, message = 'Too many attempts. Try again later.') => new AppError(ErrorCode.RATE_LIMITED, message, undefined, retryAfter),
  unavailable: (message: string) => new AppError(ErrorCode.UNAVAILABLE, message),
  underMinimumAge: (message: string, field?: string[]) => new AppError(ErrorCode.UNDER_MINIMUM_AGE, message, field),
}

/** An AppError as a payload entry. */
export const toUserError = (e: AppError): UserError => ({ code: e.code, message: e.message, field: e.field ?? null })

type Body<P> = Omit<P, 'userErrors'>

/**
 * Runs a mutation body and turns expected failures (VALIDATION, CONFLICT, NOT_FOUND, RATE_LIMITED, UNAVAILABLE,
 * UNDER_MINIMUM_AGE) into the payload's `userErrors`; UNAUTHENTICATED, FORBIDDEN and anything unexpected still throw, so
 * clients handle them in one place.
 * `P` is the payload type, e.g. `withUserErrors<AuthPayload>(…)`.
 */
export async function withUserErrors<P extends { userErrors: UserError[] }>(run: () => Promise<Body<P>>, empty: Body<P>): Promise<P> {
  try {
    return { ...(await run()), userErrors: [] } as unknown as P
  } catch (e) {
    if (e instanceof AppError && (e.code === ErrorCode.VALIDATION || e.code === ErrorCode.CONFLICT || e.code === ErrorCode.NOT_FOUND || e.code === ErrorCode.RATE_LIMITED || e.code === ErrorCode.UNAVAILABLE || e.code === ErrorCode.UNDER_MINIMUM_AGE)) {
      return { ...empty, userErrors: [toUserError(e)] } as unknown as P
    }
    throw e
  }
}

export { ErrorCode }
