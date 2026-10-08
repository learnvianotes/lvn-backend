// Generated from this folder's *.graphql by scripts/graphql-types.mjs (ADR-0033). Do not edit.

export interface CoreProblemMark {
  problemId: string
  mark: ProblemMark
}

/** Progress on a /core subject — the old site's history plus everything recorded since */
export interface CoreSubjectProgress {
  subjectId: string
  topics: Array<CoreTopicProgress>
  problems: Array<CoreProblemMark>
}

/** topicKey = subjectId/topicId of the /core content */
export interface CoreTopicProgress {
  topicKey: string
  completed: boolean
  revisit: boolean
  secondsStudied: number
  lastStudiedAt: Date | null
}

export type ProblemMark = 'SOLVED' | 'REVISIT'

export interface QueryCoreProgressArgs {
  subjectId: string
}
