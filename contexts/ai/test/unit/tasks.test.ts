import { parseCardContent } from '@lvn/contracts/validation'
import { doc, inline, TASKS } from '../../src/domain/tasks'

/** Turning what the model wrote into Markdown or valid cards (ADR-0059). */
describe('AI task results', () => {
  it('writes text tasks as Markdown', () => {
    expect(TASKS.SUMMARIZE.result({ summary: 'Heaps keep the smallest on top.', keyPoints: ['Min-heap', 'heapq'] }, 'Heaps')).toEqual({ markdown: 'Heaps keep the smallest on top.\n\n- Min-heap\n- heapq' })
    expect(TASKS.KEY_CONCEPTS.result({ concepts: [{ term: 'Heap', explanation: 'A tree.' }] }, 'Heaps')).toEqual({ markdown: '- **Heap** — A tree.' })
    expect(TASKS.FIND_MISTAKES.result({ mistakes: [] }, 'Heaps')).toEqual({ markdown: 'No mistakes found.' })
  })

  it('makes quiz cards with stable choice ids, dropping answers that point nowhere', () => {
    const { cards, title } = TASKS.QUIZ.result({ questions: [{ question: 'Top of a min-heap?', choices: ['Largest', 'Smallest'], correct: [1, 1, 7], explanation: '' }] }, 'Heaps') as { title: string; cards: { type: string; content: { correct: string[]; multiple: boolean; explanation?: unknown } }[] }
    expect(title).toBe('Quiz — Heaps')
    expect(cards[0]!.content).toMatchObject({ correct: ['c2'], multiple: false })
    expect(cards[0]!.content.explanation).toBeUndefined()
  })

  it('keeps only cards that pass their schema', () => {
    const { cards } = TASKS.QUIZ.result({ questions: [{ question: 'Q?', choices: ['A', 'B'], correct: [5], explanation: 'x' }] }, 'Heaps') as { cards: unknown[] }
    expect(cards).toEqual([])
    const flash = TASKS.FLASHCARDS.result({ cards: [{ front: 'Front', back: 'Back' }] }, '') as { title: string; cards: { type: 'flashcard'; content: unknown }[] }
    expect(flash.title).toBe('Flashcards — Untitled note')
    expect(parseCardContent('flashcard', flash.cards[0]!.content).ok).toBe(true)
  })

  it('makes a revision sheet of headings and bullet lists, and a new note of headings and text', () => {
    const sheet = TASKS.REVISION_SHEET.result({ sections: [{ heading: 'Heaps', points: ['Smallest on top', 'O(log n) push'] }] }, 'Heaps') as { cards: { type: string; content: unknown }[] }
    expect(sheet.cards.map((c) => c.type)).toEqual(['heading', 'markdown'])
    expect(sheet.cards[1]!.content).toEqual({ source: '- Smallest on top\n- O(log n) push' })
    const note = TASKS.CREATE_NOTES.result({ title: 'Mine', sections: [{ heading: 'One', text: 'First.\n\nSecond.' }] }, 'Heaps') as { title: string; cards: { type: string; content: { doc?: { content: unknown[] } } }[] }
    expect(note.title).toBe('Mine')
    expect(note.cards[1]!.content.doc!.content).toHaveLength(2)
  })

  it('splits long text into text nodes the editor accepts', () => {
    expect(doc('a'.repeat(25_000)).content[0]!.content).toHaveLength(3)
    expect(inline('  two   words ')).toEqual([{ type: 'text', text: 'two words' }])
    expect(inline('')).toEqual([])
  })
})
