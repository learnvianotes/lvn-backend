import type { DynamicModule } from '@nestjs/common'
import type { ApiConfig } from '@lvn-backend/config'
import { AiModule, aiConfigFrom, aiSubgraph } from '@lvn-backend/ai'
import { CommunicationModule, communicationConfigFrom, communicationSubgraph } from '@lvn-backend/communication'
import { CoreModule, coreConfigFrom, coreSubgraph } from '@lvn-backend/core'
import type { SubgraphDefinition } from '@lvn-backend/graphql'
import { NotesModule, notesConfigFrom, notesSubgraph } from '@lvn-backend/notes'
import { UsersModule, usersConfigFrom, usersSubgraph } from '@lvn-backend/users'

export { TOKEN_AUDIENCE } from '@lvn-backend/auth-guard'

/**
 * The five bounded contexts this process composes (spec §6), each given its own slice of the configuration.
 * Extracting a context (§6.5 step 4) removes it from this list and from apps/worker, and adds apps/<name>-service.
 */
export function contextModules(config: ApiConfig): DynamicModule[] {
  return [
    UsersModule.forRoot(usersConfigFrom(config)),
    NotesModule.forRoot(notesConfigFrom(config)),
    CoreModule.forRoot(coreConfigFrom(config)),
    AiModule.forRoot(aiConfigFrom(config)),
    // The API holds the live-update sockets (ADR-0042); the worker only publishes to them.
    CommunicationModule.forRoot(communicationConfigFrom(config), { serveLive: true }),
  ]
}

/**
 * Contexts that serve GraphQL today, each as its own federation subgraph. A context joins when it ships its first
 * resolver (spec §18: later-phase code is not written early).
 */
export const SUBGRAPHS: SubgraphDefinition[] = [usersSubgraph, notesSubgraph, coreSubgraph, communicationSubgraph, aiSubgraph]
