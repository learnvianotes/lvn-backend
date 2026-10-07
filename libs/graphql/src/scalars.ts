import { type CustomScalar, Scalar } from '@nestjs/graphql'
import { Kind, type ValueNode } from 'graphql'
import { Errors } from '@lvn-backend/errors'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** UUID ids (§4.6). Malformed input fails as VALIDATION before reaching a resolver. */
@Scalar('UUID')
export class UuidScalar implements CustomScalar<string, string> {
  description = 'A UUID (all LVN ids are UUIDv7)'
  parseValue(value: unknown): string {
    if (typeof value !== 'string' || !UUID.test(value)) throw Errors.validation('Expected a UUID.')
    return value.toLowerCase()
  }
  serialize(value: unknown): string {
    return String(value)
  }
  parseLiteral(ast: ValueNode): string {
    if (ast.kind !== Kind.STRING) throw Errors.validation('Expected a UUID.')
    return this.parseValue(ast.value)
  }
}

/** ISO-8601 timestamps in UTC. */
@Scalar('DateTime')
export class DateTimeScalar implements CustomScalar<string, Date> {
  description = 'An ISO-8601 date-time in UTC'
  parseValue(value: unknown): Date {
    const d = typeof value === 'string' ? new Date(value) : null
    if (!d || Number.isNaN(d.getTime())) throw Errors.validation('Expected an ISO-8601 date-time.')
    return d
  }
  serialize(value: unknown): string {
    const d = value instanceof Date ? value : new Date(String(value))
    return d.toISOString()
  }
  parseLiteral(ast: ValueNode): Date {
    if (ast.kind !== Kind.STRING) throw Errors.validation('Expected an ISO-8601 date-time.')
    return this.parseValue(ast.value)
  }
}
