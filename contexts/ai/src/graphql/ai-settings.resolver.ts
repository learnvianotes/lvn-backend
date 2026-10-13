import { UseGuards } from '@nestjs/common'
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { withUserErrors, type UserError } from '@lvn-backend/errors'
import { AiSettingsService, type ConnectionInput, type RouteInput } from '../application/ai-settings.service'

type Settings = Awaited<ReturnType<AiSettingsService['settings']>>

/** The AI providers page (ADR-0065): platform admins only, checked in AiSettingsService. */
@Resolver()
@UseGuards(SignedInGuard)
export class AiSettingsResolver {
  constructor(private readonly settings: AiSettingsService) {}

  @Query('aiSettings')
  aiSettings(@CurrentViewer() viewer: Viewer) {
    return this.settings.settings(viewer.userId)
  }

  @Mutation('saveAiConnection')
  saveAiConnection(@Args('input') input: ConnectionInput, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<{ connection: Awaited<ReturnType<AiSettingsService['saveConnection']>> | null; userErrors: UserError[] }>(async () => ({ connection: await this.settings.saveConnection(viewer.userId, input) }), { connection: null })
  }

  @Mutation('deleteAiConnection')
  deleteAiConnection(@Args('input') input: { id: string }, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<{ settings: Settings | null; userErrors: UserError[] }>(async () => ({ settings: await this.settings.deleteConnection(viewer.userId, input.id) }), { settings: null })
  }

  @Mutation('setAiDefaults')
  setAiDefaults(@Args('input') input: { chatConnectionId?: string | null; embedConnectionId?: string | null }, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<{ settings: Settings | null; userErrors: UserError[] }>(async () => ({ settings: await this.settings.setDefaults(viewer.userId, input) }), { settings: null })
  }

  @Mutation('testAiConnection')
  testAiConnection(@Args('input') input: { id: string }, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<{ test: Awaited<ReturnType<AiSettingsService['testConnection']>> | null; userErrors: UserError[] }>(async () => ({ test: await this.settings.testConnection(viewer.userId, input.id) }), { test: null })
  }

  @Mutation('saveAiTaskRoute')
  saveAiTaskRoute(@Args('input') input: RouteInput, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<{ settings: Settings | null; userErrors: UserError[] }>(async () => ({ settings: await this.settings.saveRoute(viewer.userId, input) }), { settings: null })
  }

  @Mutation('deleteAiTaskRoute')
  deleteAiTaskRoute(@Args('input') input: { task: string }, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<{ settings: Settings | null; userErrors: UserError[] }>(async () => ({ settings: await this.settings.deleteRoute(viewer.userId, input.task) }), { settings: null })
  }
}
