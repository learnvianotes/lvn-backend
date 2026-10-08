import { Global, Module, type DynamicModule, type Provider, type Type } from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'

/** Nest probes every provider for these during start-up and shutdown; the implementation's own hooks already run. */
const NOT_FORWARDED = new Set<string | symbol>(['then', 'onModuleInit', 'onApplicationBootstrap', 'onModuleDestroy', 'beforeApplicationShutdown', 'onApplicationShutdown'])

function bind<T extends object>(token: symbol, implementation: Type<T>): Provider {
  return {
    provide: token,
    inject: [ModuleRef],
    useFactory: (ref: ModuleRef): T =>
      new Proxy({} as T, {
        get: (_, prop) => {
          if (NOT_FORWARDED.has(prop)) return undefined
          // Looked up on every call, never cached: while the app starts, Nest holds unconstructed placeholders.
          const target = ref.get(implementation, { strict: false })
          const value = target[prop as keyof T]
          return typeof value === 'function' ? value.bind(target) : value
        },
      }),
  }
}

/**
 * Binds each facade token to the context class that implements it (§6.5 step 5: after extraction the binding becomes
 * a gRPC/HTTP client with the same interface). The instance is looked up on use, so this module imports no context —
 * GraphQL subgraphs follow module imports, and a context reachable from a global module would leak its resolvers
 * into every subgraph.
 */
@Global()
@Module({})
export class FacadesModule {
  static bind(bindings: [token: symbol, implementation: Type<object>][]): DynamicModule {
    return { module: FacadesModule, providers: bindings.map(([token, impl]) => bind(token, impl)), exports: bindings.map(([token]) => token) }
  }
}
