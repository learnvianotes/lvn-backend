import { Module, type DynamicModule } from '@nestjs/common'
import { JsonScalar } from '@lvn-backend/graphql'
import { AttachmentsService } from './application/attachments.service'
import { DraftsService } from './application/drafts.service'
import { NoteModerationService } from './application/moderation.service'
import { FilesService } from './application/files.service'
import { NotesService } from './application/notes.service'
import { NoteImportService } from './application/note-import.service'
import { NotesExport } from './application/notes-export'
import { NotesMaintenance } from './application/notes-maintenance'
import { OrganiseService } from './application/organise.service'
import { PdfConversionService } from './application/pdf-conversion.service'
import { MediaProcessingService } from './application/media-processing.service'
import { PdfReaderService } from './application/pdf-reader.service'
import { PublicPages } from './application/public-pages'
import { SearchIndex, TYPESENSE } from './application/search-index'
import { PostgresSearchProvider, TypesenseSearchProvider } from './application/search-providers'
import { SEMANTIC_SEARCH } from './application/search-ranking'
import { NoteChunks, NoteRetrievalFacade, PgvectorSemanticSearch } from './application/note-chunks'
import { SearchService } from './application/search.service'
import { Typesense } from './infrastructure/typesense'
import { SyncService } from './application/sync.service'
import { SharingService } from './application/sharing.service'
import { FilesResolver } from './graphql/files.resolver'
import { ImportResolver } from './graphql/import.resolver'
import { CardResolver } from './graphql/media.resolver'
import { NotesResolver, NoteVersionResolver } from './graphql/notes.resolver'
import { UserNotesResolver } from './graphql/user-notes.resolver'
import { ClassroomNotesResolver, NoteClassroomsResolver } from './graphql/classroom-notes.resolver'
import { GroupNotesResolver, NoteGroupsResolver } from './graphql/group-notes.resolver'
import { ClassroomSharesService } from './application/classroom-shares.service'
import { NoteAccessFacade } from './application/note-access.facade'
import { TopicsFacade } from './application/topics.facade'
import { NoteAiFacade } from './application/note-ai.facade'
import { ContributorsService } from './application/contributors.service'
import { FollowingFeedService } from './application/following-feed.service'
import { FeedsResolver } from './graphql/feeds.resolver'
import { NoteSavesService } from './application/note-saves.service'
import { NoteSavesResolver } from './graphql/saves.resolver'
import { NoteContributorsResolver } from './graphql/contributors.resolver'
import { GroupSharesService } from './application/group-shares.service'
import { OrganiseResolver, SubjectResolver, TopicResolver } from './graphql/organise.resolver'
import { ReaderResolver } from './graphql/reader.resolver'
import { ConversionResolver, NoteConversionResolver } from './graphql/convert.resolver'
import { SearchResolver } from './graphql/search.resolver'
import { SharingResolver } from './graphql/sharing.resolver'
import { SyncResolver } from './graphql/sync.resolver'
import { NOTES_CONFIG, type NotesConfig } from './notes.config'

/**
 * The `notes` bounded context (spec §6.1) — Postgres schema `notes`.
 * Owns: subjects, topics, folders, tags, notes, cards, versions, shares, forks, FileObject, search indexing, SearchProvider (Postgres → Typesense).
 * Imported only by the composition roots (apps/api, apps/worker); other contexts reach it through its
 * facade (FILES in libs/facades), never by importing this package (enforced by dependency-cruiser).
 * Needs PrismaModule, RedisModule, QueueModule, StorageModule, EventBusModule and the POLICY, ENTITLEMENTS, PEOPLE, AUDIT and MODERATION
 * facades; provides NOTE_MODERATION (bound by the composition roots).
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
        NoteModerationService,
        NotesService,
        DraftsService,
        OrganiseService,
        SharingService,
        NotesMaintenance,
        NotesExport,
        NoteImportService,
        ImportResolver,
        PublicPages,
        {
          provide: TYPESENSE,
          useFactory: (c: NotesConfig) => (c.search.typesense ? new Typesense(c.search.typesense.url, c.search.typesense.apiKey) : null),
          inject: [NOTES_CONFIG],
        },
        SearchIndex,
        // Ask AI's chunks and their embeddings (ADR-0060), which hybrid ranking's semantic side reads (ADR-0057).
        NoteChunks,
        NoteRetrievalFacade,
        PgvectorSemanticSearch,
        { provide: SEMANTIC_SEARCH, useExisting: PgvectorSemanticSearch },
        PostgresSearchProvider,
        TypesenseSearchProvider,
        SearchService,
        SearchResolver,
        SyncService,
        SyncResolver,
        FilesResolver,
        CardResolver,
        NotesResolver,
        UserNotesResolver,
        GroupSharesService,
        GroupNotesResolver,
        NoteGroupsResolver,
        ClassroomSharesService,
        NoteAccessFacade,
        TopicsFacade,
        NoteAiFacade,
        ContributorsService,
        FollowingFeedService,
        FeedsResolver,
        NoteSavesService,
        NoteSavesResolver,
        NoteContributorsResolver,
        ClassroomNotesResolver,
        NoteClassroomsResolver,
        NoteVersionResolver,
        OrganiseResolver,
        SubjectResolver,
        TopicResolver,
        SharingResolver,
        PdfReaderService,
        ReaderResolver,
        PdfConversionService,
        MediaProcessingService,
        ConversionResolver,
        NoteConversionResolver,
      ],
      exports: [FilesService, NotesMaintenance, NoteModerationService, NoteAccessFacade, TopicsFacade, NoteAiFacade, NoteChunks, NoteRetrievalFacade, SearchIndex, NoteImportService, PdfConversionService, MediaProcessingService],
    }
  }
}
