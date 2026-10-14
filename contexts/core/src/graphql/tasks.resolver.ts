import { UseGuards } from '@nestjs/common'
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { withUserErrors, type UserError } from '@lvn-backend/errors'
import { ClassInsightsService } from '../application/class-insights.service'
import { WeeklyTasksService, type TaskView } from '../application/weekly-tasks.service'
import { TASK_LIMITS, type WeeklyTaskKindName } from '../domain/tasks'

type TaskPayload = { task: TaskView | null; userErrors: UserError[] }
type Ok = { ok: boolean; userErrors: UserError[] }

/** Weekly tasks and the class goal (ADR-0081). */
@Resolver()
@UseGuards(SignedInGuard)
export class TasksResolver {
  constructor(
    private readonly tasks: WeeklyTasksService,
    private readonly insights: ClassInsightsService,
  ) {}

  @Query('weeklyTasks')
  async weeklyTasks(@CurrentViewer() viewer: Viewer) {
    return { ...(await this.tasks.list(viewer.userId)), max: TASK_LIMITS.perWeek }
  }

  @Query('taskSuggestions')
  taskSuggestions(@CurrentViewer() viewer: Viewer) {
    return this.tasks.suggestions(viewer.userId)
  }

  private async one(userId: string, id: string) {
    return (await this.tasks.list(userId)).tasks.find((t) => t.id === id) ?? null
  }

  @Mutation('addWeeklyTask')
  addWeeklyTask(@Args('input') input: { kind: WeeklyTaskKindName; target: number; topicId?: string | null; plan?: string | null }, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<TaskPayload>(async () => ({ task: await this.one(viewer.userId, await this.tasks.add(viewer.userId, input)) }), { task: null })
  }

  @Mutation('updateWeeklyTask')
  updateWeeklyTask(@Args('input') input: { id: string; target?: number | null; plan?: string | null }, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<TaskPayload>(async () => (await this.tasks.update(viewer.userId, input), { task: await this.one(viewer.userId, input.id) }), { task: null })
  }

  @Mutation('removeWeeklyTask')
  removeWeeklyTask(@Args('input') input: { id: string }, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<Ok>(async () => (await this.tasks.remove(viewer.userId, input.id), { ok: true }), { ok: false })
  }

  @Mutation('setClassGoal')
  setClassGoal(@Args('input') input: { classroomId: string; on: boolean; target?: number | null }, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<Ok>(async () => (await this.insights.setGoal(viewer.userId, input.classroomId, input.on, input.target ?? null), { ok: true }), { ok: false })
  }
}
