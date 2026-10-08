import { Module, type DynamicModule } from '@nestjs/common'
import { CoreProgressService } from './application/core-progress.service'
import { ModerationService } from './application/moderation.service'
import { CORE_CONFIG, type CoreConfig } from './core.config'
import { CoreProgressResolver } from './graphql/core-progress.resolver'
import { ModeratedNoteResolver, ModerationReportResolver, ModerationResolver } from './graphql/moderation.resolver'

/**
 * The `core` bounded context (spec §6.1) — Postgres schema `core`.
 * Owns: groups, classrooms, quizzes, flashcards, exams, learning events, Rhythm (ADR-0030), recommendations,
 * resources, achievements, moderation, reports — and, from Phase 1, progress on the /core content (ADR-0023).
 * Implements the MODERATION facade (ADR-0037) and needs POLICY, AUDIT and NOTE_MODERATION.
 * Imported only by the composition roots; never global (GraphQL subgraphs follow module imports).
 */
@Module({})
export class CoreModule {
  static forRoot(config: CoreConfig): DynamicModule {
    return {
      module: CoreModule,
      providers: [{ provide: CORE_CONFIG, useValue: config }, CoreProgressService, CoreProgressResolver, ModerationService, ModerationResolver, ModerationReportResolver, ModeratedNoteResolver],
      exports: [CoreProgressService, ModerationService],
    }
  }
}
