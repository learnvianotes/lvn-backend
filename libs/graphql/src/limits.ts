import type { ApolloServerPlugin } from '@apollo/server'
import { ErrorCode } from '@lvn-backend/errors'
import { noteOperation } from '@lvn-backend/observability'
import { GraphQLError, Kind, type DocumentNode, type FragmentDefinitionNode, type SelectionSetNode } from 'graphql'
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

/**
 * True when every top-level field of the operation is introspection (`__schema`, `__type`, `__typename`). Those are
 * exempt from the limits: the standard introspection query nests `ofType` deeper than any real query, and outside
 * development Apollo refuses introspection before the limits run.
 */
export function isIntrospectionOnly(document: DocumentNode, operationName?: string | null): boolean {
  const op = document.definitions.find((d) => d.kind === Kind.OPERATION_DEFINITION && (!operationName || d.name?.value === operationName))
  if (!op || op.kind !== Kind.OPERATION_DEFINITION) return false
  return op.selectionSet.selections.every((s) => s.kind === Kind.FIELD && s.name.value.startsWith('__'))
}

/**
 * A refusal of the request itself: VALIDATION with HTTP 400. Apollo answers 500 to anything else thrown from a plugin,
 * which would also report a client's mistake as a server failure.
 */
const refuse = (message: string) => new GraphQLError(message, { extensions: { code: ErrorCode.VALIDATION, http: { status: 400 } } })

/** Operations one signed-in person may send a minute (§17.1, ADR-0090): ten a second, far above what a session needs. */
export const OPERATIONS_PER_MINUTE = 600

/**
 * Says whether a request may run: null when it may, else the seconds until it may (§17.1, ADR-0090). Given by the app,
 * which keeps the counts (Redis).
 */
export type RateCheck = (contextValue: unknown) => Promise<number | null>

/**
 * Refuses a signed-in person's operations past OPERATIONS_PER_MINUTE with RATE_LIMITED, HTTP 429 and Retry-After,
 * before any resolver runs. Floods by address are the edge's to stop (AWS WAF), as one address may be a whole campus.
 */
export function rateLimitPlugin(check: RateCheck): ApolloServerPlugin {
  return {
    async requestDidStart() {
      return {
        async didResolveOperation({ document, request, contextValue }) {
          if (isIntrospectionOnly(document, request.operationName)) return
          const retryAfter = await check(contextValue)
          if (retryAfter === null) return
          throw new GraphQLError(`Too many requests. Try again in ${retryAfter} seconds.`, {
            extensions: { code: ErrorCode.RATE_LIMITED, retryAfter, http: { status: 429, headers: new Map([['retry-after', String(retryAfter)]]) } },
          })
        },
      }
    },
  }
}

/** Rejects too-deep or too-complex operations before any resolver runs. */
export function limitsPlugin(): ApolloServerPlugin {
  return {
    async requestDidStart() {
      return {
        async didResolveOperation({ request, document, schema, contextValue }) {
          // The operation name joins the request's log lines and its access-log entry (never the variables).
          noteOperation((contextValue as { req?: unknown }).req, request.operationName)
          if (isIntrospectionOnly(document, request.operationName)) return
          const depth = queryDepth(document, request.operationName)
          if (depth > MAX_DEPTH) throw refuse(`Query is too deep (${depth} > ${MAX_DEPTH}).`)
          let complexity: number
          try {
            complexity = getComplexity({
              schema,
              query: document,
              operationName: request.operationName ?? undefined,
              variables: request.variables ?? {},
              estimators: [simpleEstimator({ defaultComplexity: 1 })],
            })
          } catch (e) {
            // Complexity reads the variables before Apollo validates them; a missing or ill-typed one fails here.
            if (e instanceof GraphQLError) throw refuse(e.message)
            throw e
          }
          if (complexity > MAX_COMPLEXITY) throw refuse(`Query is too complex (${complexity} > ${MAX_COMPLEXITY}).`)
        },
      }
    },
  }
}
