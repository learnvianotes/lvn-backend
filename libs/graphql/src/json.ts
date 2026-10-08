import { type CustomScalar, Scalar } from '@nestjs/graphql'
import { Kind, type ObjectFieldNode, type ValueNode } from 'graphql'

function literal(ast: ValueNode): unknown {
  switch (ast.kind) {
    case Kind.STRING:
    case Kind.BOOLEAN:
      return ast.value
    case Kind.INT:
    case Kind.FLOAT:
      return Number(ast.value)
    case Kind.NULL:
      return null
    case Kind.LIST:
      return ast.values.map(literal)
    case Kind.OBJECT:
      return Object.fromEntries(ast.fields.map((f: ObjectFieldNode) => [f.name.value, literal(f.value)]))
    default:
      return undefined
  }
}

/**
 * Structured values the API validates itself (card content: Tiptap JSON checked per card type by
 * `@lvn/contracts/validation`). Declared only by subgraphs that use it (`scalar JSON`), which provide this class.
 */
@Scalar('JSON')
export class JsonScalar implements CustomScalar<unknown, unknown> {
  description = 'A JSON value whose shape the field documents'
  parseValue(value: unknown): unknown {
    return value
  }
  serialize(value: unknown): unknown {
    return value
  }
  parseLiteral(ast: ValueNode): unknown {
    return literal(ast)
  }
}
