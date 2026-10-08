import { UseGuards } from '@nestjs/common'
import { Args, Context, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type RequestContext, type Viewer } from '@lvn-backend/auth-guard'
import { withUserErrors, type UserError } from '@lvn-backend/errors'
import { byKeys, requestLoader } from '@lvn-backend/graphql'
import { OrganiseService } from '../application/organise.service'
import type {
  MutationCreateFolderArgs,
  MutationDeleteFolderArgs,
  MutationDeleteTagArgs,
  MutationProposeTopicArgs,
  MutationRenameTagArgs,
  MutationUpdateFolderArgs,
  OkPayload,
  QueryFindTopicsArgs,
  QuerySubjectArgs,
} from './schema.types'

type TopicRow = { id: string; subjectId: string; parentId: string | null }

/** Folders and tags (the viewer's own), subjects and topics (everyone's). */
@Resolver()
export class OrganiseResolver {
  constructor(private readonly organise: OrganiseService) {}

  @Query('myFolders')
  @UseGuards(SignedInGuard)
  myFolders(@CurrentViewer() viewer: Viewer) {
    return this.organise.folders(viewer.userId)
  }

  @Query('myTags')
  @UseGuards(SignedInGuard)
  myTags(@CurrentViewer() viewer: Viewer) {
    return this.organise.tags(viewer.userId)
  }

  @Query('subjects')
  subjects() {
    return this.organise.subjects()
  }

  @Query('subject')
  subject(@Args() { slug }: QuerySubjectArgs) {
    return this.organise.subject(slug)
  }

  @Query('findTopics')
  findTopics(@Args() { query, subjectId }: QueryFindTopicsArgs, @CurrentViewer() viewer: Viewer | null) {
    return this.organise.findTopics(query, subjectId, viewer?.userId ?? null)
  }

  @Mutation('createFolder')
  @UseGuards(SignedInGuard)
  createFolder(@Args() { input }: MutationCreateFolderArgs, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<{ folder: unknown; userErrors: UserError[] }>(async () => ({ folder: await this.organise.createFolder(viewer.userId, input) }), { folder: null })
  }

  @Mutation('updateFolder')
  @UseGuards(SignedInGuard)
  updateFolder(@Args() { input }: MutationUpdateFolderArgs, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<{ folder: unknown; userErrors: UserError[] }>(async () => ({ folder: await this.organise.updateFolder(viewer.userId, input) }), { folder: null })
  }

  @Mutation('deleteFolder')
  @UseGuards(SignedInGuard)
  deleteFolder(@Args() { input }: MutationDeleteFolderArgs, @CurrentViewer() viewer: Viewer): Promise<OkPayload> {
    return withUserErrors<OkPayload>(async () => {
      await this.organise.deleteFolder(viewer.userId, input.id)
      return { ok: true }
    }, { ok: false })
  }

  @Mutation('renameTag')
  @UseGuards(SignedInGuard)
  renameTag(@Args() { input }: MutationRenameTagArgs, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<{ tag: unknown; userErrors: UserError[] }>(async () => ({ tag: await this.organise.renameTag(viewer.userId, input.id, input.name) }), { tag: null })
  }

  @Mutation('deleteTag')
  @UseGuards(SignedInGuard)
  deleteTag(@Args() { input }: MutationDeleteTagArgs, @CurrentViewer() viewer: Viewer): Promise<OkPayload> {
    return withUserErrors<OkPayload>(async () => {
      await this.organise.deleteTag(viewer.userId, input.id)
      return { ok: true }
    }, { ok: false })
  }

  @Mutation('proposeTopic')
  @UseGuards(SignedInGuard)
  proposeTopic(@Args() { input }: MutationProposeTopicArgs, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<{ topic: unknown; userErrors: UserError[] }>(async () => ({ topic: await this.organise.proposeTopic(viewer.userId, input) }), { topic: null })
  }
}

@Resolver('Subject')
export class SubjectResolver {
  constructor(private readonly organise: OrganiseService) {}

  @ResolveField('topics')
  topics(@Parent() s: { id: string }, @CurrentViewer() viewer: Viewer | null) {
    return this.organise.topicsOf(s.id, null, viewer?.userId ?? null)
  }
}

@Resolver('Topic')
export class TopicResolver {
  constructor(private readonly organise: OrganiseService) {}

  @ResolveField('subject')
  subject(@Parent() t: TopicRow, @Context() context: RequestContext) {
    return requestLoader<string, unknown>(context, 'notes.subject', async (ids) => byKeys(ids, await this.organise.subjectsByIds([...ids]), (s) => s.id)).load(t.subjectId)
  }

  @ResolveField('children')
  children(@Parent() t: TopicRow, @CurrentViewer() viewer: Viewer | null) {
    return this.organise.topicsOf(t.subjectId, t.id, viewer?.userId ?? null)
  }
}
