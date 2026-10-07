import type { ApolloServerPlugin } from '@apollo/server'
import { AppError, ErrorCode } from '@lvn-backend/errors'
import { Kind, type DocumentNode, type FragmentDefinitionNode, type SelectionSetNode } from 'graphql'
import { getComplexity, simpleEstimator } from 'graphql-query-complexity'

/** Query depth limit 8 and complexity limit 1000 (§6.2). */
export const MAX_DEPTH = 8
export const MAX_COMPLEXITY = 1000

/** Deepest field nesting of the selected operation, following fragments; introspection fields count too. */
export function queryDepth(document: DocumentNode, operationName?: string | null): number {
  const fragments = new Map<string, FragmentDefinitionNode>()
  for (const d of document.definitions) if (d.kind === Kind.FRAGMENT_DEFINITION) fragments.set(d.name.value, d)
  const op = document.definitions.find(
    (d) => d.kind === Kind.OPERATION_DEFINITION && (!operationName || d.name?.value === operationName),
  )
  if (!op || op.kind !== Kind.OPERATION_DEFINITION) return 0
  const depth = (set: SelectionSetNode | undefined, seen: Set<string>): number => {
    if (!set) return 0
    let max = 0
    for (const s of set.selections) {
      if (s.kind === Kind.FIELD) max = Math.max(max, s.selectionSet ? 1 + depth(s.selectionSet, seen) : 1)
      else if (s.kind === Kind.INLINE_FRAGMENT) max = Math.max(max, depth(s.selectionSet, seen))
      else if (!seen.has(s.name.value)) max = Math.max(max, depth(fragments.get(s.name.value)?.selectionSet, new Set([...seen, s.name.value])))
    }
    return max
  }
  return depth(op.selectionSet, new Set())
}

/** Rejects too-deep or too-complex operations before any resolver runs. */
export function limitsPlugin(): ApolloServerPlugin {
  return {
    async requestDidStart() {
      return {
        async didResolveOperation({ request, document, schema }) {
          const depth = queryDepth(document, request.operationName)
          if (depth > MAX_DEPTH) throw new AppError(ErrorCode.VALIDATION, `Query is too deep (${depth} > ${MAX_DEPTH}).`)
          const complexity = getComplexity({
            schema,
            query: document,
            operationName: request.operationName ?? undefined,
            variables: request.variables ?? {},
            estimators: [simpleEstimator({ defaultComplexity: 1 })],
          })
          if (complexity > MAX_COMPLEXITY) throw new AppError(ErrorCode.VALIDATION, `Query is too complex (${complexity} > ${MAX_COMPLEXITY}).`)
        },
      }
    },
  }
}
