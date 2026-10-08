import {
  buildClientSchema,
  getIntrospectionQuery,
  getNamedType,
  isEnumType,
  isInputObjectType,
  isListType,
  isNonNullType,
  isObjectType,
  isScalarType,
  type GraphQLField,
  type GraphQLInputType,
  type GraphQLSchema,
  type IntrospectionQuery,
} from 'graphql'
import type { TestApp } from '../../support/app'

/** The public schema, as a client sees it through introspection. */
export async function publicSchema(t: TestApp): Promise<GraphQLSchema> {
  const res = await t.gql<IntrospectionQuery>(getIntrospectionQuery())
  return buildClientSchema(res.data!)
}

export interface Choices {
  /** Every UUID argument (the caller's own id tries self-escalation). */
  uuid: string
  /** Value for enum types named here (e.g. GlobalRole → PLATFORM_ADMIN); the first value otherwise. */
  enums: Record<string, string>
}

/** A value for every field of an input type — optional ones too, so a role hidden in an optional field is reached. */
export function valueFor(type: GraphQLInputType, choices: Choices, depth = 0): unknown {
  if (isNonNullType(type)) return valueFor(type.ofType, choices, depth)
  if (isListType(type)) return [valueFor(type.ofType, choices, depth)]
  if (isEnumType(type)) return choices.enums[type.name] ?? type.getValues()[0]!.value
  if (isInputObjectType(type)) {
    if (depth > 4) return null
    return Object.fromEntries(Object.values(type.getFields()).map((f) => [f.name, valueFor(f.type, choices, depth + 1)]))
  }
  if (isScalarType(type)) {
    switch (type.name) {
      case 'UUID':
      case 'ID':
        return choices.uuid
      case 'Int':
      case 'Float':
        return 1
      case 'Boolean':
        return true
      case 'DateTime':
        return new Date().toISOString()
      default:
        return 'fuzz-value@example.com'
    }
  }
  return null
}

/** `mutation Fuzz($a0: T!, …) { field(arg: $a0, …) { __typename } }` with generated variables. */
export function operationFor(field: GraphQLField<unknown, unknown>, choices: Choices): { query: string; variables: Record<string, unknown> } {
  const decls = field.args.map((a, i) => `$a${i}: ${String(a.type)}`)
  const args = field.args.map((a, i) => `${a.name}: $a${i}`)
  const selection = isObjectType(getNamedType(field.type)) ? ' { __typename }' : ''
  const query = `mutation Fuzz${decls.length ? `(${decls.join(', ')})` : ''} { ${field.name}${args.length ? `(${args.join(', ')})` : ''}${selection} }`
  const variables = Object.fromEntries(field.args.map((a, i) => [`a${i}`, valueFor(a.type, choices)]))
  return { query, variables }
}
