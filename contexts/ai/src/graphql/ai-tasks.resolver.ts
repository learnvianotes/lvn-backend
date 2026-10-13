import { UseGuards } from '@nestjs/common'
import { Args, Mutation, Parent, Query, ResolveField, ResolveReference, Resolver } from '@nestjs/graphql'
import type { AiTaskType } from '@lvn/contracts/domain'
import { CurrentViewer, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { withUserErrors, type UserError } from '@lvn-backend/errors'
import type { Prisma } from '@lvn-backend/prisma-base'
import { AiTasksService } from '../application/ai-tasks.service'
import type { AiLanguage } from '../domain/tasks'

type ArtifactRow = Prisma.NoteArtifactGetPayload<object>
type Options = { language?: AiLanguage; cut?: boolean }

/** An artifact as GraphQL shows it: its payload spread into `markdown` or `title` and `cards`. */
const toArtifact = (a: ArtifactRow) => {
  const payload = (a.status === 'READY' ? a.payload : null) as { markdown?: string; title?: string; cards?: unknown[]; changes?: { cardId: string; before: string; after: string }[]; applied?: string[] } | null
  const options = a.options as Options
  return {
    id: a.id,
    task: a.task,
    status: a.status,
    language: options.language ?? 'ENGLISH',
    markdown: payload?.markdown ?? null,
    title: payload?.title ?? null,
    cards: payload?.cards ?? null,
    changes: payload?.changes?.map((c) => ({ ...c, applied: !!payload.applied?.includes(c.cardId) })) ?? null,
    error: a.error,
    fromPublishedVersion: a.versionId !== null,
    truncated: !!options.cut,
    keptAt: a.keptAt,
    createdAt: a.createdAt,
    note: { __typename: 'Note', id: a.noteId },
  }
}

@Resolver()
export class AiTasksResolver {
  constructor(private readonly tasks: AiTasksService) {}

  @Query('aiArtifact')
  @UseGuards(SignedInGuard)
  async aiArtifact(@Args('id') id: string, @CurrentViewer() viewer: Viewer) {
    const artifact = await this.tasks.get(viewer.userId, id)
    return artifact ? toArtifact(artifact) : null
  }

  @Mutation('runAiTask')
  @UseGuards(SignedInGuard)
  runAiTask(@Args('input') input: { noteId: string; task: AiTaskType; language?: AiLanguage | null; cardIds?: string[] | null }, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<{ artifact: ReturnType<typeof toArtifact> | null; userErrors: UserError[] }>(async () => ({ artifact: toArtifact(await this.tasks.run(viewer.userId, input)) }), { artifact: null })
  }

  @Mutation('keepAiCards')
  @UseGuards(SignedInGuard)
  keepAiCards(@Args('input') input: { artifactId: string; cardIndexes: number[]; into: 'NOTE' | 'NEW_NOTE' }, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<{ noteId: string | null; userErrors: UserError[] }>(async () => ({ noteId: await this.tasks.keep(viewer.userId, input) }), { noteId: null })
  }

  @Mutation('applyAiChanges')
  @UseGuards(SignedInGuard)
  applyAiChanges(@Args('input') input: { artifactId: string; cardIds: string[] }, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<{ applied: string[]; userErrors: UserError[] }>(async () => ({ applied: await this.tasks.apply(viewer.userId, input) }), { applied: [] })
  }

  @Mutation('deleteAiArtifact')
  @UseGuards(SignedInGuard)
  deleteAiArtifact(@Args('id') id: string, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<{ ok: boolean; userErrors: UserError[] }>(async () => (await this.tasks.remove(viewer.userId, id), { ok: true }), { ok: false })
  }
}

/** ai's part of the notes subgraph's Note: the viewer's AI results (ADR-0059). */
@Resolver('Note')
export class NoteAiArtifactsResolver {
  constructor(private readonly tasks: AiTasksService) {}

  // Apollo calls this with (reference, context, info); see UserReferenceResolver in users for why there are no decorators.
  @ResolveReference()
  resolveReference(reference: { id: string }) {
    return { id: reference.id }
  }

  @ResolveField('aiArtifacts')
  async aiArtifacts(@Parent() note: { id: string }, @CurrentViewer() viewer: Viewer | null) {
    return viewer ? (await this.tasks.list(viewer.userId, note.id)).map(toArtifact) : []
  }
}
