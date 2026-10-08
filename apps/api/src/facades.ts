import { Global, Module, type Provider, type Type } from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'
import { MailService } from '@lvn-backend/communication'
import { ENTITLEMENTS, FILES, MAILER, POLICY } from '@lvn-backend/facades'
import { FilesService } from '@lvn-backend/notes'
import { EntitlementService, PolicyService } from '@lvn-backend/users'

/**
 * Binds each facade token (libs/facades) to the context that implements it (§6.5 step 5: after extraction the
 * binding becomes a gRPC/HTTP client with the same interface). The instance is looked up on first use, so this module
 * imports no context — GraphQL subgraphs follow module imports, and a context reachable from here would leak its
 * resolvers into every subgraph.
 */
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

@Global()
@Module({
  providers: [bind(MAILER, MailService), bind(FILES, FilesService), bind(POLICY, PolicyService), bind(ENTITLEMENTS, EntitlementService)],
  exports: [MAILER, FILES, POLICY, ENTITLEMENTS],
})
export class FacadesModule {}
