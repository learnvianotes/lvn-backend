import { Errors } from '@lvn-backend/errors'
import { GraphQLError } from 'graphql'
import { formatError } from '../../src/errors'

describe('formatError', () => {
  it('keeps an AppError message, code, field and retry delay', () => {
    const err = new GraphQLError('wrapped', { originalError: Errors.validation('Too short', ['input', 'password']) })
    expect(formatError({ message: 'wrapped', path: ['signUp'] }, err)).toEqual({
      message: 'Too short',
      path: ['signUp'],
      extensions: { code: 'VALIDATION', field: ['input', 'password'] },
    })
    const limited = formatError({ message: 'x' }, Errors.rateLimited(60))
    expect(limited.extensions).toEqual({ code: 'RATE_LIMITED', retryAfter: 60 })
  })

  it('finds an AppError wrapped several times (resolver → subgraph → gateway)', () => {
    const inner = new GraphQLError('a', { originalError: Errors.forbidden() })
    const outer = new GraphQLError('b', { originalError: inner })
    expect(formatError({ message: 'b' }, outer).extensions).toEqual({ code: 'FORBIDDEN' })
  })

  it('maps graphql-js validation failures to VALIDATION', () => {
    expect(formatError({ message: 'Cannot query field "x"', extensions: { code: 'GRAPHQL_VALIDATION_FAILED' } }, new Error()).extensions).toEqual({ code: 'VALIDATION' })
  })

  it('hides everything else behind INTERNAL', () => {
    const out = formatError({ message: 'connect ECONNREFUSED 10.0.0.5:5432', extensions: { code: 'INTERNAL_SERVER_ERROR', stacktrace: ['at x'] } }, new Error('db down'))
    expect(out).toEqual({ message: 'Something went wrong. Please try again.', path: undefined, extensions: { code: 'INTERNAL' } })
  })
})
