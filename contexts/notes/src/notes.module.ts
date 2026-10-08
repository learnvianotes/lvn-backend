import { Module, type DynamicModule } from '@nestjs/common'
import { FilesService } from './application/files.service'
import { FilesResolver } from './graphql/files.resolver'
import { NOTES_CONFIG, type NotesConfig } from './notes.config'

/**
 * The `notes` bounded context (spec §6.1) — Postgres schema `notes`.
 * Owns: subjects, topics, folders, tags, notes, cards, versions, shares, forks, FileObject, search indexing, SearchProvider (Postgres → Typesense).
 * Imported only by the composition roots (apps/api, apps/worker); other contexts reach it through its
 * facade (FILES in libs/facades), never by importing this package (enforced by dependency-cruiser).
 * Needs PrismaModule, RedisModule, StorageModule, EventBusModule and the POLICY and ENTITLEMENTS facades.
 * Never global: GraphQL subgraphs follow module imports, so a global context would leak its resolvers.
 */
@Module({})
export class NotesModule {
  static forRoot(config: NotesConfig): DynamicModule {
    return {
      module: NotesModule,
      providers: [{ provide: NOTES_CONFIG, useValue: config }, FilesService, FilesResolver],
      exports: [FilesService],
    }
  }
}
