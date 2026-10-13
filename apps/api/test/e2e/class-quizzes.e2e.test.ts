import { randomUUID } from 'node:crypto'
import { CoreExport } from '@lvn-backend/core'
import { InProcessEventBus } from '@lvn-backend/event-bus'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { createTestApp, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'

/**
 * Classroom quizzes (ADR-0064): staff publish a quiz of quiz-card questions to their class and its members are told;
 * members take it, scored by the server, and see the answers once they have submitted; a resent submission is the
 * same attempt; staff see how many students submitted, and remove a quiz; attempts are the person's own data.
 */
describe('classroom quizzes', () => {
  let t: TestApp
  let db: PrismaService
  let bus: InProcessEventBus
  type Person = { id: string; token: string }
  let teacher: Person, ta: Person, student: Person, student2: Person, outsider: Person
  let classroomId = ''
  const ERRORS = 'userErrors { field message code }'
  const QUIZ = 'id classroomId title author { id } questionCount questions { id position question choices { id content } multiple correct explanation } myAttempts { id score total answers { questionId choiceIds correct } } submittedCount viewerCanDelete'
  type Question = { id: string; position: number; question: unknown; choices: { id: string }[]; multiple: boolean; correct: string[] | null; explanation: unknown }
  type Attempt = { id: string; score: number; total: number; answers: { questionId: string; choiceIds: string[]; correct: boolean }[] }
  type Quiz = { id: string; title: string; author: { id: string }; questionCount: number; questions: Question[]; myAttempts: Attempt[]; submittedCount: number | null; viewerCanDelete: boolean }
  const doc = (s: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s }] }] })
  const choice = (id: string, s: string) => ({ id, content: [{ type: 'text', text: s }] })
  const QUESTIONS = [
    { question: doc('What makes most of a cell’s ATP?'), choices: [choice('c1', 'Mitochondria'), choice('c2', 'Ribosomes'), choice('c3', 'Golgi body')], correct: ['c1'], multiple: false, explanation: doc('Respiration happens in the mitochondria.') },
    { question: doc('Where does glycolysis happen?'), choices: [choice('c1', 'Matrix'), choice('c2', 'Cytoplasm')], correct: ['c2'], multiple: false },
    // A page anchor from a converted note's quiz card is dropped.
    { question: doc('Which are products of respiration?'), choices: [choice('a', 'Water'), choice('b', 'Oxygen'), choice('c', 'Carbon dioxide')], correct: ['a', 'c'], multiple: true, anchor: { fileId: randomUUID(), page: 2 } },
  ]
  const person = async (name: string, teacherRole = false): Promise<Person> => {
    const u = await seedUser(t.app, { verified: true, displayName: name, globalRole: teacherRole ? 'TEACHER' : 'STUDENT' })
    return { id: u.id, token: tokenFor(t.config, u.id) }
  }
  const publish = async (who: Person, input: object) => {
    const res = await t.gql<{ publishClassQuiz: { quiz: { id: string } | null; userErrors: { field: string[]; message: string; code: string }[] } }>(`mutation ($input: PublishClassQuizInput!) { publishClassQuiz(input: $input) { quiz { id } ${ERRORS} } }`, { input: { classroomId, title: 'Respiration', questions: QUESTIONS, ...input } }, who.token)
    return { id: res.data?.publishClassQuiz.quiz?.id ?? null, problem: res.errors?.[0]?.extensions.code ?? res.data?.publishClassQuiz.userErrors[0]?.message ?? null }
  }
  const quiz = async (who: Person, id: string) => (await t.gql<{ classQuiz: Quiz | null }>(`query ($id: UUID!) { classQuiz(id: $id) { ${QUIZ} } }`, { id }, who.token)).data!.classQuiz
  const submit = async (who: Person, quizId: string, answers: { questionId: string; choiceIds: string[] }[], clientOpId: string = randomUUID()) => {
    const res = await t.gql<{ submitQuizAttempt: { attempt: Attempt | null; quiz: Quiz | null; userErrors: { message: string }[] } }>(`mutation ($input: SubmitQuizAttemptInput!) { submitQuizAttempt(input: $input) { attempt { id score total answers { questionId choiceIds correct } } quiz { ${QUIZ} } ${ERRORS} } }`, { input: { quizId, clientOpId, answers } }, who.token)
    return { attempt: res.data?.submitQuizAttempt.attempt ?? null, quiz: res.data?.submitQuizAttempt.quiz ?? null, problem: res.errors?.[0]?.extensions.code ?? res.data?.submitQuizAttempt.userErrors[0]?.message ?? null }
  }

  beforeAll(async () => {
    t = await createTestApp()
    db = t.app.get(PrismaService)
    bus = t.app.get(InProcessEventBus)
    teacher = await person('Ms Rao', true)
    ta = await person('Arjun')
    student = await person('Asha')
    student2 = await person('Ravi')
    outsider = await person('Outsider')
    const created = await t.gql<{ createClassroom: { classroom: { id: string } } }>(`mutation ($input: CreateClassroomInput!) { createClassroom(input: $input) { classroom { id } ${ERRORS} } }`, { input: { name: 'Biology 10A' } }, teacher.token)
    classroomId = created.data!.createClassroom.classroom.id
    await db.classroomMember.createMany({ data: [{ classroomId, userId: ta.id, role: 'TA' }, { classroomId, userId: student.id, role: 'STUDENT' }, { classroomId, userId: student2.id, role: 'STUDENT' }] })
  })
  afterAll(() => t.close())

  it('staff publish a quiz of quiz-card questions; its members are told and only they see it', async () => {
    expect((await publish(student, {})).problem).toBe('FORBIDDEN')
    expect((await publish(teacher, { title: '  ' })).problem).toBe('Give the quiz a title.')
    expect((await publish(teacher, { questions: [] })).problem).toBe('Add at least one question.')
    expect((await publish(teacher, { questions: [{ ...QUESTIONS[0], correct: ['c9'] }] })).problem).toMatch(/^Question 1 is not a complete question/)
    expect((await publish(teacher, { questions: [QUESTIONS[0], { ...QUESTIONS[1], choices: [choice('c1', 'Matrix'), choice('c2', ' ')] }] })).problem).toBe('A choice in question 2 is empty.')

    const { id } = await publish(teacher, {})
    expect(id).toBeTruthy()
    const asTeacher = await quiz(teacher, id!)
    expect(asTeacher).toMatchObject({ title: 'Respiration', author: { id: teacher.id }, questionCount: 3, submittedCount: 0, viewerCanDelete: true })
    expect(asTeacher!.questions.map((q) => q.correct)).toEqual([['c1'], ['c2'], ['a', 'c']])
    expect(JSON.stringify(asTeacher!.questions[2])).not.toContain('anchor')

    await bus.drain()
    const told = await t.gql<{ notifications: { edges: { node: { category: string; path: string; actor: { id: string } | null } }[] } }>('{ notifications { edges { node { category path actor { id } } } } }', {}, student.token)
    expect(told.data!.notifications.edges[0]?.node).toEqual({ category: 'QUIZ_PUBLISHED', path: `/classes/${classroomId}/quizzes/${id}`, actor: { id: teacher.id } })
    const teacherTold = await t.gql<{ notifications: { edges: unknown[] } }>('{ notifications { edges { node { category } } } }', {}, teacher.token)
    expect(teacherTold.data!.notifications.edges).toHaveLength(0)

    const listed = await t.gql<{ classroom: { viewerCan: { publishQuiz: boolean }; quizzes: { id: string; questionCount: number }[] } }>('query ($id: UUID!) { classroom(id: $id) { viewerCan { publishQuiz } quizzes { id questionCount } } }', { id: classroomId }, student.token)
    expect(listed.data!.classroom).toEqual({ viewerCan: { publishQuiz: false }, quizzes: [{ id, questionCount: 3 }] })
    expect(await quiz(outsider, id!)).toBeNull()
    expect((await submit(outsider, id!, [])).problem).toBe('Quiz not found.')
  })

  it('a student takes it: scored by the server, the answers shown once submitted, a resent submission the same attempt', async () => {
    const { id } = await publish(teacher, { title: 'Glycolysis' })
    const before = await quiz(student, id!)
    expect(before!.questions.map((q) => [q.correct, q.explanation])).toEqual([[null, null], [null, null], [null, null]])
    expect(before!.submittedCount).toBeNull()
    expect(before!.viewerCanDelete).toBe(false)
    const [q1, q2, q3] = before!.questions

    expect((await submit(student, id!, [{ questionId: randomUUID(), choiceIds: ['c1'] }])).problem).toBe('An answer is for a question that is not in this quiz.')
    expect((await submit(student, id!, [{ questionId: q1!.id, choiceIds: ['zz'] }])).problem).toBe('An answer picks a choice the question does not have.')

    // Right, wrong, and half of a multiple-answer question (wrong).
    const op = randomUUID()
    const first = await submit(student, id!, [{ questionId: q1!.id, choiceIds: ['c1'] }, { questionId: q2!.id, choiceIds: ['c1'] }, { questionId: q3!.id, choiceIds: ['a'] }], op)
    expect(first.attempt).toMatchObject({ score: 1, total: 3 })
    expect(first.attempt!.answers.map((a) => a.correct)).toEqual([true, false, false])
    expect(first.quiz!.questions.map((q) => q.correct)).toEqual([['c1'], ['c2'], ['a', 'c']])
    expect(first.quiz!.questions[0]!.explanation).toEqual(doc('Respiration happens in the mitochondria.'))
    // The phone sends it again: the same attempt, nothing new.
    expect((await submit(student, id!, [{ questionId: q1!.id, choiceIds: ['c2'] }], op)).attempt!.id).toBe(first.attempt!.id)
    // Someone else cannot use that submission id.
    expect((await submit(student2, id!, [], op)).problem).toBe('This submission id was used for something else.')

    // Practice: all right this time; unanswered questions count as wrong.
    const again = await submit(student, id!, [{ questionId: q1!.id, choiceIds: ['c1'] }, { questionId: q2!.id, choiceIds: ['c2'] }, { questionId: q3!.id, choiceIds: ['c', 'a', 'a'] }])
    expect(again.attempt).toMatchObject({ score: 3, total: 3 })
    const blank = await submit(student2, id!, [])
    expect(blank.attempt).toMatchObject({ score: 0, total: 3 })
    expect(blank.attempt!.answers.every((a) => a.choiceIds.length === 0 && !a.correct)).toBe(true)
    expect((await quiz(student, id!))!.myAttempts.map((a) => a.score)).toEqual([3, 1])
    // The TA trying it does not count: staff see the students who submitted.
    await submit(ta, id!, [{ questionId: q1!.id, choiceIds: ['c1'] }])
    expect((await quiz(teacher, id!))!.submittedCount).toBe(2)
  })

  it('staff remove a quiz; a student cannot; it keeps its source note only when its author could read it', async () => {
    const own = await t.gql<{ createNote: { note: { id: string } } }>('mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } } }', { input: { title: 'Respiration notes', cards: [{ id: newId(), type: 'text', position: 'a0', content: { doc: doc('Cells respire.') } }] } }, teacher.token)
    const theirs = await t.gql<{ createNote: { note: { id: string } } }>('mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } } }', { input: { title: 'Private', cards: [{ id: newId(), type: 'text', position: 'a0', content: { doc: doc('Mine.') } }] } }, outsider.token)
    const kept = await publish(teacher, { sourceNoteId: own.data!.createNote.note.id })
    const dropped = await publish(teacher, { sourceNoteId: theirs.data!.createNote.note.id })
    expect((await db.classQuiz.findUniqueOrThrow({ where: { id: kept.id! } })).sourceNoteId).toBe(own.data!.createNote.note.id)
    expect((await db.classQuiz.findUniqueOrThrow({ where: { id: dropped.id! } })).sourceNoteId).toBeNull()

    const remove = (who: Person, quizId: string) => t.gql<{ deleteClassQuiz: { ok: boolean; userErrors: { code: string }[] } }>(`mutation ($input: ClassQuizIdInput!) { deleteClassQuiz(input: $input) { ok ${ERRORS} } }`, { input: { quizId } }, who.token)
    const refused = await remove(student, kept.id!)
    expect(refused.errors?.[0]?.extensions.code ?? refused.data?.deleteClassQuiz.userErrors[0]?.code).toBe('FORBIDDEN')
    expect((await remove(ta, kept.id!)).data!.deleteClassQuiz.ok).toBe(true)
    expect(await quiz(student, kept.id!)).toBeNull()
  })

  it('attempts are in the person’s data export, and go with their account', async () => {
    const files = (await t.app.get(CoreExport).exportFor(student.id)).files
    const attempts = JSON.parse(Buffer.from(files.find((f) => f.path === 'data/core/quiz-attempts.json')!.bytes).toString()) as { score: number }[]
    expect(attempts.map((a) => a.score)).toEqual([1, 3])
    const published = JSON.parse(Buffer.from((await t.app.get(CoreExport).exportFor(teacher.id)).files.find((f) => f.path === 'data/core/class-quizzes.json')!.bytes).toString()) as { title: string }[]
    expect(published.map((q) => q.title)).toEqual(['Respiration', 'Glycolysis', 'Respiration'])
    await bus.publish('UserDeleted', { userId: student.id })
    await bus.drain()
    expect(await db.quizAttempt.count({ where: { userId: student.id } })).toBe(0)
    expect(await db.quizAttempt.count({ where: { userId: student2.id } })).toBe(1)
  })
})
