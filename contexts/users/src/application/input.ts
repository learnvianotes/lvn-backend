import { Errors } from '@lvn-backend/errors'
import type { z } from 'zod'

/** Parses one input field with its schema; the first problem becomes VALIDATION on input.<name>. */
export function parseField<S extends z.ZodType>(schema: S, value: unknown, name: string): z.infer<S> {
  const result = schema.safeParse(value)
  if (!result.success) throw Errors.validation(result.error.issues[0]?.message ?? 'Invalid value.', ['input', name])
  return result.data
}
