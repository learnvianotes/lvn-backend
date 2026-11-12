import { ResolveField, Resolver } from '@nestjs/graphql'

/** Browser captions set `aiGenerated: false`. Every other parent is a model answer. */
type MaybeLabelled = { aiGenerated?: boolean }

/** Ask AI, task results, public study aids, transcripts and notes made from a transcript. */
@Resolver('AiAnswer')
export class AiAnswerLabelResolver {
  @ResolveField('aiGenerated')
  aiGenerated(parent: MaybeLabelled): boolean {
    return parent.aiGenerated !== false
  }
}

@Resolver('AiArtifact')
export class AiArtifactLabelResolver {
  @ResolveField('aiGenerated')
  aiGenerated(parent: MaybeLabelled): boolean {
    return parent.aiGenerated !== false
  }
}

@Resolver('AiInsight')
export class AiInsightLabelResolver {
  @ResolveField('aiGenerated')
  aiGenerated(parent: MaybeLabelled): boolean {
    return parent.aiGenerated !== false
  }
}

@Resolver('Transcript')
export class TranscriptLabelResolver {
  @ResolveField('aiGenerated')
  aiGenerated(parent: MaybeLabelled): boolean {
    return parent.aiGenerated !== false
  }
}

@Resolver('NotesFromTranscript')
export class NotesFromTranscriptLabelResolver {
  @ResolveField('aiGenerated')
  aiGenerated(parent: MaybeLabelled): boolean {
    return parent.aiGenerated !== false
  }
}
