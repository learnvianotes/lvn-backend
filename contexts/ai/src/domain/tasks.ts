import { z } from 'zod'
import { CardType, type AiTaskType } from '@lvn/contracts/domain'
import { parseCardContent } from '@lvn/contracts/validation'
import type { NewCard } from '@lvn-backend/facades'
import type { TextChange } from './clean-up'

export type AiLanguage = 'ENGLISH' | 'HINDI' | 'TELUGU'
export const LANGUAGE_NAMES: Record<AiLanguage, string> = { ENGLISH: 'English', HINDI: 'Hindi', TELUGU: 'Telugu' }

/** What a task gives (ADR-0059): text shown beside the note, cards to keep, or changes to the note's words (ADR-0063). */
export type TaskResult = { markdown: string } | { title: string; cards: NewCard[] } | { changes: TextChange[] }

export interface TaskDef<T> {
  task: AiTaskType
  /** TEXT: Markdown beside the note; CARDS: cards the person keeps; CHANGES: card text the person applies */
  kind: 'TEXT' | 'CARDS' | 'CHANGES'
  /** contexts/ai/prompts/<prompt>.md */
  prompt: string
  schema: z.ZodType<T>
  /** A method, so the table below can hold every task's own answer type */
  result(out: T, title: string): TaskResult
  /** Reads only the note's code cards (EXPLAIN_CODE) */
  codeOnly?: true
  /** Hears one audio or video card (TRANSCRIBE), or also sees the note's photos (QUICK_NOTE) (ADR-0062) */
  input?: 'AUDIO' | 'IMAGES'
  /** Only on a note the person may edit: their own rough material (QUICK_NOTE), or its words to mend (CLEAN_UP) */
  editorsOnly?: true
}

// ── Building cards from plain text ──────────────────────────────────────────────────────────────────────────────

const TEXT_NODE = 10_000
const textNodes = (text: string) => (text ? (text.match(new RegExp(`[\\s\\S]{1,${TEXT_NODE}}`, 'g')) ?? []).map((t) => ({ type: 'text', text: t })) : [])
/** A rich-text document: one paragraph per blank-line-separated block. */
export const doc = (text: string) => ({ type: 'doc', content: text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((p) => ({ type: 'paragraph', content: textNodes(p) })) })
export const inline = (text: string) => textNodes(text.replace(/\s+/g, ' ').trim())

/** Only cards that pass their type's schema in @lvn/contracts are kept; the preview is exactly what will be stored. */
export function valid(cards: NewCard[]): NewCard[] {
  return cards.flatMap((c) => {
    const parsed = parseCardContent(c.type, c.content)
    return parsed.ok ? [{ type: c.type, content: parsed.content }] : []
  })
}

const bullets = (items: string[]) => items.map((i) => `- ${i.trim()}`).join('\n')

// ── The tasks ───────────────────────────────────────────────────────────────────────────────────────────────────

const summary = z.object({ summary: z.string().min(1), keyPoints: z.array(z.string().min(1)).max(10) })
const concepts = z.object({ concepts: z.array(z.object({ term: z.string().min(1), explanation: z.string().min(1) })).min(1).max(15) })
const explanation = z.object({ explanation: z.string().min(1) })
const questions = z.object({ questions: z.array(z.object({ question: z.string().min(1), answer: z.string().min(1) })).min(1).max(10) })
const translation = z.object({ title: z.string(), text: z.string().min(1) })
const mistakes = z.object({ mistakes: z.array(z.object({ quote: z.string(), problem: z.string().min(1), fix: z.string().min(1) })).max(15) })
const code = z.object({ explanation: z.string().min(1), steps: z.array(z.string().min(1)).max(12) })
const flashcards = z.object({ cards: z.array(z.object({ front: z.string().min(1), back: z.string().min(1) })).min(1).max(20) })
const quiz = z.object({
  questions: z
    .array(z.object({ question: z.string().min(1), choices: z.array(z.string().min(1)).min(2).max(6), correct: z.array(z.number().int().min(0)).min(1), explanation: z.string() }))
    .min(1)
    .max(10),
})
const sheet = z.object({ sections: z.array(z.object({ heading: z.string().min(1), points: z.array(z.string().min(1)).min(1).max(10) })).min(1).max(8) })
const newNote = z.object({ title: z.string().min(1), sections: z.array(z.object({ heading: z.string().min(1), text: z.string().min(1) })).min(1).max(12) })

/** CLEAN_UP's answer for one batch: the passages it would change, by their number (ADR-0063). */
export const repairs = z.object({ changes: z.array(z.object({ n: z.number().int().min(1), text: z.string() })).max(100) })

/** TRANSCRIBE's answer is put together from the pieces' plain text, not asked of the model as JSON. */
const transcript = z.object({ text: z.string(), cut: z.boolean() })

const noteFromSections = (out: z.infer<typeof newNote>): TaskResult => ({
  title: out.title,
  cards: valid(out.sections.flatMap((s) => [{ type: CardType.HEADING, content: { level: 2, content: inline(s.heading) } }, { type: CardType.TEXT, content: { doc: doc(s.text) } }])),
})

export const TASKS: { [K in AiTaskType]: TaskDef<unknown> } = {
  SUMMARIZE: { task: 'SUMMARIZE', kind: 'TEXT', prompt: 'summarize', schema: summary, result: (o: z.infer<typeof summary>) => ({ markdown: `${o.summary.trim()}${o.keyPoints.length ? `\n\n${bullets(o.keyPoints)}` : ''}` }) },
  KEY_CONCEPTS: { task: 'KEY_CONCEPTS', kind: 'TEXT', prompt: 'key-concepts', schema: concepts, result: (o: z.infer<typeof concepts>) => ({ markdown: o.concepts.map((c) => `- **${c.term.trim()}** — ${c.explanation.trim()}`).join('\n') }) },
  EXPLAIN_SIMPLY: { task: 'EXPLAIN_SIMPLY', kind: 'TEXT', prompt: 'explain-simply', schema: explanation, result: (o: z.infer<typeof explanation>) => ({ markdown: o.explanation.trim() }) },
  PRACTICE_QUESTIONS: {
    task: 'PRACTICE_QUESTIONS',
    kind: 'TEXT',
    prompt: 'practice-questions',
    schema: questions,
    result: (o: z.infer<typeof questions>) => ({ markdown: o.questions.map((q, i) => `${i + 1}. ${q.question.trim()}\n\n   *Answer:* ${q.answer.trim()}`).join('\n\n') }),
  },
  TRANSLATE: { task: 'TRANSLATE', kind: 'TEXT', prompt: 'translate', schema: translation, result: (o: z.infer<typeof translation>) => ({ markdown: `${o.title.trim() ? `## ${o.title.trim()}\n\n` : ''}${o.text.trim()}` }) },
  FIND_MISTAKES: {
    task: 'FIND_MISTAKES',
    kind: 'TEXT',
    prompt: 'find-mistakes',
    schema: mistakes,
    result: (o: z.infer<typeof mistakes>) => ({ markdown: o.mistakes.length ? o.mistakes.map((m) => `- ${m.quote.trim() ? `“${m.quote.trim()}”: ` : ''}${m.problem.trim()} **Fix:** ${m.fix.trim()}`).join('\n') : 'No mistakes found.' }),
  },
  EXPLAIN_CODE: { task: 'EXPLAIN_CODE', kind: 'TEXT', prompt: 'explain-code', schema: code, codeOnly: true, result: (o: z.infer<typeof code>) => ({ markdown: `${o.explanation.trim()}${o.steps.length ? `\n\n${o.steps.map((s, i) => `${i + 1}. ${s.trim()}`).join('\n')}` : ''}` }) },
  FLASHCARDS: {
    task: 'FLASHCARDS',
    kind: 'CARDS',
    prompt: 'flashcards',
    schema: flashcards,
    result: (o: z.infer<typeof flashcards>, title) => ({ title: `Flashcards — ${title || 'Untitled note'}`, cards: valid(o.cards.map((c) => ({ type: CardType.FLASHCARD, content: { front: doc(c.front), back: doc(c.back) } }))) }),
  },
  QUIZ: {
    task: 'QUIZ',
    kind: 'CARDS',
    prompt: 'quiz',
    schema: quiz,
    result: (o: z.infer<typeof quiz>, title) => ({
      title: `Quiz — ${title || 'Untitled note'}`,
      cards: valid(
        o.questions.map((q) => {
          const choices = q.choices.map((text, i) => ({ id: `c${i + 1}`, content: inline(text) }))
          const correct = [...new Set(q.correct)].filter((i) => i < choices.length).map((i) => `c${i + 1}`)
          return { type: CardType.QUIZ, content: { question: doc(q.question), choices, correct, multiple: correct.length > 1, ...(q.explanation.trim() ? { explanation: doc(q.explanation) } : {}) } }
        }),
      ),
    }),
  },
  REVISION_SHEET: {
    task: 'REVISION_SHEET',
    kind: 'CARDS',
    prompt: 'revision-sheet',
    schema: sheet,
    result: (o: z.infer<typeof sheet>, title) => ({
      title: `Revision sheet — ${title || 'Untitled note'}`,
      cards: valid(o.sections.flatMap((s) => [{ type: CardType.HEADING, content: { level: 2, content: inline(s.heading) } }, { type: CardType.MARKDOWN, content: { source: bullets(s.points) } }])),
    }),
  },
  CREATE_NOTES: { task: 'CREATE_NOTES', kind: 'CARDS', prompt: 'create-notes', schema: newNote, result: noteFromSections },
  OUTLINE_TO_NOTE: { task: 'OUTLINE_TO_NOTE', kind: 'CARDS', prompt: 'outline-to-note', schema: newNote, result: noteFromSections },
  TRANSCRIBE: {
    task: 'TRANSCRIBE',
    kind: 'CARDS',
    prompt: 'transcribe',
    schema: transcript,
    input: 'AUDIO',
    result: (o: z.infer<typeof transcript>, title) => ({
      title: `Transcript — ${title || 'Untitled note'}`,
      cards: valid(o.text.trim() ? [{ type: CardType.TEXT, content: { doc: doc(o.cut ? `${o.text}\n\n(The recording is longer than 30 minutes: the rest was not transcribed.)` : o.text) } }] : []),
    }),
  },
  QUICK_NOTE: { task: 'QUICK_NOTE', kind: 'CARDS', prompt: 'quick-note', schema: newNote, input: 'IMAGES', editorsOnly: true, result: noteFromSections },
  // Asked batch by batch; the service puts the checked changes together (ADR-0063).
  CLEAN_UP: { task: 'CLEAN_UP', kind: 'CHANGES', prompt: 'clean-up', schema: repairs, editorsOnly: true, result: (o: { changes: TextChange[] }) => ({ changes: o.changes }) },
}

/** The most of a note's words a task reads; the rest is cut, and the person is told. */
export const SOURCE_CHARS = 24_000
