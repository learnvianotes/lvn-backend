// Public surface of the `core` context. Nothing else is exported (spec §3).
import { coreTypeDefs } from './graphql/schema'
import { CoreModule } from './core.module'

export { CoreModule }
export { coreConfigFrom, type CoreConfig } from './core.config'
/** Implementation of the MODERATION facade (ADR-0037), bound by the composition roots. */
export { ModerationService } from './application/moderation.service'
/** Queue and place totals for the admin dashboard (ADR-0101). */
export { CoreAdminStats } from './application/admin-stats'
/** Implementation of the PLACES facade (ADR-0050), bound by the composition roots. */
export { ClassroomsService } from './application/classrooms.service'
/** Implementation of the PLACES facade (ADR-0050, ADR-0056), bound by the composition roots. */
export { PlacesService } from './application/places.service'
/** Project workspaces (ADR-0048): apps/worker refreshes repository details each night. */
export { WorkspacesService, parseRepository } from './application/workspaces.service'
/** The core part of a data export (ADR-0018), bound to CORE_DATA_EXPORT by the composition roots. */
export { CoreExport } from './application/core-export'
/** Learning events (ADR-0067): the LEARNING facade, and the worker's nightly partition care. */
export { LEARNING_ANALYTICS_QUEUE, LearningEventsService } from './application/learning-events.service'
export { LearningHistoryService } from './application/learning-history.service'
/** Flashcard reviews (ADR-0068): Rhythm and Exam Readiness read their state. */
export { ReviewsService } from './application/reviews.service'
/** Rhythm (ADR-0069): the worker closes last week hourly, in each person's zone. */
export { RhythmService } from './application/rhythm.service'
/** Exams (ADR-0070): the worker sends the evening reminders of revision tasks left. */
export { ExamsService } from './application/exams.service'
/** Recommendations (ADR-0071): the worker recomputes them hourly for active people. */
export { RecommendationsService } from './application/recommendations.service'
/** Focus sessions (ADR-0072): the worker ends the ones left open. */
export { FocusService } from './application/focus.service'

/** This context's federation subgraph, composed by apps/api's gateway (ADR-0033). */
export const coreSubgraph = { name: 'core', typeDefs: coreTypeDefs, modules: [CoreModule] }
export { COMMERCE_WORDS } from './domain/resources'
export { ResourcesService } from './application/resources.service'
export { ResourceSearchFacade } from './application/resource-search.facade'
/** Repository activity from a GitHub App (ADR-0078): the service, its worker queue and the API's webhook. */
export { CORE_GITHUB_QUEUE, GitHubAppService } from './application/github-app.service'
export { CORE_ENGAGEMENT_QUEUE, PointsService } from './application/points.service'
export { DailyLineService } from './application/daily-line.service'
export { AchievementsService } from './application/achievements.service'
export { WeeklyTasksService } from './application/weekly-tasks.service'
export { ContestsService } from './application/contests.service'
export { GitHubWebhookController } from './http/github-webhook.controller'
