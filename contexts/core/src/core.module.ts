import { MentionsService } from './application/mentions.service'
import { Module, type DynamicModule } from '@nestjs/common'
import { JsonScalar } from '@lvn-backend/graphql'
import { CoreExport } from './application/core-export'
import { CoreProgressService } from './application/core-progress.service'
import { LearningEventsService } from './application/learning-events.service'
import { LearningResolver } from './graphql/learning.resolver'
import { LearningHistoryService } from './application/learning-history.service'
import { LearningHistoryResolver } from './graphql/learning-history.resolver'
import { ReviewsService } from './application/reviews.service'
import { NoteStudyResolver, ReviewsResolver } from './graphql/reviews.resolver'
import { RhythmService } from './application/rhythm.service'
import { RhythmResolver } from './graphql/rhythm.resolver'
import { ExamsService } from './application/exams.service'
import { ExamsResolver } from './graphql/exams.resolver'
import { RecommendationsService } from './application/recommendations.service'
import { RecommendationsResolver } from './graphql/recommendations.resolver'
import { FocusService } from './application/focus.service'
import { BuddiesService } from './application/buddies.service'
import { ClassInsightsService } from './application/class-insights.service'
import { ClassroomInsightsResolver, FocusResolver } from './graphql/focus.resolver'
import { ClassQuizzesService } from './application/class-quizzes.service'
import { ClassroomsService } from './application/classrooms.service'
import { PlacesService } from './application/places.service'
import { CommentsService } from './application/comments.service'
import { WorkspacesService } from './application/workspaces.service'
import { ActivityService } from './application/activity.service'
import { ScopedReportsService } from './application/scoped-reports.service'
import { ActivityResolver } from './graphql/activity.resolver'
import { CommunityFeedsService } from './application/community-feeds.service'
import { CommunityResolver } from './graphql/community.resolver'
import { GroupsService } from './application/groups.service'
import { ModerationService } from './application/moderation.service'
import { ResourcesService } from './application/resources.service'
import { ResourceCaseResolver, ResourceCatalogueResolver, ResourceRecommendationResolver, ResourceReferenceResolver, ResourcesResolver } from './graphql/resources.resolver'
import { ResourceCatalogueService } from './application/resource-catalogue.service'
import { ResourceSearchFacade } from './application/resource-search.facade'
import { CORE_CONFIG, type CoreConfig } from './core.config'
import { CoreProgressResolver } from './graphql/core-progress.resolver'
import { ClassroomReferenceResolver, ClassroomsResolver } from './graphql/classrooms.resolver'
import { ClassQuizzesResolver, ClassroomQuizzesResolver } from './graphql/quizzes.resolver'
import { DoubtResolver, GroupRepositoryResolver, WorkspaceGroupResolver } from './graphql/workspaces.resolver'
import { GitHubAppService } from './application/github-app.service'
import { ClassroomPostDiscussionResolver, CommentResolver, DiscussionResolver, GroupPostDiscussionResolver, NoteDiscussionResolver } from './graphql/comments.resolver'
import { GroupReferenceResolver, GroupsResolver } from './graphql/groups.resolver'
import { GroupModerationResolver, ModeratedContentResolver, ModeratedNoteResolver, ModerationReportResolver, ModerationResolver } from './graphql/moderation.resolver'

/**
 * The `core` bounded context (spec §6.1) — Postgres schema `core`.
 * Owns: groups, classrooms, quizzes, flashcards, exams, learning events, Rhythm (ADR-0030), recommendations,
 * resources, achievements, moderation, reports — and, from Phase 1, progress on the /core content (ADR-0023).
 * Implements the MODERATION and LEARNING facades (ADR-0037, ADR-0067) and needs POLICY, AUDIT, NOTE_MODERATION,
 * NOTE_ACCESS, TOPICS, PEOPLE and LIVE.
 * Imported only by the composition roots; never global (GraphQL subgraphs follow module imports).
 */
@Module({})
export class CoreModule {
  static forRoot(config: CoreConfig): DynamicModule {
    return {
      module: CoreModule,
      providers: [{ provide: CORE_CONFIG, useValue: config }, CoreProgressService, CoreProgressResolver, LearningEventsService, LearningResolver, LearningHistoryService, LearningHistoryResolver, ReviewsService, ReviewsResolver, NoteStudyResolver, RhythmService, RhythmResolver, ExamsService, ExamsResolver, RecommendationsService, RecommendationsResolver, FocusService, BuddiesService, ClassInsightsService, FocusResolver, ClassroomInsightsResolver, CoreExport, ModerationService, ModerationResolver, ModerationReportResolver, ModeratedNoteResolver, ModeratedContentResolver, GroupModerationResolver, ScopedReportsService, MentionsService, GroupsService, GroupsResolver, GroupReferenceResolver, ClassroomsService, PlacesService, ClassroomsResolver, ClassroomReferenceResolver, ClassQuizzesService, ClassQuizzesResolver, ClassroomQuizzesResolver, CommentsService, NoteDiscussionResolver, GroupPostDiscussionResolver, ClassroomPostDiscussionResolver, DiscussionResolver, CommentResolver, WorkspacesService, WorkspaceGroupResolver, GroupRepositoryResolver, GitHubAppService, DoubtResolver, ActivityService, ActivityResolver, CommunityFeedsService, CommunityResolver, ResourcesService, ResourcesResolver, ResourceCaseResolver, ResourceCatalogueService, ResourceCatalogueResolver, ResourceRecommendationResolver, ResourceSearchFacade, ResourceReferenceResolver, JsonScalar],
      exports: [CoreProgressService, ModerationService, GroupsService, ClassroomsService, PlacesService, WorkspacesService, GitHubAppService, LearningEventsService, LearningHistoryService, ReviewsService, RhythmService, ExamsService, RecommendationsService, FocusService, ResourcesService, ResourceSearchFacade],
    }
  }
}
