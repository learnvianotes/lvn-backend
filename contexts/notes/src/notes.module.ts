import { Module, type DynamicModule } from '@nestjs/common'
import { JsonScalar } from '@lvn-backend/graphql'
import { AttachmentsService } from './application/attachments.service'
import { DraftsService } from './application/drafts.service'
import { FilesService } from './application/files.service'
import { NotesService } from './application/notes.service'
import { NotesMaintenance } from './application/notes-maintenance'
import { OrganiseService } from './application/organise.service'
import { SharingService } from './application/sharing.service'
import { FilesResolver } from './graphql/files.resolver'
import { CardResolver } from './graphql/media.resolver'
import { NotesResolver, NoteVersionResolver } from './graphql/notes.resolver'
import { OrganiseResolver, SubjectResolver, TopicResolver } from './graphql/organise.resolver'
import { SharingResolver } from './graphql/sharing.resolver'
import { NOTES_CONFIG, type NotesConfig } from './notes.config'

/**
 * The `notes` bounded context (spec §6.1) — Postgres schema `notes`.
 * Owns: subjects, topics, folders, tags, notes, cards, versions, shares, forks, FileObject, search indexing, SearchProvider (Postgres → Typesense).
 * Imported only by the composition roots (apps/api, apps/worker); other contexts reach it through its
 * facade (FILES in libs/facades), never by importing this package (enforced by dependency-cruiser).
 * Needs PrismaModule, RedisModule, StorageModule, EventBusModule and the POLICY, ENTITLEMENTS, PEOPLE and AUDIT facades.
 * Never global: GraphQL subgraphs follow module imports, so a global context would leak its resolvers.
 */
@Module({})
export class NotesModule {
  static forRoot(config: NotesConfig): DynamicModule {
    return {
      module: NotesModule,
      providers: [
        { provide: NOTES_CONFIG, useValue: config },
        JsonScalar,
        FilesService,
        AttachmentsService,
        NotesService,
        DraftsService,
        OrganiseService,
        SharingService,
        NotesMaintenance,
        FilesResolver,
        CardResolver,
        NotesResolver,
        NoteVersionResolver,
        OrganiseResolver,
        SubjectResolver,
        TopicResolver,
        SharingResolver,
      ],
      exports: [FilesService, NotesMaintenance],
    }
  }
}
