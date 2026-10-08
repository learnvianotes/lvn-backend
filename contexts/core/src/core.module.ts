import { Module, type DynamicModule } from '@nestjs/common'
import { CoreProgressService } from './application/core-progress.service'
import { CORE_CONFIG, type CoreConfig } from './core.config'
import { CoreProgressResolver } from './graphql/core-progress.resolver'

/**
 * The `core` bounded context (spec §6.1) — Postgres schema `core`.
 * Owns: groups, classrooms, quizzes, flashcards, exams, learning events, Rhythm (ADR-0030), recommendations,
 * resources, achievements, moderation, reports — and, from Phase 1, progress on the /core content (ADR-0023).
 * Imported only by the composition roots; never global (GraphQL subgraphs follow module imports).
 */
@Module({})
export class CoreModule {
  static forRoot(config: CoreConfig): DynamicModule {
    return {
      module: CoreModule,
      providers: [{ provide: CORE_CONFIG, useValue: config }, CoreProgressService, CoreProgressResolver],
      exports: [CoreProgressService],
    }
  }
}
