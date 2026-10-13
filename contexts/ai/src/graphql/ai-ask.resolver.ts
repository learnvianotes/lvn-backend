import { UseGuards } from '@nestjs/common'
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql'
import type { AskAiScope } from '@lvn/contracts/domain'
import { CurrentViewer, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { withUserErrors, type UserError } from '@lvn-backend/errors'
import type { Prisma } from '@lvn-backend/prisma-base'
import { AskService } from '../application/ask.service'

type AnswerRow = Prisma.AiAnswerGetPayload<object>
const toAnswer = (a: AnswerRow) => ({ ...a, sources: a.sources as unknown[] })
type Answer = ReturnType<typeof toAnswer>

@Resolver()
export class AskResolver {
  constructor(private readonly ask: AskService) {}

  @Query('aiAnswer')
  @UseGuards(SignedInGuard)
  async aiAnswer(@Args('id') id: string, @CurrentViewer() viewer: Viewer) {
    const answer = await this.ask.get(viewer.userId, id)
    return answer ? toAnswer(answer) : null
  }

  @Query('myAiAnswers')
  @UseGuards(SignedInGuard)
  async myAiAnswers(@Args('first') first: number | null, @Args('noteId') noteId: string | null, @Args('doubtId') doubtId: string | null, @CurrentViewer() viewer: Viewer) {
    return (await this.ask.list(viewer.userId, { first, noteId, doubtId })).map(toAnswer)
  }

  @Mutation('askAi')
  @UseGuards(SignedInGuard)
  askAi(@Args('input') input: { question: string; scope: AskAiScope; noteId?: string | null }, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<{ answer: Answer | null; userErrors: UserError[] }>(async () => ({ answer: toAnswer(await this.ask.ask(viewer.userId, input)) }), { answer: null })
  }

  @Mutation('askAiAboutDoubt')
  @UseGuards(SignedInGuard)
  askAiAboutDoubt(@Args('doubtId') doubtId: string, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<{ answer: Answer | null; userErrors: UserError[] }>(async () => ({ answer: toAnswer(await this.ask.askAboutDoubt(viewer.userId, doubtId)) }), { answer: null })
  }

  @Mutation('deleteAiAnswer')
  @UseGuards(SignedInGuard)
  deleteAiAnswer(@Args('id') id: string, @CurrentViewer() viewer: Viewer) {
    return withUserErrors<{ ok: boolean; userErrors: UserError[] }>(async () => (await this.ask.remove(viewer.userId, id), { ok: true }), { ok: false })
  }
}
