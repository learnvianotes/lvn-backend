import { accuracyOf, daysLeft, masteryOf, planSessions, readinessOf, targetOn } from '../../src/domain/exams'

/** Exams' rules (ADR-0070): the plan, mastery, Readiness and its target line. */
describe('the revision plan', () => {
  it('spreads one session per topic evenly back from the exam, the last on the day before it', () => {
    const plan = planSessions({ today: '2026-10-13', examDate: '2026-10-23', topics: [{ key: 'a', weak: false }, { key: 'b', weak: false }] })
    // Ten days (13–22 Oct), two sessions: on the 5th and the 10th day.
    expect(plan).toEqual([
      { day: '2026-10-17', topicKeys: ['a'] },
      { day: '2026-10-22', topicKeys: ['b'] },
    ])
  })

  it('puts weak topics first and gives them a second session after every topic has had one', () => {
    const plan = planSessions({ today: '2026-10-13', examDate: '2026-10-19', topics: [{ key: 'a', weak: false }, { key: 'w', weak: true }] })
    expect(plan.map((s) => s.topicKeys[0])).toEqual(['w', 'a', 'w'])
    expect(plan.map((s) => s.day)).toEqual(['2026-10-14', '2026-10-16', '2026-10-18'])
    expect(new Set(plan.map((s) => s.day)).size).toBe(plan.length) // one session a day
  })

  it('folds several topics into a session when the days run short', () => {
    const plan = planSessions({ today: '2026-10-13', examDate: '2026-10-15', topics: ['a', 'b', 'c', 'd', 'e'].map((key) => ({ key, weak: false })) })
    expect(plan).toEqual([
      { day: '2026-10-13', topicKeys: ['a', 'b'] },
      { day: '2026-10-14', topicKeys: ['c', 'd', 'e'] },
    ])
  })

  it('plans nothing on or after the exam day', () => {
    expect(planSessions({ today: '2026-10-13', examDate: '2026-10-13', topics: [{ key: 'a', weak: false }] })).toEqual([])
    expect(planSessions({ today: '2026-10-13', examDate: '2026-10-20', topics: [] })).toEqual([])
  })
})

describe('Readiness', () => {
  it('takes accuracy over the last three results', () => {
    expect(accuracyOf([{ answered: 1, correct: 0 }, { answered: 4, correct: 4 }, { answered: 5, correct: 1 }, { answered: 10, correct: 10 }])).toBeCloseTo(0.5)
    expect(accuracyOf([])).toBeNull()
  })

  it('weighs recall 0.6 and accuracy 0.4; one alone counts whole; neither counts 0', () => {
    expect(masteryOf(0.9, 0.5)).toBeCloseTo(0.74)
    expect(masteryOf(0.9, null)).toBe(0.9)
    expect(masteryOf(null, 0.5)).toBe(0.5)
    expect(masteryOf(null, null)).toBe(0)
    expect(readinessOf([0.74, 0.9, 0])).toBe(55)
    expect(readinessOf([])).toBe(0)
  })

  it('draws the target line from 0 on the day the exam was added to 80 % on its day', () => {
    expect(targetOn({ added: '2026-10-01', examDate: '2026-10-21', today: '2026-10-01' })).toBe(0)
    expect(targetOn({ added: '2026-10-01', examDate: '2026-10-21', today: '2026-10-11' })).toBe(40)
    expect(targetOn({ added: '2026-10-01', examDate: '2026-10-21', today: '2026-10-21' })).toBe(80)
    expect(targetOn({ added: '2026-10-21', examDate: '2026-10-21', today: '2026-10-21' })).toBe(80)
    expect(daysLeft('2026-10-13', '2026-10-21')).toBe(8)
    expect(daysLeft('2026-10-22', '2026-10-21')).toBe(0)
  })
})
