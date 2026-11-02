import type { Actor } from '@lvn/contracts/domain'

export type QuizVisibility = 'PRIVATE' | 'UNLISTED' | 'PUBLIC'

export interface QuizVisibilityChoice {
  visibility: QuizVisibility
  enabled: boolean
  reason: string | null
}

export interface ScoredAttempt {
  userId: string
  score: number
  total: number
  submittedAt: Date
  answers: { questionId: string; correct: boolean }[]
}

export interface QuizStats {
  takerCount: number
  scoredAttempts: number
  practiceAttempts: number
  averageScore: number | null
  questions: { questionId: string; correctCount: number }[]
}

/** Public follows the same admin switch as notes. A gate that already set mayPublishPublic wins. */
export function maySetQuizPublic(actor: Actor, requireVerification: boolean): boolean {
  if (actor.restrictedMinor || actor.suspended) return false
  if (actor.globalRole === 'PLATFORM_ADMIN') return true
  if (actor.mayPublishPublic !== undefined) return actor.mayPublishPublic
  return actor.institutionVerified || !requireVerification
}

export function quizVisibilityChoices(actor: Actor, requireVerification: boolean): QuizVisibilityChoice[] {
  const publicOk = maySetQuizPublic(actor, requireVerification)
  return (['PRIVATE', 'UNLISTED', 'PUBLIC'] as const).map((visibility) => {
    if (visibility === 'PUBLIC' && !publicOk) {
      return { visibility, enabled: false, reason: actor.restrictedMinor ? 'Your account cannot make quizzes public.' : actor.suspended ? 'Your account is suspended.' : 'Your account cannot make quizzes public.' }
    }
    if (visibility !== 'PRIVATE' && actor.suspended) return { visibility, enabled: false, reason: 'Your account is suspended.' }
    return { visibility, enabled: true, reason: null }
  })
}

/** By id: the owner, or anyone when it is Public or Unlisted and not in the trash. */
export function quizReadable(quiz: { ownerId: string; visibility: QuizVisibility; deletedAt: Date | null }, viewerId: string | null): boolean {
  if (quiz.deletedAt) return false
  if (viewerId !== null && viewerId === quiz.ownerId) return true
  return quiz.visibility === 'PUBLIC' || quiz.visibility === 'UNLISTED'
}

/** By the share token. A private token opens the quiz only for its owner. */
export function quizReadableByLink(quiz: { ownerId: string; visibility: QuizVisibility; deletedAt: Date | null }, viewerId: string | null): boolean {
  if (quiz.deletedAt) return false
  if (viewerId !== null && viewerId === quiz.ownerId) return true
  return quiz.visibility !== 'PRIVATE'
}

export function answerIsCorrect(chosen: string[], correct: string[]): boolean {
  return chosen.length > 0 && chosen.length === correct.length && chosen.every((id) => correct.includes(id))
}

/**
 * Aggregates for the owner. The first attempt of each person is the score; later ones are practice.
 * Nothing here names a person.
 */
export function quizStats(questionIds: string[], attempts: ScoredAttempt[]): QuizStats {
  const byUser = new Map<string, ScoredAttempt>()
  let practice = 0
  for (const attempt of [...attempts].sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime())) {
    if (byUser.has(attempt.userId)) practice += 1
    else byUser.set(attempt.userId, attempt)
  }
  const firsts = [...byUser.values()]
  const correct = new Map(questionIds.map((id) => [id, 0]))
  for (const attempt of firsts) {
    for (const answer of attempt.answers) {
      if (answer.correct && correct.has(answer.questionId)) correct.set(answer.questionId, (correct.get(answer.questionId) ?? 0) + 1)
    }
  }
  const average = firsts.length ? firsts.reduce((sum, attempt) => sum + (attempt.total ? attempt.score / attempt.total : 0), 0) / firsts.length : null
  return {
    takerCount: firsts.length,
    scoredAttempts: firsts.length,
    practiceAttempts: practice,
    averageScore: average,
    questions: questionIds.map((questionId) => ({ questionId, correctCount: correct.get(questionId) ?? 0 })),
  }
}
