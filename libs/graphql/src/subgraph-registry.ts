import type { GraphQLSchema } from 'graphql'

/**
 * The executable schema of every context's subgraph in one app. Each subgraph GraphQLModule stores its schema here
 * when Nest builds it; the gateway composes the supergraph from these and executes against them directly
 * (LocalGraphQLDataSource) — no HTTP between gateway and subgraphs while they share a process (spec §6).
 */
export class SubgraphRegistry {
  private readonly schemas = new Map<string, GraphQLSchema>()
  private readonly waiters = new Set<() => void>()

  register(name: string, schema: GraphQLSchema): void {
    this.schemas.set(name, schema)
    this.waiters.forEach((wake) => wake())
  }

  get(name: string): GraphQLSchema {
    const schema = this.schemas.get(name)
    if (!schema) throw new Error(`Subgraph "${name}" has not been built`)
    return schema
  }

  /** Resolves once every expected subgraph has registered (Nest builds them during module init). */
  async whenReady(names: readonly string[], timeoutMs = 10_000): Promise<void> {
    const missing = () => names.filter((n) => !this.schemas.has(n))
    if (!missing().length) return
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters.delete(check)
        reject(new Error(`Subgraphs never built: ${missing().join(', ')}`))
      }, timeoutMs)
      const check = () => {
        if (missing().length) return
        clearTimeout(timer)
        this.waiters.delete(check)
        resolve()
      }
      this.waiters.add(check)
    })
  }
}
