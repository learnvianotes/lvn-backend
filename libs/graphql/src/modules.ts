import { IntrospectAndCompose, LocalGraphQLDataSource, type SupergraphSdlHook } from '@apollo/gateway'
import { ApolloServerPluginInlineTraceDisabled } from '@apollo/server/plugin/disabled'
import { ApolloFederationDriver, ApolloGatewayDriver, type ApolloFederationDriverConfig, type ApolloGatewayDriverConfig } from '@nestjs/apollo'
import { Module, type DynamicModule, type InjectionToken, type Type } from '@nestjs/common'
import { GraphQLModule } from '@nestjs/graphql'
import { composeSupergraph } from './compose'
import { formatError } from './errors'
import { limitsPlugin } from './limits'
import { DateTimeScalar, UuidScalar } from './scalars'
import { SubgraphRegistry } from './subgraph-registry'

/** Path prefix of the subgraph endpoints Nest mounts; apps/api answers them with 404 (only the gateway is public). */
export const SUBGRAPH_PATH_PREFIX = '/_subgraph'

/** Scalars every subgraph declares (`scalar UUID`, `scalar DateTime` in its SDL). */
@Module({ providers: [UuidScalar, DateTimeScalar], exports: [UuidScalar, DateTimeScalar] })
export class GraphqlCommonModule {}

/** What resolvers receive as context: the HTTP request and response, and whatever the gateway's factory adds. */
export type RequestContextFactory = (input: { req: unknown; res: unknown }) => object | Promise<object>

/**
 * One context's federation subgraph (§6, Federation 2): its own SDL and the resolvers of its modules (ADR-0033 —
 * schema-first, because Nest's code-first type registry is shared by the whole process). The schema is handed to
 * the gateway through the app's SubgraphRegistry.
 */
function subgraphModule(registry: SubgraphRegistry, { name, typeDefs, modules }: SubgraphDefinition): DynamicModule {
  return GraphQLModule.forRoot<ApolloFederationDriverConfig>({
    driver: ApolloFederationDriver,
    typeDefs,
    include: [...modules, GraphqlCommonModule],
    path: `${SUBGRAPH_PATH_PREFIX}/${name}`,
    playground: false,
    introspection: false,
    // Traces are for Apollo's cloud; ours come from OpenTelemetry (§16.5).
    plugins: [ApolloServerPluginInlineTraceDisabled()],
    transformSchema: (schema) => {
      registry.register(name, schema)
      return schema
    },
  })
}

/** One context's subgraph, as its facade exports it. */
export interface SubgraphDefinition {
  name: string
  /** The context's SDL (Federation 2, `extend schema @link(...)`) */
  typeDefs: string
  /** The context's modules whose resolvers make up the subgraph */
  modules: Type[]
}

export interface GraphqlOptions {
  /** Every context that serves GraphQL, in a stable order. */
  subgraphs: readonly SubgraphDefinition[]
  /** Builds the per-request context (the authenticated viewer, request id, …) from injected providers. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Nest's factory signature
  context: { inject?: InjectionToken[]; useFactory: (...deps: any[]) => RequestContextFactory }
  /** Introspection and the landing page: development only. */
  introspection: boolean
}

/** Composes the in-process subgraphs and executes against them directly. */
const localSupergraph = (registry: SubgraphRegistry, names: readonly string[]): SupergraphSdlHook => async () => {
  await registry.whenReady(names)
  return { supergraphSdl: composeSupergraph(names.map((name) => ({ name, schema: registry.get(name) }))) }
}

/**
 * The GraphQL modules of one app: a federation subgraph per context, and the public endpoint (`/graphql`) — Apollo
 * Gateway composing those subgraphs in-process (§6). After a context is extracted (§6.5 step 4) its subgraph moves
 * behind Apollo Router; the clients see one schema either way.
 */
export function graphqlModules(options: GraphqlOptions): DynamicModule[] {
  const registry = new SubgraphRegistry()
  const names = options.subgraphs.map((s) => s.name)
  const gateway = GraphQLModule.forRootAsync<ApolloGatewayDriverConfig>({
    driver: ApolloGatewayDriver,
    inject: options.context.inject ?? [],
    useFactory: (...deps: unknown[]) => ({
      server: {
        path: '/graphql',
        context: options.context.useFactory(...deps),
        formatError,
        introspection: options.introspection,
        plugins: [limitsPlugin()],
        csrfPrevention: true,
        includeStacktraceInErrorResponses: false,
      },
      gateway: {
        supergraphSdl: localSupergraph(registry, names),
        buildService: ({ name }) => new LocalGraphQLDataSource(registry.get(name)),
      },
    }),
  })
  return [...options.subgraphs.map((definition) => subgraphModule(registry, definition)), gateway]
}

// Kept for the extraction playbook: a gateway that introspects remote subgraphs instead of local schemas.
export { IntrospectAndCompose }
