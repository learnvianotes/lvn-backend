import { GlobalRole, type Actor } from '@lvn/contracts/domain'
import { answerIsCorrect, maySetQuizPublic, quizReadable, quizReadableByLink, quizStats, quizVisibilityChoices } from '../../src/domain/shared-quiz'

const person = (extra: Partial<Actor> = {}): Actor => ({ id: 'owner', globalRole: GlobalRole.STUDENT, institutionVerified: false, ...extra })

describe('shared quizzes', () => {
  it('keeps a private link to the owner and opens Unlisted and Public by id', () => {
    const quiz = { ownerId: 'owner', visibility: 'PRIVATE' as const, deletedAt: null }
    expect(quizReadable(quiz, 'other')).toBe(false)
    expect(quizReadableByLink(quiz, 'other')).toBe(false)
    expect(quizReadableByLink(quiz, 'owner')).toBe(true)
    expect(quizReadable({ ...quiz, visibility: 'UNLISTED' }, null)).toBe(true)
    expect(quizReadable({ ...quiz, visibility: 'PUBLIC' }, 'other')).toBe(true)
    expect(quizReadable({ ...quiz, deletedAt: new Date() }, 'owner')).toBe(false)
  })

  it('uses the same public gate as notes', () => {
    expect(maySetQuizPublic(person(), true)).toBe(false)
    expect(maySetQuizPublic(person(), false)).toBe(true)
    expect(maySetQuizPublic(person({ mayPublishPublic: true }), true)).toBe(true)
    expect(maySetQuizPublic(person({ restrictedMinor: true, mayPublishPublic: true }), false)).toBe(false)
    expect(quizVisibilityChoices(person(), true).find((choice) => choice.visibility === 'PUBLIC')!.enabled).toBe(false)
    expect(quizVisibilityChoices(person(), true).find((choice) => choice.visibility === 'UNLISTED')!.enabled).toBe(true)
  })

  it('scores the first attempt of each person and hides who they are', () => {
    const stats = quizStats(
      ['q1', 'q2'],
      [
        { userId: 'a', score: 1, total: 2, submittedAt: new Date('2026-01-01T00:00:00Z'), answers: [{ questionId: 'q1', correct: true }, { questionId: 'q2', correct: false }] },
        { userId: 'a', score: 2, total: 2, submittedAt: new Date('2026-01-02T00:00:00Z'), answers: [{ questionId: 'q1', correct: true }, { questionId: 'q2', correct: true }] },
        { userId: 'b', score: 2, total: 2, submittedAt: new Date('2026-01-03T00:00:00Z'), answers: [{ questionId: 'q1', correct: true }, { questionId: 'q2', correct: true }] },
      ],
    )
    expect(stats).toEqual({
      takerCount: 2,
      scoredAttempts: 2,
      practiceAttempts: 1,
      averageScore: 0.75,
      questions: [
        { questionId: 'q1', correctCount: 2 },
        { questionId: 'q2', correctCount: 1 },
      ],
    })
    expect(JSON.stringify(stats)).not.toContain('userId')
    expect(answerIsCorrect(['c', 'a'], ['a', 'c'])).toBe(true)
    expect(answerIsCorrect([], ['a'])).toBe(false)
  })
})
