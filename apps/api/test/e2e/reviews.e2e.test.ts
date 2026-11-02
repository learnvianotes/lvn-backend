import { randomUUID } from 'node:crypto'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { createTestApp, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'

/**
 * Flashcard reviews with FSRS (§14.2, ADR-0068): the deck is one's own notes' flashcards plus readable notes one chose
 * to study; today's queue is capped (20, of which 10 new); a grade moves the card out until it is due; the same grade
 * sent twice counts once and a late grade lands in order; a note one can no longer read drops out; each grade is a
 * learning event (reviews on the day).
 */
describe('flashcard reviews', () => {
  let app: TestApp
  let db: PrismaService
  const QUEUE = '{ reviewQueue { due new doneToday waiting cards { cardId noteId noteTitle front back state due } } }'
  type Queue = { reviewQueue: { due: number; new: number; doneToday: number; waiting: number; cards: { cardId: string; noteId: string; noteTitle: string; front: unknown; state: string; due: string | null }[] } }
  const REVIEW = 'mutation ($input: ReviewCardInput!) { reviewCard(input: $input) { review { cardId due state intervalDays } userErrors { message code } } }'
  type Reviewed = { reviewCard: { review: { cardId: string; due: string; state: string; intervalDays: number } | null; userErrors: { message: string; code: string }[] } }
  const doc = (text: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] })
  const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
  const flashcard = (i: number) => ({ id: newId(), type: 'flashcard', position: `a${DIGITS[i + 1]}`, content: { front: doc(`Front ${i}`), back: doc(`Back ${i}`) } })
  const person = async () => {
    const u = await seedUser(app.app, { verified: true, handle: `r${Date.now()}${Math.floor(Math.random() * 1e6)}` })
    return { id: u.id, token: tokenFor(app.config, u.id) }
  }
  const note = async (token: string, title: string, cards: object[]) =>
    (await app.gql<{ createNote: { note: { id: string } } }>('mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } } }', { input: { title, cards } }, token)).data!.createNote.note.id
  const queue = async (token: string) => (await app.gql<Queue>(QUEUE, {}, token)).data!.reviewQueue
  const review = async (token: string, cardId: string, rating: string, over: Record<string, unknown> = {}) => (await app.gql<Reviewed>(REVIEW, { input: { cardId, rating, clientOpId: randomUUID(), durationMs: 6_000, ...over } }, token)).data!.reviewCard
  /** A moment before now that still belongs to the current learning day (04:00–04:00 UTC). */
  const earlierToday = () => {
    const now = Date.now()
    const utc = new Date(now)
    const rollover = Date.UTC(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate(), 4)
    const dayStart = now >= rollover ? rollover : rollover - 86_400_000
    const hourAgo = now - 3_600_000
    return new Date(hourAgo >= dayStart ? hourAgo : Math.max(dayStart, now - 1_000))
  }

  beforeAll(async () => {
    app = await createTestApp()
    db = app.app.get(PrismaService)
  })

  afterAll(async () => {
    await app?.close()
  })

  it('makes today’s queue from one’s own flashcards, capped at 20 a day with at most 10 new', async () => {
    const me = await person()
    await note(me.token, 'Heaps', Array.from({ length: 25 }, (_, i) => flashcard(i)))
    const q = await queue(me.token)
    expect(q).toMatchObject({ due: 0, new: 25, doneToday: 0, waiting: 15 })
    expect(q.cards).toHaveLength(10)
    expect(q.cards[0]).toMatchObject({ noteTitle: 'Heaps', front: doc('Front 0'), state: 'NEW', due: null })
    expect((await app.gql(QUEUE)).errors?.[0]?.extensions.code).toBe('UNAUTHENTICATED')
  })

  it('moves a graded card out until it is due, counts the same grade once, and replays a late grade in order', async () => {
    const me = await person()
    await note(me.token, 'Graphs', [flashcard(1), flashcard(2)])
    const [first, second] = (await queue(me.token)).cards
    const clientOpId = randomUUID()
    // EASY on a new card schedules it days ahead (GOOD would keep it in today's learning steps).
    const easy = await review(me.token, first!.cardId, 'EASY', { clientOpId })
    expect(easy.userErrors).toEqual([])
    expect(easy.review).toMatchObject({ state: 'REVIEW' })
    expect(new Date(easy.review!.due).getTime()).toBeGreaterThan(Date.now() + 86_400_000)
    // The phone sends the same grade again after a lost answer: still one grade.
    expect((await review(me.token, first!.cardId, 'EASY', { clientOpId })).review).toEqual(easy.review)
    expect(await db.cardReviewLog.count({ where: { userId: me.id, cardId: first!.cardId } })).toBe(1)
    // A grade made offline earlier arrives now: the card's state is the replay in the order given.
    // The learning day rolls at 04:00 UTC, so an hour ago is yesterday during the hour after rollover.
    await review(me.token, second!.cardId, 'GOOD')
    const late = await review(me.token, second!.cardId, 'AGAIN', { reviewedAt: earlierToday().toISOString() })
    const log = await db.cardReviewLog.findMany({ where: { userId: me.id, cardId: second!.cardId }, orderBy: { reviewedAt: 'asc' } })
    expect(log.map((l) => l.rating)).toEqual([1, 3])
    expect(late.review!.state).not.toBe('NEW')
    const after = await queue(me.token)
    expect(after.doneToday).toBe(3)
    // The easy card is days ahead; the other, still learning, comes back today.
    expect(after.cards.map((c) => c.cardId)).toEqual([second!.cardId])
    // Each grade is a learning event: the day has its reviews.
    const day = await db.learningDay.findMany({ where: { userId: me.id } })
    expect(day.reduce((n, d) => n + d.reviews, 0)).toBe(3)
  })

  it('studies another’s public note only when chosen, and drops a note one can no longer read', async () => {
    const author = await person()
    const reader = await person()
    const noteId = await note(author.token, 'Public cards', [flashcard(1)])
    await app.gql('mutation ($input: NoteIdInput!) { publishNote(input: $input) { note { id } } }', { input: { noteId } }, author.token)
    await app.gql('mutation ($input: ChangeNoteVisibilityInput!) { changeNoteVisibility(input: $input) { note { id } } }', { input: { noteId, visibility: 'PUBLIC' } }, author.token)
    await app.gql('mutation ($input: NoteIdInput!) { publishNote(input: $input) { note { id } } }', { input: { noteId } }, author.token)
    expect((await queue(reader.token)).cards).toEqual([])
    const study = await app.gql<{ studyNoteCards: { ok: boolean } }>('mutation ($input: StudyNoteInput!) { studyNoteCards(input: $input) { ok userErrors { message } } }', { input: { noteId } }, reader.token)
    expect(study.data!.studyNoteCards.ok).toBe(true)
    expect((await app.gql<{ note: { viewerStudying: boolean } }>('query ($id: UUID!) { note(id: $id) { viewerStudying } }', { id: noteId }, reader.token)).data!.note.viewerStudying).toBe(true)
    expect((await queue(reader.token)).cards.map((c) => c.noteTitle)).toEqual(['Public cards'])
    // The author makes it private again: the reader's queue loses it, and grading it is refused.
    await app.gql('mutation ($input: ChangeNoteVisibilityInput!) { changeNoteVisibility(input: $input) { note { id } } }', { input: { noteId, visibility: 'PRIVATE' } }, author.token)
    expect((await queue(reader.token)).cards).toEqual([])
    const cardId = (await db.card.findFirstOrThrow({ where: { noteId } })).id
    expect((await review(reader.token, cardId, 'GOOD')).userErrors[0]!.code).toBe('NOT_FOUND')
    // A private note of someone else cannot be chosen.
    const secret = await note(author.token, 'Secret cards', [flashcard(2)])
    expect((await app.gql<{ studyNoteCards: { ok: boolean; userErrors: { code: string }[] } }>('mutation ($input: StudyNoteInput!) { studyNoteCards(input: $input) { ok userErrors { code } } }', { input: { noteId: secret } }, reader.token)).data!.studyNoteCards.userErrors[0]!.code).toBe('NOT_FOUND')
  })

  it('resets a card to new, and erases reviews with the account', async () => {
    const me = await person()
    await note(me.token, 'Reset', [flashcard(1)])
    const [card] = (await queue(me.token)).cards
    await review(me.token, card!.cardId, 'EASY')
    await app.gql('mutation ($input: CardIdInput!) { resetCardReview(input: $input) { ok } }', { input: { cardId: card!.cardId } }, me.token)
    expect((await queue(me.token)).cards[0]).toMatchObject({ cardId: card!.cardId, state: 'NEW' })
    await review(me.token, card!.cardId, 'GOOD')
    const { ReviewsService } = await import('@lvn-backend/core')
    expect((await app.app.get(ReviewsService).exportFor(me.id)).log).toHaveLength(1)
    await app.app.get(ReviewsService).erase(me.id)
    expect(await db.cardReview.count({ where: { userId: me.id } })).toBe(0)
  })
})
